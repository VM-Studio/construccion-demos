import type { Cliente, ListaPrecios, Obra, PrecioProducto, Producto, Proveedor, Rubro } from "@/domain/types";
import { calcularPrecioDesdeMarkup, aplicarCambiosPrecio, type CambioPrecio } from "@/domain/precios";
import { validarCUIT } from "@/domain/cuit";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir } from "../helpers";
import type { GetFn, SetFn } from "../types";

export type ProductoInput = Omit<Producto, "id" | "creadoEn" | "actualizadoEn">;
export type ProveedorInput = Omit<Proveedor, "id" | "creadoEn" | "actualizadoEn">;
export type ClienteInput = Omit<Cliente, "id" | "creadoEn" | "actualizadoEn">;

/** Catálogo: productos, precios, proveedores, clientes, listas y rubros. */
export function crearSliceCatalogo(set: SetFn, get: GetFn) {
  return {
    guardarProducto: (data: ProductoInput, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "productos.editar");
        if (!data.nombre.trim()) throw new ErrorNegocio("El nombre es obligatorio.");
        data = { ...data, unidadNegocioId: tx.must("rubros", data.rubroId).unidadNegocioId };
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

    aplicarCambiosPrecios: (cambios: CambioPrecio[], descripcion: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "precios.editar");
        if (!cambios.length) throw new ErrorNegocio("No hay productos para actualizar.");
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
