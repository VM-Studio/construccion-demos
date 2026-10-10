import type { Cliente, ListaPrecios, Obra, PrecioProducto, Producto, Proveedor, Rubro } from "@/domain/types";
import { calcularPrecioDesdeMarkup, aplicarCambiosPrecio, calcularActualizacionMasiva, costoEnPesos, type CambioPrecio, type Redondeo } from "@/domain/precios";
import { validarCUIT, buscarPorCuit } from "@/domain/cuit";
import { nombreRepetidoEnRubro, preciosParaCosto } from "@/domain/duplicar";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir } from "../helpers";
import type { Tx } from "../tx";
import type { GetFn, SetFn } from "../types";

export type ProductoInput = Omit<Producto, "id" | "creadoEn" | "actualizadoEn">;
export type ProveedorInput = Omit<Proveedor, "id" | "creadoEn" | "actualizadoEn">;
export type ClienteInput = Omit<Cliente, "id" | "creadoEn" | "actualizadoEn">;

/** Lo que el usuario cambia al duplicar (el resto se copia del origen). `precios`: listaId → precio. */
export interface DuplicarProductoInput {
  codigo: string;
  nombre: string;
  rubroId?: string;
  descripcion?: string;
  marca?: string;
  unidad?: Producto["unidad"];
  unidadesPorPallet?: number;
  proveedorHabitualId?: string;
  codigoBarras?: string;
  pesoKg?: number;
  monedaCosto?: Producto["monedaCosto"];
  costoUSD?: number;
  costoUltimo?: number;
  stockMinimo?: number;
  activo?: boolean;
  precios?: Record<string, number>;
}

/** Una fila de "Crear serie": cambia nombre, código, peso, costo, stock mínimo y precios. */
export interface FilaSerieInput {
  codigo: string;
  nombre: string;
  pesoKg?: number;
  costoUltimo: number;
  stockMinimo: number;
  precios?: Record<string, number>;
}

/**
 * Alta de un artículo derivado de `origen` (duplicar / serie): copia los datos del origen salvo
 * código de barras, stock, movimientos, acopios, adjuntos e historial; nace con stock 0 en cada
 * depósito y con los precios indicados (o recalculados con el markup efectivo del origen).
 * Valida código único, nombre distinto dentro del rubro y código de barras único.
 */
