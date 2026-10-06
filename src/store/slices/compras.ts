import { addDays, parseISO } from "date-fns";
import type { AcopioProveedor, Circuito, Comprobante, DiferenciaRecepcion, EstadoOC, FormaPagoAcopio, ItemOC, OrdenCompra, OrigenVenta, RecepcionMercaderia } from "@/domain/types";
import { saldoDisponible as saldoACP } from "@/domain/acopiosProveedor";
import { formatMoney } from "@/lib/format";
import { recalcularCostoPromedio, variacionCosto } from "@/domain/costos";
import { markupEfectivo, obtenerPrecio } from "@/domain/precios";
import { diasCondicionPago } from "@/domain/ventas";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir, r2 } from "../helpers";
import type { GetFn, SetFn } from "../types";

export interface OCInput {
  proveedorId: string;
  circuito: Circuito;
  origen: OrigenVenta;
  acopioProveedorId?: string;
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
  /** Número de la factura del proveedor (compras nuevas). */
  facturaProveedor?: string;
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

export interface AcopioProveedorInput {
  proveedorId: string;
  sucursalId: string;
  depositoDestinoId: string;
  circuito: Circuito;
  fechaCreacion: string;
  fechaVencimiento: string;
  modalidad: "MONTO" | "CANTIDAD";
  importe?: number;
  items?: { productoId: string; cantidadPactada: number }[];
  formaPago: FormaPagoAcopio;
  /** productoId → costo a congelar (snapshot editable). */
  costos: Record<string, number>;
  observaciones?: string;
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
        let items = data.items.filter((i) => i.productoId && i.cantidadPedida > 0);
        if (!items.length) throw new ErrorNegocio("Agregá al menos un producto con cantidad.");
        if (data.origen === "ACOPIO") {
          if (!data.acopioProveedorId) throw new ErrorNegocio("Elegí el acopio con el proveedor.");
          const acp = tx.must("acopiosProveedor", data.acopioProveedorId);
          if (acp.proveedorId !== data.proveedorId) throw new ErrorNegocio("El acopio es de otro proveedor.");
          items = items.map((i) => {
            const c = acp.preciosCongelados.find((x) => x.productoId === i.productoId);
            if (!c) throw new ErrorNegocio(`${tx.find("productos", i.productoId)?.nombre ?? "El producto"} no está en el acopio con el proveedor.`);
            return { ...i, costoUnitario: c.costo, descuentoPct: 0 };
          });
          const otras = tx.get("ordenesCompra").filter((o) => o.id !== id);
          const saldo = saldoACP(acp, otras);
          const monto = items.reduce((a, i) => a + i.cantidadPedida * i.costoUnitario, 0);
          if (acp.modalidad === "MONTO" && monto > saldo + 0.01) throw new ErrorNegocio(`El retiro (${formatMoney(monto)}) supera el saldo del acopio (${formatMoney(saldo)}).`);
          if (acp.modalidad === "CANTIDAD")
            for (const it of items) {
              const pactado = acp.items?.find((x) => x.productoId === it.productoId)?.cantidadPactada ?? 0;
              const pedido = otras.filter((o) => o.acopioProveedorId === acp.id && o.estado !== "CANCELADA" && o.estado !== "BORRADOR").flatMap((o) => o.items).filter((x) => x.productoId === it.productoId).reduce((a, x) => a + x.cantidadPedida, 0);
              if (it.cantidadPedida > pactado - pedido + 1e-9) throw new ErrorNegocio(`Del acopio quedan ${pactado - pedido} por retirar de ${tx.find("productos", it.productoId)?.nombre}.`);
            }
        }
        const tot = totalesOC(items, data.circuito === 1 ? tx.config.ivaPct : 0);
        if (id) {
          const oc = tx.must("ordenesCompra", id);
          if (oc.estado !== "BORRADOR") throw new ErrorNegocio("Sólo se pueden editar órdenes en borrador.");
          tx.patch("ordenesCompra", id, { ...data, items, ...tot });
          tx.auditar("Editó orden de compra", "OrdenCompra", id, oc.numero);
          return id;
        }
        const oc: OrdenCompra = {
          id: newId("oc"),
          numero: tx.numero("OC", data.circuito, "0001"),
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
          numero: tx.numero("RCP", null, "0001"),
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
        // Retiro de acopio: no genera deuda nueva (el acopio ya está facturado / pagado).
        if (oc.origen !== "ACOPIO") {
          const iva = r2(neto * ((oc.circuito === 1 ? tx.config.ivaPct : 0) / 100));
          const factura: Comprobante = {
            id: newId("cmp"),
            tipo: "FACTURA",
            letra: oc.circuito === 1 ? "A" : undefined,
            circuito: oc.circuito,
            numero: data.facturaProveedor?.trim() || `FC ${oc.circuito === 1 ? "A" : "X"} ${recepcion.remitoProveedor.replace(/^\D+/, "").trim()}`,
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
        }
        tx.insert("recepciones", recepcion);
        tx.auditar("Registró recepción de mercadería", "RecepcionMercaderia", recepcion.id, `${oc.numero} · remito ${recepcion.remitoProveedor} · ${completa ? "completa" : "parcial"}`);
        return { recepcionId: recepcion.id, numero: recepcion.numero, completa, avisos };
      }),

