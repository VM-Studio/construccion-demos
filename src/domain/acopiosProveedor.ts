/**
 * Acopios con proveedores: Aceros RNF paga (o pacta en cuenta corriente) un importe
 * o una cantidad, congela costos y va retirando con órdenes de compra origen ACOPIO.
 */
import type { AcopioProveedor, OrdenCompra, Producto } from "./types";

const ACTIVAS = new Set(["ENVIADA", "CONFIRMADA", "RECIBIDA_PARCIAL", "RECIBIDA"]);

export function ordenesDelAcopio(acp: Pick<AcopioProveedor, "id">, ocs: OrdenCompra[]): OrdenCompra[] {
  return ocs.filter((o) => o.acopioProveedorId === acp.id && o.origen === "ACOPIO" && ACTIVAS.has(o.estado));
}

const neto = (i: OrdenCompra["items"][number], cant: number) => cant * i.costoUnitario * (1 - (i.descuentoPct || 0) / 100);

/** $ pedido contra el acopio (OC emitidas a costo congelado). */
export function pedidoAcopio(acp: AcopioProveedor, ocs: OrdenCompra[]): number {
  return ordenesDelAcopio(acp, ocs).reduce((a, o) => a + o.items.reduce((s, i) => s + neto(i, i.cantidadPedida), 0), 0);
}

/** $ efectivamente retirado (recibido) a costo congelado. */
export function retiradoAcopioProveedor(acp: AcopioProveedor, ocs: OrdenCompra[]): number {
  return ordenesDelAcopio(acp, ocs).reduce((a, o) => a + o.items.reduce((s, i) => s + neto(i, i.cantidadRecibida), 0), 0);
}

/** Saldo disponible para pedir: importe − Σ OC emitidas contra el acopio. */
export function saldoDisponible(acp: AcopioProveedor, ocs: OrdenCompra[]): number {
  return Math.round((acp.importe - pedidoAcopio(acp, ocs)) * 100) / 100;
}

export interface PendienteRetirar {
  productoId: string;
  pactado: number;
  recibido: number;
  pendiente: number;
  costo: number;
  pendientePesos: number;
}

/** Pendiente de retirar = pactado − recibido (por producto en acopios por cantidad; en $ en acopios por monto). */
export function pendienteRetirar(acp: AcopioProveedor, ocs: OrdenCompra[]): { porProducto: PendienteRetirar[]; pesos: number } {
  const recibido = new Map<string, number>();
  for (const o of ordenesDelAcopio(acp, ocs)) for (const i of o.items) recibido.set(i.productoId, (recibido.get(i.productoId) ?? 0) + i.cantidadRecibida);
  const costo = (pid: string) => acp.preciosCongelados.find((c) => c.productoId === pid)?.costo ?? 0;
  if (acp.modalidad === "CANTIDAD" && acp.items?.length) {
    const porProducto = acp.items.map((it) => {
      const r = recibido.get(it.productoId) ?? 0;
      const pend = Math.max(0, it.cantidadPactada - r);
      return { productoId: it.productoId, pactado: it.cantidadPactada, recibido: r, pendiente: pend, costo: costo(it.productoId), pendientePesos: pend * costo(it.productoId) };
    });
    return { porProducto, pesos: porProducto.reduce((a, p) => a + p.pendientePesos, 0) };
  }
  const pesos = Math.max(0, acp.importe - retiradoAcopioProveedor(acp, ocs));
  const porProducto = [...recibido.entries()].map(([pid, r]) => ({ productoId: pid, pactado: 0, recibido: r, pendiente: 0, costo: costo(pid), pendientePesos: 0 }));
  return { porProducto, pesos };
}

/** Lo que le debemos al proveedor por este acopio (cuenta corriente): importe − pagado. */
export function deudaConProveedor(acp: Pick<AcopioProveedor, "formaPago" | "importe" | "pagado" | "estado">): number {
  if (acp.estado === "CANCELADO") return 0;
  return acp.formaPago === "CUENTA_CORRIENTE" ? Math.max(0, acp.importe - acp.pagado) : 0;
}

/** Artículos del acopio con costo congelado y saldos. */
export function resumenArticulos(acp: AcopioProveedor, ocs: OrdenCompra[], productos: Producto[]) {
  const prod = new Map(productos.map((p) => [p.id, p]));
  const pedido = new Map<string, number>();
  const recibido = new Map<string, number>();
  for (const o of ordenesDelAcopio(acp, ocs))
    for (const i of o.items) {
      pedido.set(i.productoId, (pedido.get(i.productoId) ?? 0) + i.cantidadPedida);
      recibido.set(i.productoId, (recibido.get(i.productoId) ?? 0) + i.cantidadRecibida);
    }
  return acp.preciosCongelados
    .map((c) => {
      const p = prod.get(c.productoId);
      const pactado = acp.items?.find((i) => i.productoId === c.productoId)?.cantidadPactada ?? 0;
      return {
        productoId: c.productoId,
        codigo: p?.codigo ?? "",
        articulo: p?.nombre ?? "",
        costo: c.costo,
        costoActual: p?.costoUltimo ?? c.costo,
        pactado,
        pedido: pedido.get(c.productoId) ?? 0,
        recibido: recibido.get(c.productoId) ?? 0,
        saldo: pactado ? pactado - (recibido.get(c.productoId) ?? 0) : -(recibido.get(c.productoId) ?? 0),
      };
    })
    .sort((a, b) => Number(a.codigo) - Number(b.codigo) || a.codigo.localeCompare(b.codigo));
}

/** Ahorro: cuánto más costaría hoy lo pendiente vs el costo congelado. */
export function ahorroAcopio(acp: AcopioProveedor, ocs: OrdenCompra[], productos: Producto[]): number {
  const prod = new Map(productos.map((p) => [p.id, p]));
  return pendienteRetirar(acp, ocs).porProducto.reduce((a, p) => a + p.pendiente * ((prod.get(p.productoId)?.costoUltimo ?? p.costo) - p.costo), 0);
}
