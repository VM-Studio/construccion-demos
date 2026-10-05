import { addDays, parseISO } from "date-fns";
import type { Comprobante, DiferenciaRecepcion, EstadoOC, ItemOC, OrdenCompra, RecepcionMercaderia } from "@/domain/types";
import { recalcularCostoPromedio, variacionCosto } from "@/domain/costos";
import { markupEfectivo, obtenerPrecio } from "@/domain/precios";
import { diasCondicionPago } from "@/domain/ventas";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir, r2 } from "../helpers";
import type { GetFn, SetFn } from "../types";

export interface OCInput {
  proveedorId: string;
  depositoDestinoId: string;
  sucursalId: string;
  fechaEmision: string;
  fechaEntregaEstimada: string;
  items: ItemOC[];
  observaciones?: string;
}

export interface RecepcionInput {
  ordenCompraId: string;
  remitoProveedor: string;
  fecha: string;
  depositoId: string;
  observaciones?: string;
  items: { itemOCId: string; cantidad: number; costoUnitario: number; diferencia: DiferenciaRecepcion; observacion?: string }[];
}

export interface AvisoSubaCosto {
  productoId: string;
  costoAnterior: number;
  costoNuevo: number;
  subaPct: number;
  markupMayorista: number;
}

export function totalesOC(items: ItemOC[], ivaPct = 21) {
  const subtotal = r2(items.reduce((a, i) => a + i.cantidadPedida * i.costoUnitario * (1 - (i.descuentoPct || 0) / 100), 0));
  return { subtotal, iva: r2(subtotal * (ivaPct / 100)), total: r2(subtotal * (1 + ivaPct / 100)) };
}

const TRANSICIONES: Record<EstadoOC, EstadoOC[]> = {
  BORRADOR: ["ENVIADA", "CANCELADA"],
  ENVIADA: ["CONFIRMADA", "BORRADOR", "CANCELADA"],
  CONFIRMADA: ["CANCELADA"],
  RECIBIDA_PARCIAL: ["RECIBIDA"],
  RECIBIDA: [],
  CANCELADA: [],
};

const ETIQUETA: Partial<Record<EstadoOC, string>> = {
  ENVIADA: "Envió orden de compra al proveedor",
  CONFIRMADA: "Confirmó orden de compra",
  BORRADOR: "Volvió orden de compra a borrador",
  CANCELADA: "Canceló orden de compra",
};

