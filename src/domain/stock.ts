import type { Acopio, Despacho, OrdenCompra, Pedido, Producto, TransferenciaStock } from "./types";

const ESTADOS_PEDIDO_QUE_COMPROMETEN = new Set(["CONFIRMADO", "EN_PREPARACION", "DESPACHADO_PARCIAL", "DESPACHADO", "FACTURADO"]);
const ESTADOS_ACOPIO_CON_SALDO = new Set(["VIGENTE", "RETIRADO_PARCIAL", "VENCIDO"]);

/** Cantidad de un ítem de pedido que todavía no salió del depósito. */
export function pendienteDespachoItem(item: { cantidad: number; cantidadDespachada?: number }): number {
  return Math.max(0, item.cantidad - (item.cantidadDespachada ?? 0));
}

/**
 * Detalle de lo que compromete stock de un producto en un depósito.
 * Comprometido = pedidos confirmados sin despachar + saldos de acopio sin retirar
 * + retiros de acopio registrados con envío cuyo egreso todavía no se generó.
 */
export function detalleComprometido(
  productoId: string,
  depositoId: string,
  pedidos: Pedido[],
  acopios: Acopio[],
  despachos: Despacho[] = [],
): { tipo: "PEDIDO" | "ACOPIO"; id: string; numero: string; clienteId: string; cantidad: number }[] {
  const out: { tipo: "PEDIDO" | "ACOPIO"; id: string; numero: string; clienteId: string; cantidad: number }[] = [];
  for (const p of pedidos) {
    if (p.depositoId !== depositoId || !ESTADOS_PEDIDO_QUE_COMPROMETEN.has(p.estado)) continue;
    let q = 0;
    for (const it of p.items) if (it.productoId === productoId) q += pendienteDespachoItem(it);
    if (q > 0) out.push({ tipo: "PEDIDO", id: p.id, numero: p.numero, clienteId: p.clienteId, cantidad: q });
  }
  const acopiosPorId = new Map(acopios.map((a) => [a.id, a]));
  const pendienteEnDespachos = new Map<string, number>();
  for (const d of despachos) {
    if (d.origenTipo !== "RETIRO_ACOPIO" || d.depositoId !== depositoId || d.egresoGenerado || d.estado === "CANCELADO") continue;
    if (!d.acopioId) continue;
    for (const it of d.items)
      if (it.productoId === productoId) pendienteEnDespachos.set(d.acopioId, (pendienteEnDespachos.get(d.acopioId) ?? 0) + it.cantidad);
  }
  for (const a of acopios) {
    if (a.depositoId !== depositoId) continue;
    let q = 0;
    if (ESTADOS_ACOPIO_CON_SALDO.has(a.estado))
      for (const it of a.items) if (it.productoId === productoId) q += Math.max(0, it.cantidadAcopiada - it.cantidadRetirada);
    q += pendienteEnDespachos.get(a.id) ?? 0;
    if (q > 0) out.push({ tipo: "ACOPIO", id: a.id, numero: a.numero, clienteId: a.clienteId, cantidad: q });
  }
  // Acopios no listados (p. ej. cancelados) con despachos aún sin egreso
  for (const [acopioId, q] of pendienteEnDespachos) {
    if (acopiosPorId.get(acopioId)?.depositoId === depositoId) continue;
    const a = acopiosPorId.get(acopioId);
    if (a) out.push({ tipo: "ACOPIO", id: a.id, numero: a.numero, clienteId: a.clienteId, cantidad: q });
  }
  return out;
}

/** Stock comprometido de un producto en un depósito. */
export function calcularComprometido(
  productoId: string,
  depositoId: string,
  pedidos: Pedido[],
  acopios: Acopio[],
  despachos: Despacho[] = [],
): number {
  return detalleComprometido(productoId, depositoId, pedidos, acopios, despachos).reduce((a, d) => a + d.cantidad, 0);
}

/** Cantidad en tránsito: OC confirmadas (o recibidas parcial) aún no recibidas, hacia ese depósito. */
export function calcularEnTransito(productoId: string, depositoId: string, ordenesCompra: OrdenCompra[]): number {
  let q = 0;
  for (const oc of ordenesCompra) {
    if (oc.depositoDestinoId !== depositoId) continue;
    if (oc.estado !== "CONFIRMADA" && oc.estado !== "RECIBIDA_PARCIAL") continue;
    for (const it of oc.items)
      if (it.productoId === productoId) q += Math.max(0, it.cantidadPedida - it.cantidadRecibida);
  }
  return q;
}

/** Cantidad en viaje entre depósitos (transferencias despachadas sin recibir). */
export function calcularEnTransferencia(productoId: string, transferencias: TransferenciaStock[], depositoDestinoId?: string): number {
  let q = 0;
  for (const t of transferencias) {
    if (t.estado !== "EN_TRANSITO") continue;
    if (depositoDestinoId && t.depositoDestinoId !== depositoDestinoId) continue;
    for (const it of t.items) if (it.productoId === productoId) q += it.cantidad;
  }
  return q;
}

/** Disponible = físico − comprometido (puede ser negativo si hay backorder). */
export function calcularDisponible(fisico: number, comprometido: number): number {
  return fisico - comprometido;
}

/** True si el stock físico total está por debajo del mínimo configurado. */
export function estaBajoMinimo(producto: Pick<Producto, "stockMinimo">, fisico: number): boolean {
  return producto.stockMinimo > 0 && fisico < producto.stockMinimo;
}

export type EstadoStock = "OK" | "BAJO_MINIMO" | "SIN_STOCK";

export function estadoStock(producto: Pick<Producto, "stockMinimo">, fisico: number): EstadoStock {
  if (fisico <= 0) return "SIN_STOCK";
  if (estaBajoMinimo(producto, fisico)) return "BAJO_MINIMO";
  return "OK";
}
