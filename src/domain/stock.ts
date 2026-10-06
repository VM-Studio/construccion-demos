/**
 * Disponibilidad de stock. Por producto y depósito:
 * - Físico: Σ movimientos.
 * - Pendiente de entrega: lo vendido o retirado de acopio (NP confirmadas) que sigue en el galpón.
 * - Reservado: cantidades de remitos en PICKING (ya se están preparando).
 * - Disponible para vender = Físico − Pendiente de entrega − Reservado.
 * - En tránsito: OC confirmadas sin recibir (+ por retirar de acopios con proveedores por cantidad).
 */
import type { AcopioProveedor, NotaPedido, OrdenCompra, Producto, Remito, TransferenciaStock } from "./types";
import { pendienteLinea } from "./acopios";

const NP_ACTIVAS = new Set(["PENDIENTE", "ENTREGADA_PARCIAL"]);

/** Cantidad de cada línea de NP que está en remitos en PICKING (reservada). */
export function reservadoPorLinea(remitos: Remito[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of remitos)
    if (r.estado === "PICKING") for (const it of r.items) if (it.itemNPId) m.set(it.itemNPId, (m.get(it.itemNPId) ?? 0) + it.cantidad);
  return m;
}

export interface LineaPendiente {
  notaPedidoId: string;
  itemId: string;
  clienteId: string;
  obraId?: string;
  productoId: string;
  depositoId: string;
  pendiente: number;
  precio: number;
}

/** Líneas de NP con pendiente de entrega (sin contar lo que ya está en picking). */
export function lineasPendientes(notas: NotaPedido[], remitos: Remito[]): LineaPendiente[] {
  const res = reservadoPorLinea(remitos);
  const out: LineaPendiente[] = [];
  for (const n of notas) {
    if (!NP_ACTIVAS.has(n.estado)) continue;
    for (const it of n.items) {
      const p = pendienteLinea(it) - (res.get(it.id) ?? 0);
      if (p > 0.0005) out.push({ notaPedidoId: n.id, itemId: it.id, clienteId: n.clienteId, obraId: it.obraId, productoId: it.productoId, depositoId: n.depositoId, pendiente: p, precio: it.precioUnitario });
    }
  }
  return out;
}

export function calcularPendienteEntrega(productoId: string, depositoId: string, notas: NotaPedido[], remitos: Remito[]): number {
  return lineasPendientes(notas, remitos)
    .filter((l) => l.productoId === productoId && l.depositoId === depositoId)
    .reduce((a, l) => a + l.pendiente, 0);
}

export function calcularReservado(productoId: string, depositoId: string, remitos: Remito[]): number {
  let q = 0;
  for (const r of remitos) if (r.estado === "PICKING" && r.depositoId === depositoId && (r.tipo === "VENTA" || r.tipo === "DESACOPIO")) for (const it of r.items) if (it.productoId === productoId) q += it.cantidad;
  return q;
}

/** OC confirmadas sin recibir hacia ese depósito. */
export function calcularEnTransito(productoId: string, depositoId: string, ordenesCompra: OrdenCompra[]): number {
  let q = 0;
  for (const oc of ordenesCompra) {
    if (oc.depositoDestinoId !== depositoId || (oc.estado !== "CONFIRMADA" && oc.estado !== "RECIBIDA_PARCIAL")) continue;
    for (const it of oc.items) if (it.productoId === productoId) q += Math.max(0, it.cantidadPedida - it.cantidadRecibida);
  }
  return q;
}

/** Unidades por retirar de acopios con proveedores por cantidad (aún no pedidas en OC). */
export function porRetirarAcopiosProveedor(productoId: string, depositoId: string, acopios: AcopioProveedor[], ordenesCompra: OrdenCompra[]): number {
  let q = 0;
  for (const a of acopios) {
    if (a.depositoDestinoId !== depositoId || a.modalidad !== "CANTIDAD" || a.estado === "CANCELADO") continue;
    const pactado = a.items?.find((i) => i.productoId === productoId)?.cantidadPactada ?? 0;
    if (!pactado) continue;
    let pedido = 0;
    for (const o of ordenesCompra) if (o.acopioProveedorId === a.id && !["BORRADOR", "CANCELADA"].includes(o.estado)) for (const i of o.items) if (i.productoId === productoId) pedido += i.cantidadPedida;
    q += Math.max(0, pactado - pedido);
  }
  return q;
}

export function calcularEnTransferencia(productoId: string, transferencias: TransferenciaStock[], depositoDestinoId?: string): number {
  let q = 0;
  for (const t of transferencias) {
    if (t.estado !== "EN_TRANSITO" || (depositoDestinoId && t.depositoDestinoId !== depositoDestinoId)) continue;
    for (const it of t.items) if (it.productoId === productoId) q += it.cantidad;
  }
  return q;
}

/** Disponible para vender = físico − pendiente de entrega − reservado. */
export function calcularDisponible(fisico: number, pendienteEntrega: number, reservado = 0): number {
  return fisico - pendienteEntrega - reservado;
}

export function estaBajoMinimo(producto: Pick<Producto, "stockMinimo">, fisico: number): boolean {
  return producto.stockMinimo > 0 && fisico < producto.stockMinimo;
}

export type EstadoStock = "OK" | "BAJO_MINIMO" | "SIN_STOCK";

export function estadoStock(producto: Pick<Producto, "stockMinimo">, fisico: number): EstadoStock {
  if (fisico <= 0) return "SIN_STOCK";
  if (estaBajoMinimo(producto, fisico)) return "BAJO_MINIMO";
  return "OK";
}
