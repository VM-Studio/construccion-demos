import type { Cliente, Obra, Producto, Proveedor } from "@/domain/types";
import { calcularPrecioDesdeMarkup } from "@/domain/precios";
import { validarCUIT } from "@/domain/cuit";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir } from "../helpers";
import type { GetFn, SetFn } from "../types";
import type { ClienteInput, ProductoInput, ProveedorInput } from "./catalogo";

export interface ResultadoImportacion {
  creados: number;
  ids: string[];
}

const resumen = (items: string[]) => (items.length > 10 ? `${items.slice(0, 10).join(", ")} y ${items.length - 10} más` : items.join(", "));

/** Importación masiva desde CSV: replica las altas individuales de catálogo en una sola transacción. */
export function crearSliceImportacion(set: SetFn, get: GetFn) {
  return {
    importarArticulos: (filas: ProductoInput[]) =>
      ejecutar(get, set, (tx): ResultadoImportacion => {
        exigir(tx, "productos.editar");
        if (!filas.length) throw new ErrorNegocio("No hay artículos para importar.");
        const codigos = new Set(tx.get("productos").map((p) => p.codigo.toLowerCase()));
        const ids: string[] = [];
        for (const fila of filas) {
          if (!fila.nombre.trim()) throw new ErrorNegocio("Hay artículos sin nombre.");
          const codigo = fila.codigo.trim();
          if (!codigo) throw new ErrorNegocio(`El artículo ${fila.nombre} no tiene código.`);
          if (codigos.has(codigo.toLowerCase())) throw new ErrorNegocio(`El código ${codigo} ya existe.`);
          codigos.add(codigo.toLowerCase());
          const rubro = tx.find("rubros", fila.rubroId);
          if (!rubro) throw new ErrorNegocio(`El rubro del artículo ${codigo} no existe.`);
          const nuevo: Producto = { ...fila, codigo, unidadNegocioId: rubro.unidadNegocioId, id: newId("prod"), ...tx.meta() };
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
          ids.push(nuevo.id);
        }
        tx.auditar(`Importó ${ids.length} artículos desde CSV`, "Producto", "importacion", resumen(filas.map((f) => f.codigo.trim())));
        return { creados: ids.length, ids };
      }),

    importarClientes: (filas: { cliente: ClienteInput; obras: string[] }[]) =>
      ejecutar(get, set, (tx): ResultadoImportacion => {
        exigir(tx, "clientes.editar");
        if (!filas.length) throw new ErrorNegocio("No hay clientes para importar.");
        const codigos = new Set(tx.get("clientes").map((c) => c.codigo.toLowerCase()));
        const ids: string[] = [];
        for (const { cliente, obras } of filas) {
          let data = cliente;
          if (!data.razonSocial.trim()) throw new ErrorNegocio("Hay clientes sin razón social.");
          if (data.condicionIVA !== "CF" || data.cuit) {
            const err = validarCUIT(data.cuit);
            if (err) throw new ErrorNegocio(`${data.razonSocial}: ${err}`);
          }
          if (!tx.find("listasPrecios", data.listaPreciosId)) throw new ErrorNegocio(`${data.razonSocial}: la lista de precios no existe.`);
          if (!data.codigo) {
            const max = tx.get("clientes").reduce((m, c) => Math.max(m, Number(c.codigo.replace(/\D/g, "")) || 0), 0);
            data = { ...data, codigo: `C${String(max + 1).padStart(4, "0")}` };
          }
          if (codigos.has(data.codigo.toLowerCase())) throw new ErrorNegocio(`El código de cliente ${data.codigo} ya existe.`);
          codigos.add(data.codigo.toLowerCase());
          const nuevo: Cliente = { ...data, id: newId("cli"), ...tx.meta() };
          tx.insert("clientes", nuevo);
          for (const nombre of obras) {
            if (!nombre.trim()) continue;
            const o: Obra = { clienteId: nuevo.id, nombre: nombre.trim(), activa: true, id: newId("obra"), ...tx.meta() };
            tx.insert("obras", o);
          }
          ids.push(nuevo.id);
        }
        const nombres = ids.map((id) => tx.must("clientes", id)).map((c) => `${c.codigo} ${c.razonSocial}`);
        tx.auditar(`Importó ${ids.length} clientes desde CSV`, "Cliente", "importacion", resumen(nombres));
        return { creados: ids.length, ids };
      }),

    importarProveedores: (filas: ProveedorInput[]) =>
      ejecutar(get, set, (tx): ResultadoImportacion => {
        exigir(tx, "proveedores.editar");
        if (!filas.length) throw new ErrorNegocio("No hay proveedores para importar.");
        const codigos = new Set(tx.get("proveedores").map((p) => p.codigo.toLowerCase()));
        const ids: string[] = [];
        for (let data of filas) {
          if (!data.razonSocial.trim()) throw new ErrorNegocio("Hay proveedores sin razón social.");
          const err = validarCUIT(data.cuit);
          if (err) throw new ErrorNegocio(`${data.razonSocial}: ${err}`);
          if (!data.codigo) {
            // Misma lógica que el alta individual; se saltean códigos ya usados.
            let n = tx.get("proveedores").length + 1;
            while (codigos.has(`p${String(n).padStart(4, "0")}`)) n++;
            data = { ...data, codigo: `P${String(n).padStart(4, "0")}` };
          }
          if (codigos.has(data.codigo.toLowerCase())) throw new ErrorNegocio(`El código de proveedor ${data.codigo} ya existe.`);
          codigos.add(data.codigo.toLowerCase());
          const nuevo: Proveedor = { ...data, id: newId("prov"), ...tx.meta() };
          tx.insert("proveedores", nuevo);
          ids.push(nuevo.id);
        }
        const nombres = ids.map((id) => tx.must("proveedores", id)).map((p) => `${p.codigo} ${p.razonSocial}`);
        tx.auditar(`Importó ${ids.length} proveedores desde CSV`, "Proveedor", "importacion", resumen(nombres));
        return { creados: ids.length, ids };
      }),
  };
}

export type AccionesImportacion = ReturnType<typeof crearSliceImportacion>;