function crearDerivado(tx: Tx, origen: Producto, c: DuplicarProductoInput, reservadosNombres: Set<string> = new Set()): Producto {
  const codigo = c.codigo.trim().toUpperCase();
  const nombre = c.nombre.trim().replace(/\s+/g, " ");
  if (!codigo) throw new ErrorNegocio("Ingresá el código.");
  if (!nombre) throw new ErrorNegocio("Ingresá el nombre.");
  const rubroId = c.rubroId ?? origen.rubroId;
  const rubro = tx.must("rubros", rubroId);
  const productos = tx.get("productos");
  const dupCodigo = productos.find((p) => p.codigo.toUpperCase() === codigo);
  if (dupCodigo) throw new ErrorNegocio(`El código ${codigo} ya existe (${dupCodigo.nombre}).`);
  const clave = `${rubroId}|${nombre.toLowerCase()}`;
  if (nombreRepetidoEnRubro(nombre, rubroId, productos) || reservadosNombres.has(clave)) throw new ErrorNegocio(`Ya existe un artículo con el nombre "${nombre}"; cambiá el nombre o el diámetro/medida.`);
  reservadosNombres.add(clave);
  const barras = (c.codigoBarras ?? "").replace(/\D/g, "");
  if (barras) {
    const dupBarras = productos.find((p) => (p.codigoBarras ?? "") === barras);
    if (dupBarras) throw new ErrorNegocio(`El código de barras ${barras} ya es de ${dupBarras.codigo} ${dupBarras.nombre}.`);
  }
  const costo = c.costoUltimo ?? origen.costoUltimo;
  if (costo < 0) throw new ErrorNegocio("El costo no puede ser negativo.");
  let data: ProductoInput = {
    codigo,
    nombre,
    descripcion: c.descripcion ?? origen.descripcion,
    rubroId,
    unidadNegocioId: rubro.unidadNegocioId,
    marca: c.marca ?? origen.marca,
    unidad: c.unidad ?? origen.unidad,
    unidadesPorPallet: c.unidadesPorPallet ?? origen.unidadesPorPallet,
    proveedorHabitualId: c.proveedorHabitualId ?? origen.proveedorHabitualId,
    codigoBarras: barras || undefined,
    pesoKg: c.pesoKg ?? origen.pesoKg,
    monedaCosto: c.monedaCosto ?? origen.monedaCosto,
    costoUSD: (c.monedaCosto ?? origen.monedaCosto) === "USD" ? (c.costoUSD ?? origen.costoUSD) : undefined,
    costoUltimo: costo,
    costoPromedio: costo,
    fechaUltimoCosto: tx.ahora,
    stockMinimo: c.stockMinimo ?? origen.stockMinimo,
    activo: c.activo ?? origen.activo,
  };
  data = normalizarCostoUSD(tx, data);
  data = { ...data, costoPromedio: data.costoUltimo };
  const nuevo: Producto = { ...data, id: newId("prod"), ...tx.meta() };
  tx.insert("productos", nuevo);
  for (const d of tx.get("depositos")) tx.insert("stock", { id: newId("stk"), productoId: nuevo.id, depositoId: d.id, cantidadFisica: 0, ...tx.meta() });
  const listas = tx.get("listasPrecios");
  const calculados = preciosParaCosto(origen, tx.get("precios"), listas, nuevo.costoUltimo);
  for (const l of listas) {
    const precio = c.precios?.[l.id] ?? calculados[l.id];
    if (!(precio >= 0)) throw new ErrorNegocio(`Precio inválido para la lista ${l.nombre}.`);
    tx.insert("precios", { id: newId("pre"), productoId: nuevo.id, listaPreciosId: l.id, precio, ...tx.meta() } as PrecioProducto);
  }
  return nuevo;
}

/** Recalcular precios desde el costo en USD con el tipo de cambio vigente del servidor. */
export interface RecalculoDesdeUSD {
  tipo: "DESDE_USD";
  /** listaPreciosId → markup (base 100). */
  markups: Record<string, number>;
  redondeo?: Redondeo;
}

/** Tipo de cambio vigente (lo inyecta el servidor en `config.tipoCambioVigente`). */
export function tipoCambioVigente(tx: Tx) {
  const tc = tx.config.tipoCambioVigente;
  if (!tc || !(tc.valor > 0)) throw new ErrorNegocio("No hay tipo de cambio disponible: revisalo en Configuración → Parámetros.", "SIN_TIPO_CAMBIO");
  return tc;
}

/** Artículo con costo en USD: el costo en pesos se calcula con el tipo de cambio vigente. */
export function normalizarCostoUSD(tx: Tx, data: ProductoInput, previo?: Producto): ProductoInput {
  if (data.monedaCosto !== "USD") return { ...data, monedaCosto: "ARS", costoUSD: undefined };
  if (!((data.costoUSD ?? 0) > 0)) throw new ErrorNegocio("Ingresá el costo en dólares.");
  const tc = tipoCambioVigente(tx);
  const costoUltimo = costoEnPesos(data.costoUSD!, tc.valor);
  const cambio = !previo || previo.costoUltimo !== costoUltimo;
  return {
    ...data,
    costoUltimo,
    costoPromedio: data.costoPromedio || costoUltimo,
    fechaUltimoCosto: cambio ? tx.ahora : data.fechaUltimoCosto,
  };
}