    reclamarOC: (id: string, texto: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "compras.editar");
        const oc = tx.must("ordenesCompra", id);
        tx.patch("ordenesCompra", id, { reclamos: [...(oc.reclamos ?? []), `${tx.ahora} · ${texto}`] });
        tx.auditar("Reclamó entrega al proveedor", "OrdenCompra", id, `${oc.numero} · ${texto}`);
      }),

    /** Acopio con proveedor: congela costos, genera la factura de compra y, si es anticipo, queda listo para la OP. */
    crearAcopioProveedor: (data: AcopioProveedorInput) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "acopiosProveedor.editar");
        const prov = tx.must("proveedores", data.proveedorId);
        const preciosCongelados = Object.entries(data.costos).filter(([, c]) => c > 0).map(([productoId, costo]) => ({ productoId, costo: r2(costo) }));
        if (!preciosCongelados.length) throw new ErrorNegocio("No hay costos para congelar.");
        let importe = data.importe ?? 0;
        let items: AcopioProveedor["items"];
        if (data.modalidad === "CANTIDAD") {
          items = (data.items ?? []).filter((i) => i.cantidadPactada > 0);
          if (!items.length) throw new ErrorNegocio("Indicá las cantidades pactadas.");
          importe = r2(items.reduce((a, i) => a + i.cantidadPactada * (data.costos[i.productoId] ?? 0), 0));
        }
        if (!(importe > 0)) throw new ErrorNegocio("Ingresá el importe del acopio.");
        const acp: AcopioProveedor = {
          id: newId("acp"),
          numero: tx.numero("ACP", data.circuito, "0001"),
          circuito: data.circuito,
          proveedorId: prov.id,
          sucursalId: data.sucursalId,
          depositoDestinoId: data.depositoDestinoId,
          fechaCreacion: data.fechaCreacion,
          fechaVencimiento: data.fechaVencimiento,
          modalidad: data.modalidad,
          importe,
          formaPago: data.formaPago,
          preciosCongelados,
          items,
          pagado: 0,
          comprobanteCompraIds: [],
          ordenPagoIds: [],
          estado: "VIGENTE",
          observaciones: data.observaciones,
          ...tx.meta(),
        };
        const subtotal = data.circuito === 1 ? r2(importe / 1.21) : importe;
        const fac: Comprobante = {
          id: newId("cmp"),
          tipo: "FACTURA",
          letra: data.circuito === 1 ? "A" : undefined,
          circuito: data.circuito,
          numero: `FC ${data.circuito === 1 ? "A" : "X"} ${String(Math.floor(Math.random() * 9) + 1).padStart(4, "0")}-${String(Date.now() % 100_000_000).padStart(8, "0")}`,
          proveedorId: prov.id,
          acopioProveedorId: acp.id,
          fecha: data.fechaCreacion,
          vencimiento: addDays(parseISO(data.fechaCreacion), data.formaPago === "ANTICIPO" ? 0 : diasCondicionPago(prov.condicionPago)).toISOString(),
          subtotal,
          iva: r2(importe - subtotal),
          total: importe,
          saldoPendiente: importe,
          estado: "PENDIENTE",
          observaciones: `Acopio ${acp.numero}`,
          ...tx.meta(),
        };
        acp.comprobanteCompraIds.push(fac.id);
        tx.insert("acopiosProveedor", acp);
        tx.insert("comprobantes", fac);
        tx.auditar("Creó acopio con proveedor", "AcopioProveedor", acp.id, `${acp.numero} · ${prov.razonSocial} · ${formatMoney(importe)}`);
        return { id: acp.id, numero: acp.numero, comprobanteId: fac.id };
      }),

    extenderVencimientoACP: (id: string, fecha: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "acopiosProveedor.editar");
        const a = tx.must("acopiosProveedor", id);
        tx.patch("acopiosProveedor", id, { fechaVencimiento: fecha, estado: a.estado === "VENCIDO" ? "VIGENTE" : a.estado });
        tx.auditar("Extendió vencimiento de acopio con proveedor", "AcopioProveedor", id, `${a.numero} → ${fecha.slice(0, 10)}`);
      }),

    cancelarACP: (id: string, motivo: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "acopiosProveedor.editar");
        const a = tx.must("acopiosProveedor", id);
        tx.patch("acopiosProveedor", id, { estado: "CANCELADO", observaciones: [a.observaciones, `Cancelado: ${motivo}`].filter(Boolean).join(" · ") });
        tx.auditar("Canceló acopio con proveedor", "AcopioProveedor", id, `${a.numero} · ${motivo}`);
      }),
  };
}