/** Compras: órdenes de compra e ingreso de mercadería. */
export function crearSliceCompras(set: SetFn, get: GetFn) {
  return {
    guardarOC: (data: OCInput, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "compras.editar");
        if (!data.proveedorId) throw new ErrorNegocio("Elegí un proveedor.");
        const items = data.items.filter((i) => i.productoId && i.cantidadPedida > 0);
        if (!items.length) throw new ErrorNegocio("Agregá al menos un producto con cantidad.");
        const tot = totalesOC(items, tx.config.ivaPct);
        if (id) {
          const oc = tx.must("ordenesCompra", id);
          if (oc.estado !== "BORRADOR") throw new ErrorNegocio("Sólo se pueden editar órdenes en borrador.");
          tx.patch("ordenesCompra", id, { ...data, items, ...tot });
          tx.auditar("Editó orden de compra", "OrdenCompra", id, oc.numero);
          return id;
        }
        const oc: OrdenCompra = {
          id: newId("oc"),
          numero: tx.numero("OC"),
          ...data,
          items,
          ...tot,
          estado: "BORRADOR",
          usuarioId: tx.usuarioId,
          ...tx.meta(),
        };
        tx.insert("ordenesCompra", oc);
        tx.auditar("Creó orden de compra", "OrdenCompra", oc.id, `${oc.numero} · ${tx.find("proveedores", oc.proveedorId)?.razonSocial ?? ""}`);
        return oc.id;
      }),

    cambiarEstadoOC: (id: string, estado: EstadoOC) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, estado === "CANCELADA" || estado === "BORRADOR" ? "compras.editar" : "compras.confirmar");
        const oc = tx.must("ordenesCompra", id);
        if (!TRANSICIONES[oc.estado].includes(estado)) throw new ErrorNegocio(`No se puede pasar de ${oc.estado} a ${estado}.`);
        tx.patch("ordenesCompra", id, { estado });
        tx.auditar(ETIQUETA[estado] ?? "Cambió estado de OC", "OrdenCompra", id, oc.numero);
      }),

    /** Da por cerrada una OC parcialmente recibida (el saldo deja de estar en tránsito). */
    cancelarSaldoOC: (id: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "compras.editar");
        const oc = tx.must("ordenesCompra", id);
        if (oc.estado !== "CONFIRMADA" && oc.estado !== "RECIBIDA_PARCIAL") throw new ErrorNegocio("La orden no tiene saldo pendiente.");
        const algoRecibido = oc.items.some((i) => i.cantidadRecibida > 0);
        tx.patch("ordenesCompra", id, {
          estado: algoRecibido ? "RECIBIDA" : "CANCELADA",
          observaciones: [oc.observaciones, `Saldo pendiente cancelado el ${tx.ahora.slice(0, 10)}.`].filter(Boolean).join(" "),
        });
        tx.auditar("Canceló saldo pendiente de OC", "OrdenCompra", id, oc.numero);
      }),

    eliminarOC: (id: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "compras.editar");
        const oc = tx.must("ordenesCompra", id);
        if (oc.estado !== "BORRADOR") throw new ErrorNegocio("Sólo se pueden eliminar órdenes en borrador.");
        tx.remove("ordenesCompra", id);
        tx.auditar("Eliminó orden de compra", "OrdenCompra", id, oc.numero);
      }),

    /**
     * Ingreso de mercadería: genera INGRESO_COMPRA por ítem, actualiza lo recibido,
     * el costo último y el costo promedio ponderado, y la factura del proveedor.
     * Devuelve los avisos de suba de costo por encima del umbral configurado.
     */
    recibirMercaderia: (data: RecepcionInput) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "compras.recibir");
        const oc = tx.must("ordenesCompra", data.ordenCompraId);
        if (oc.estado !== "CONFIRMADA" && oc.estado !== "RECIBIDA_PARCIAL")
          throw new ErrorNegocio("Sólo se puede recibir mercadería de órdenes confirmadas.");
        if (!data.remitoProveedor.trim()) throw new ErrorNegocio("Ingresá el número de remito del proveedor.");
        const lineas = data.items.filter((i) => i.cantidad > 0);
        if (!lineas.length) throw new ErrorNegocio("Indicá al menos una cantidad recibida.");

        const avisos: AvisoSubaCosto[] = [];
        const umbral = (tx.config.umbralSubaCostoPct ?? 3) / 100;
        const recepcion: RecepcionMercaderia = {
          id: newId("rcp"),
          numero: tx.numero("RCP"),
          ordenCompraId: oc.id,
          depositoId: data.depositoId,
          remitoProveedor: data.remitoProveedor.trim(),
          fecha: data.fecha,
          items: [],
          usuarioId: tx.usuarioId,
          observaciones: data.observaciones,
          ...tx.meta(),
        };
        let neto = 0;
        const recibidoPorItem = new Map<string, number>();
        for (const l of lineas) {
          const item = oc.items.find((i) => i.id === l.itemOCId);
          if (!item) throw new ErrorNegocio("Ítem de OC inexistente.");
          const prod = tx.must("productos", item.productoId);
          const stockAntes = tx.fisicoTotal(prod.id);
          const promedio = recalcularCostoPromedio(stockAntes, prod.costoPromedio, l.cantidad, l.costoUnitario);
          const suba = variacionCosto(prod.costoUltimo, l.costoUnitario);
          if (suba > umbral) {
            const precioMay = obtenerPrecio(prod.id, "lst_may", tx.get("precios"));
            avisos.push({ productoId: prod.id, costoAnterior: prod.costoUltimo, costoNuevo: l.costoUnitario, subaPct: suba, markupMayorista: markupEfectivo(precioMay, l.costoUnitario) });
          }
          tx.patch("productos", prod.id, { costoUltimo: l.costoUnitario, costoPromedio: promedio, fechaUltimoCosto: data.fecha });
          tx.movimiento({
            productoId: prod.id,
            depositoId: data.depositoId,
            tipo: "INGRESO_COMPRA",
            cantidad: l.cantidad,
            signo: 1,
            costoUnitario: l.costoUnitario,
            referenciaTipo: "OC",
            referenciaId: oc.id,
            observacion: `Remito ${recepcion.remitoProveedor}`,
            fecha: data.fecha,
          });
          recepcion.items.push({ itemOCId: item.id, productoId: prod.id, cantidadRecibida: l.cantidad, costoUnitario: l.costoUnitario, diferencia: l.diferencia, observacion: l.observacion });
          recibidoPorItem.set(item.id, (recibidoPorItem.get(item.id) ?? 0) + l.cantidad);
          neto += l.cantidad * l.costoUnitario;
        }
        const itemsOC = oc.items.map((i) => ({ ...i, cantidadRecibida: i.cantidadRecibida + (recibidoPorItem.get(i.id) ?? 0) }));
        const completa = itemsOC.every((i) => i.cantidadRecibida >= i.cantidadPedida);
        tx.patch("ordenesCompra", oc.id, { items: itemsOC, estado: completa ? "RECIBIDA" : "RECIBIDA_PARCIAL" });

        const prov = tx.must("proveedores", oc.proveedorId);
        const iva = r2(neto * (tx.config.ivaPct / 100));
        const factura: Comprobante = {
          id: newId("cmp"),
          tipo: "FACTURA_A",
          numero: `${String((Date.now() % 9) + 1).padStart(4, "0")}-${String(Date.now() % 100_000_000).padStart(8, "0")}`,
          proveedorId: prov.id,
          recepcionId: recepcion.id,
          fecha: data.fecha,
          vencimiento: addDays(parseISO(data.fecha), diasCondicionPago(prov.condicionPago)).toISOString(),
          subtotal: r2(neto),
          iva,
          total: r2(neto + iva),
          saldoPendiente: r2(neto + iva),
          estado: "PENDIENTE",
          ...tx.meta(),
        };
        tx.insert("comprobantes", factura);
        recepcion.comprobanteId = factura.id;
        tx.insert("recepciones", recepcion);
        tx.auditar("Registró recepción de mercadería", "RecepcionMercaderia", recepcion.id, `${oc.numero} · remito ${recepcion.remitoProveedor} · ${completa ? "completa" : "parcial"}`);
        return { recepcionId: recepcion.id, numero: recepcion.numero, completa, avisos };
      }),
  };
}