/** Catálogo: productos, precios, proveedores, clientes, listas y rubros. */
export function crearSliceCatalogo(set: SetFn, get: GetFn) {
  return {
    guardarProducto: (data: ProductoInput, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "productos.editar");
        if (!data.nombre.trim()) throw new ErrorNegocio("El nombre es obligatorio.");
        data = { ...data, unidadNegocioId: tx.must("rubros", data.rubroId).unidadNegocioId };
        data = normalizarCostoUSD(tx, data, id ? tx.must("productos", id) : undefined);
        const dup = tx.get("productos").find((p) => p.codigo.toLowerCase() === data.codigo.trim().toLowerCase() && p.id !== id);
        if (dup) throw new ErrorNegocio(`El código ${data.codigo} ya existe (${dup.nombre}).`);
        if (id) {
          tx.patch("productos", id, { ...data, codigo: data.codigo.trim() });
          tx.auditar("Editó producto", "Producto", id, data.nombre);
          return id;
        }
        const nuevo: Producto = { ...data, codigo: data.codigo.trim(), id: newId("prod"), ...tx.meta() };
        tx.insert("productos", nuevo);
        for (const d of tx.get("depositos"))
          tx.insert("stock", { id: newId("stk"), productoId: nuevo.id, depositoId: d.id, cantidadFisica: 0, ...tx.meta() });
        for (const l of tx.get("listasPrecios"))
          tx.insert("precios", {
            id: newId("pre"),
            productoId: nuevo.id,
            listaPreciosId: l.id,
            precio: calcularPrecioDesdeMarkup(nuevo.costoPromedio || nuevo.costoUltimo, l.markupPorDefecto),
            ...tx.meta(),
          });
        tx.auditar("Creó producto", "Producto", nuevo.id, `${nuevo.codigo} ${nuevo.nombre}`);
        return nuevo.id;
      }),

    /** Duplicar artículo: crea uno NUEVO a partir de otro (el origen no se modifica). */
    duplicarProducto: (origenId: string, cambios: DuplicarProductoInput) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "productos.editar");
        const origen = tx.must("productos", origenId);
        const nuevo = crearDerivado(tx, origen, cambios);
        tx.auditar("Duplicó artículo", "Producto", nuevo.id, `Duplicó el artículo ${origen.codigo} → ${nuevo.codigo} · ${nuevo.nombre}`);
        return nuevo.id;
      }),

    /** Crear serie: varios artículos derivados del mismo origen en una sola transacción (todos o ninguno). */
    crearSerieProductos: (origenId: string, filas: FilaSerieInput[]) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "productos.editar");
        const origen = tx.must("productos", origenId);
        if (!filas.length) throw new ErrorNegocio("Agregá al menos una fila.");
        const codigos = new Set<string>();
        const nombres = new Set<string>();
        const creados: Producto[] = [];
        filas.forEach((f, i) => {
          const cod = f.codigo.trim().toUpperCase();
          if (codigos.has(cod)) throw new ErrorNegocio(`Fila ${i + 1}: el código ${cod} está repetido en la serie.`);
          codigos.add(cod);
          if (!(f.costoUltimo > 0)) throw new ErrorNegocio(`Fila ${i + 1}: el costo tiene que ser mayor a 0.`);
          try {
            creados.push(crearDerivado(tx, origen, { codigo: f.codigo, nombre: f.nombre, pesoKg: f.pesoKg, costoUltimo: f.costoUltimo, stockMinimo: f.stockMinimo, precios: f.precios, monedaCosto: "ARS" }, nombres));
          } catch (e) {
            if (e instanceof ErrorNegocio) throw new ErrorNegocio(`Fila ${i + 1}: ${e.message}`);
            throw e;
          }
        });
        tx.auditar("Creó serie de artículos", "Producto", origen.id, `Creó una serie de ${creados.length} artículos a partir de ${origen.codigo}: ${creados.map((p) => p.codigo).join(", ")}`);
        return { ids: creados.map((p) => p.id), codigos: creados.map((p) => p.codigo) };
      }),

    actualizarPrecio: (productoId: string, listaPreciosId: string, precio: number) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "precios.editar");
        if (precio < 0) throw new ErrorNegocio("El precio no puede ser negativo.");
        const existente = tx.get("precios").find((p) => p.productoId === productoId && p.listaPreciosId === listaPreciosId);
        if (existente) tx.patch("precios", existente.id, { precio });
        else tx.insert("precios", { id: newId("pre"), productoId, listaPreciosId, precio, ...tx.meta() } as PrecioProducto);
        const p = tx.must("productos", productoId);
        const l = tx.must("listasPrecios", listaPreciosId);
        tx.auditar("Actualizó precio", "Producto", productoId, `${p.codigo} · ${l.nombre}: ${precio}`);
      }),

    /**
     * `recalculo` DESDE_USD: los `nuevo` que manda la pantalla son solo la vista previa; acá se
     * recalculan con el tipo de cambio vigente del servidor y se actualiza el costo en pesos.
     */
    aplicarCambiosPrecios: (cambios: CambioPrecio[], descripcion: string, recalculo?: RecalculoDesdeUSD) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "precios.editar");
        if (recalculo) {
          const tc = tipoCambioVigente(tx);
          const filtro = { productoIds: [...new Set(cambios.map((c) => c.productoId))], listaIds: [...new Set(cambios.map((c) => c.listaPreciosId))] };
          cambios = calcularActualizacionMasiva(tx.get("precios"), tx.get("productos"), filtro, { tipo: "DESDE_USD", markups: recalculo.markups, tipoCambio: tc.valor }, recalculo.redondeo ?? 10);
          for (const pid of new Set(cambios.map((c) => c.productoId))) {
            const p = tx.must("productos", pid);
            const costo = costoEnPesos(p.costoUSD ?? 0, tc.valor);
            if (costo !== p.costoUltimo) tx.patch("productos", pid, { costoUltimo: costo, fechaUltimoCosto: tx.ahora });
          }
          descripcion = `${descripcion} · dólar ${tc.valor}`;
        }
        if (!cambios.length) throw new ErrorNegocio(recalculo ? "Ninguno de los artículos elegidos tiene costo en USD." : "No hay productos para actualizar.");
        const nuevos = aplicarCambiosPrecio(tx.get("precios"), cambios, tx.ahora);
        for (const p of nuevos) {
          const viejo = tx.find("precios", p.id);
          if (viejo && viejo.precio !== p.precio) tx.patch("precios", p.id, { precio: p.precio });
        }
        // Artículos que todavía no tenían fila de precio en esa lista: se crea.
        const existentes = new Set(tx.get("precios").map((p) => `${p.productoId}|${p.listaPreciosId}`));
        for (const c of cambios)
          if (!existentes.has(`${c.productoId}|${c.listaPreciosId}`))
            tx.insert("precios", { id: newId("pre"), productoId: c.productoId, listaPreciosId: c.listaPreciosId, precio: c.nuevo, ...tx.meta() } as PrecioProducto);
        const productos = new Set(cambios.map((c) => c.productoId)).size;
        tx.auditar("Actualización masiva de precios", "ListaPrecios", "masiva", `${descripcion} · ${productos} productos`);
        return productos;
      }),

    guardarProveedor: (data: ProveedorInput, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "proveedores.editar");
        if (!data.razonSocial.trim()) throw new ErrorNegocio("La razón social es obligatoria.");
        const err = validarCUIT(data.cuit);
        if (err) throw new ErrorNegocio(err);
        const dupP = buscarPorCuit(tx.get("proveedores"), data.cuit, id);
        if (dupP) throw new ErrorNegocio(`Ya existe el proveedor ${dupP.razonSocial} con ese CUIT.`);
        if (!id && !data.codigo) data = { ...data, codigo: `P${String(tx.get("proveedores").length + 1).padStart(4, "0")}` };
        if (id) {
          tx.patch("proveedores", id, data);
          tx.auditar("Editó proveedor", "Proveedor", id, data.razonSocial);
          return id;
        }
        const nuevo: Proveedor = { ...data, id: newId("prov"), ...tx.meta() };
        tx.insert("proveedores", nuevo);
        tx.auditar("Creó proveedor", "Proveedor", nuevo.id, data.razonSocial);
        return nuevo.id;
      }),

    guardarCliente: (data: ClienteInput, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "clientes.editar");
        if (!data.razonSocial.trim()) throw new ErrorNegocio("La razón social es obligatoria.");
        if (data.condicionIVA !== "CF" || data.cuit) {
          const err = validarCUIT(data.cuit);
          if (err) throw new ErrorNegocio(err);
        }
        const dupC = buscarPorCuit(tx.get("clientes"), data.cuit, id);
        if (dupC) throw new ErrorNegocio(`Ya existe el cliente ${dupC.razonSocial} con ese CUIT.`);
        if (!id && !data.codigo) {
          const max = tx.get("clientes").reduce((m, c) => Math.max(m, Number(c.codigo.replace(/\D/g, "")) || 0), 0);
          data = { ...data, codigo: `C${String(max + 1).padStart(4, "0")}` };
        }
        if (id) {
          tx.patch("clientes", id, data);
          tx.auditar("Editó cliente", "Cliente", id, data.razonSocial);
          return id;
        }
        const nuevo: Cliente = { ...data, id: newId("cli"), ...tx.meta() };
        tx.insert("clientes", nuevo);
        tx.auditar("Creó cliente", "Cliente", nuevo.id, data.razonSocial);
        return nuevo.id;
      }),

    /** Alta / edición de obra (también alta rápida desde cualquier selector de obra). */
    guardarObra: (data: Omit<Obra, "id" | "creadoEn" | "actualizadoEn">, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        if (!data.nombre.trim()) throw new ErrorNegocio("El nombre de la obra es obligatorio.");
        if (id) {
          tx.patch("obras", id, { ...data, nombre: data.nombre.trim() });
          tx.auditar("Editó obra", "Cliente", data.clienteId, data.nombre);
          return id;
        }
        const o: Obra = { ...data, nombre: data.nombre.trim(), id: newId("obra"), ...tx.meta() };
        tx.insert("obras", o);
        tx.auditar("Creó obra", "Cliente", data.clienteId, data.nombre);
        return o.id;
      }),

    guardarLista: (data: Omit<ListaPrecios, "id" | "creadoEn" | "actualizadoEn">, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "precios.editar");
        if (!data.nombre.trim()) throw new ErrorNegocio("El nombre es obligatorio.");
        if (id) {
          tx.patch("listasPrecios", id, data);
          tx.auditar("Editó lista de precios", "ListaPrecios", id, data.nombre);
          return id;
        }
        const lista: ListaPrecios = { ...data, id: newId("lst"), ...tx.meta() };
        tx.insert("listasPrecios", lista);
        for (const p of tx.get("productos"))
          tx.insert("precios", {
            id: newId("pre"),
            productoId: p.id,
            listaPreciosId: lista.id,
            precio: calcularPrecioDesdeMarkup(p.costoPromedio, data.markupPorDefecto),
            ...tx.meta(),
          });
        tx.auditar("Creó lista de precios", "ListaPrecios", lista.id, `${data.nombre} (${data.markupPorDefecto} %)`);
        return lista.id;
      }),

    guardarRubro: (data: Omit<Rubro, "id" | "creadoEn" | "actualizadoEn">, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "productos.editar");
        if (!data.nombre.trim()) throw new ErrorNegocio("El nombre es obligatorio.");
        if (!/^\d{2,3}$/.test(data.prefijo)) throw new ErrorNegocio("El prefijo debe ser numérico (2 o 3 dígitos).");
        if (id) {
          tx.patch("rubros", id, data);
          return id;
        }
        const r: Rubro = { ...data, id: newId("rub"), ...tx.meta() };
        tx.insert("rubros", r);
        tx.auditar("Creó rubro", "Rubro", r.id, data.nombre);
        return r.id;
      }),
  };
}
