/** Extracto de cuenta corriente (cliente o proveedor): debe, haber y saldo corrido. */
import type { EstadoInicial } from "./types";
import { diasAtraso, esNCAnulacion } from "./cuentasCorrientes";
import { MEDIO_PAGO_LABEL, TIPO_COMPROBANTE_LABEL } from "./estados";

export interface MovimientoCuenta {
  id: string;
  fecha: string;
  concepto: string;
  numero: string;
  href?: string;
  debe: number;
  haber: number;
  saldo: number;
  pendiente?: number;
  vencimiento?: string;
  atraso?: number;
}

/** Extracto cronológico: debe (facturas), haber (cobros/pagos y notas de crédito) y saldo acumulado. */
export function extracto(db: EstadoInicial, tipo: "cliente" | "proveedor", id: string): MovimientoCuenta[] {
  const out: Omit<MovimientoCuenta, "saldo">[] = [];
  const hoy = new Date();
  for (const c of db.comprobantes) {
    if (tipo === "cliente" ? c.clienteId !== id : c.proveedorId !== id) continue;
    // El saldo a favor de un recibo ya figura en el recibo; el saldo inicial a favor se muestra como haber.
    if (c.tipo === "SALDO_A_FAVOR" && !c.numero.startsWith("SI")) continue;
    // NC de devoluciones de acopio: vuelven al saldo del acopio, no a la cuenta corriente.
    if (c.tipo === "NOTA_CREDITO" && c.acopioId && !c.aplicadoA?.length && Math.abs(c.saldoPendiente) < 0.01) continue;
    // Factura anulada sin nota de crédito (interna o sin CAE): no cuenta en el saldo.
    // (las NC de una factura anulada sin CAE también quedan anuladas y se saltean).
    if (c.estado === "ANULADO" && (c.tipo !== "FACTURA" || !db.comprobantes.some((n) => esNCAnulacion(n) && n.comprobanteOrigenId === c.id))) continue;
    // Saldos a favor liberados al anular una factura: se muestran como el recibo.
    if (c.tipo === "SALDO_A_FAVOR" && c.numero.includes("anulación")) continue;
    const esDebe = c.tipo !== "NOTA_CREDITO" && c.tipo !== "SALDO_A_FAVOR";
    const ref = c.notaPedidoId ? db.notasPedido.find((p) => p.id === c.notaPedidoId)?.numero : c.acopioId ? db.acopios.find((a) => a.id === c.acopioId)?.numero : c.recepcionId ? db.ordenesCompra.find((o) => o.id === db.recepciones.find((r) => r.id === c.recepcionId)?.ordenCompraId)?.numero : undefined;
    out.push({
      id: c.id,
      fecha: c.fecha,
      concepto: `${TIPO_COMPROBANTE_LABEL[c.tipo]}${ref ? ` · ${ref}` : ""}${c.estado === "ANULADO" ? " (anulada)" : ""}`,
      numero: c.numero,
      href: c.notaPedidoId ? `/ventas/notas-pedido/${c.notaPedidoId}` : c.acopioId ? `/acopios/${c.acopioId}` : c.recepcionId ? `/compras/recepciones?id=${c.recepcionId}` : undefined,
      debe: esDebe ? c.total : 0,
      haber: esDebe ? 0 : c.total,
      pendiente: esDebe && c.estado !== "ANULADO" && c.saldoPendiente > 0.009 ? c.saldoPendiente : undefined,
      vencimiento: c.vencimiento,
      atraso: esDebe && c.saldoPendiente > 0.009 ? diasAtraso(c, hoy) : undefined,
    });
  }
  if (tipo === "cliente")
    for (const cob of db.cobranzas.filter((x) => !x.anulado && x.clienteId === id))
      out.push({ id: cob.id, fecha: cob.fecha, concepto: `Recibo · ${cob.medios.map((m) => MEDIO_PAGO_LABEL[m.medio]).join(", ")}`, numero: cob.numero, href: `/ventas/recibos?id=${cob.id}`, debe: 0, haber: cob.total });
  else
    for (const op of db.pagosProveedores.filter((x) => !x.anulado && x.proveedorId === id))
      out.push({ id: op.id, fecha: op.fecha, concepto: `Orden de pago · ${op.medios.map((m) => (m.chequeId ? "Cheque de terceros" : MEDIO_PAGO_LABEL[m.medio])).join(", ")}`, numero: op.numero, href: `/compras/ordenes-pago?id=${op.id}`, debe: 0, haber: op.total });
  // Las facturas anuladas: la NC espejo las compensa, se muestran ambas.
  out.sort((a, b) => a.fecha.localeCompare(b.fecha) || b.debe - a.debe);
  let saldo = 0;
  return out.map((m) => ({ ...m, saldo: (saldo += m.debe - m.haber) }));
}

