import type {
  Acopio,
  AjusteStock,
  Despacho,
  MovimientoStock,
  Pedido,
  Producto,
  RecepcionMercaderia,
  StockDeposito,
  TipoMovimientoStock,
  TransferenciaStock,
} from "@/domain/types";
import { recalcularCostoPromedio } from "@/domain/costos";

export interface EntradaMovimientos {
  productos: Producto[];
  depositos: string[];
  recepciones: RecepcionMercaderia[];
  despachos: Despacho[];
  transferencias: TransferenciaStock[];
  ajustes: AjusteStock[];
  pedidos: Pedido[];
  acopios: Acopio[];
  /** Costo de arranque por producto (antes del primer ingreso). */
  costoInicial: Map<string, number>;
}

export interface SalidaMovimientos {
  movimientos: MovimientoStock[];
  stock: StockDeposito[];
  costos: Map<string, { costoUltimo: number; costoPromedio: number; fechaUltimoCosto: string }>;
  /** Costo promedio vigente al confirmar cada línea de pedido / acopio. */
  snapshots: Map<string, number>;
  /** Mínimo histórico de stock por producto|depósito (para validar que nunca fue negativo). */
  minimos: Map<string, number>;
  finales: Map<string, number>;
}

type Evento =
  | { fecha: string; orden: number; tipo: "MOV"; productoId: string; depositoId: string; mov: TipoMovimientoStock; cantidad: number; signo: 1 | -1; costo?: number; refTipo: MovimientoStock["referenciaTipo"]; refId: string; usuarioId: string; obs?: string }
  | { fecha: string; orden: number; tipo: "SNAP"; itemId: string; productoId: string };

const key = (p: string, d: string) => `${p}|${d}`;

/**
 * Deriva los movimientos de stock (kardex), el stock físico final y la evolución
 * de costos a partir de las operaciones: recepciones, despachos con egreso,
 * transferencias y ajustes. También congela el costo snapshot de cada línea de
 * pedido confirmada y de cada acopio, con el costo promedio vigente en ese momento.
 *
 * Así los kardex cierran por construcción: stock físico = Σ movimientos.
 */
export function generarMovimientosDesdeOperaciones(e: EntradaMovimientos): SalidaMovimientos {
  const eventos: Evento[] = [];

  for (const a of e.ajustes)
    for (const it of a.items)
      eventos.push({
        fecha: a.fecha,
        orden: 0,
        tipo: "MOV",
        productoId: it.productoId,
        depositoId: a.depositoId,
        mov: it.signo === 1 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO",
        cantidad: it.cantidad,
        signo: it.signo,
        refTipo: "AJUSTE",
        refId: a.id,
        usuarioId: a.usuarioId,
        obs: a.observacion,
      });

  for (const r of e.recepciones)
    for (const it of r.items)
      eventos.push({
        fecha: r.fecha,
        orden: 1,
        tipo: "MOV",
        productoId: it.productoId,
        depositoId: r.depositoId,
        mov: "INGRESO_COMPRA",
        cantidad: it.cantidadRecibida,
        signo: 1,
        costo: it.costoUnitario,
        refTipo: "OC",
        refId: r.ordenCompraId,
        usuarioId: r.usuarioId,
        obs: `Remito ${r.remitoProveedor}`,
      });

  for (const t of e.transferencias) {
    if (t.fechaDespacho && t.estado !== "CANCELADA")
      for (const it of t.items)
        eventos.push({ fecha: t.fechaDespacho, orden: 2, tipo: "MOV", productoId: it.productoId, depositoId: t.depositoOrigenId, mov: "TRANSFERENCIA_SALIDA", cantidad: it.cantidad, signo: -1, refTipo: "TRANSFERENCIA", refId: t.id, usuarioId: t.usuarioId });
    if (t.fechaRecepcion && t.estado === "RECIBIDA")
      for (const it of t.items)
        eventos.push({ fecha: t.fechaRecepcion, orden: 1, tipo: "MOV", productoId: it.productoId, depositoId: t.depositoDestinoId, mov: "TRANSFERENCIA_ENTRADA", cantidad: it.cantidad, signo: 1, refTipo: "TRANSFERENCIA", refId: t.id, usuarioId: t.usuarioId });
  }

  for (const d of e.despachos) {
    if (!d.egresoGenerado) continue;
    const fecha = d.fechaSalida ?? d.fechaEntrega ?? d.fechaProgramada;
    for (const it of d.items)
      eventos.push({
        fecha,
        orden: 3,
        tipo: "MOV",
        productoId: it.productoId,
        depositoId: d.depositoId,
        mov: d.origenTipo === "PEDIDO" ? "EGRESO_VENTA" : "EGRESO_ACOPIO",
        cantidad: it.cantidad,
        signo: -1,
        refTipo: "DESPACHO",
        refId: d.id,
        usuarioId: "usr_jorge",
        obs: undefined,
      });
  }

  for (const p of e.pedidos) {
    if (!p.fechaConfirmacion) continue;
    for (const it of p.items) eventos.push({ fecha: p.fechaConfirmacion, orden: 2, tipo: "SNAP", itemId: it.id, productoId: it.productoId });
  }
  for (const a of e.acopios)
    for (const it of a.items) eventos.push({ fecha: a.fechaInicio, orden: 2, tipo: "SNAP", itemId: it.id, productoId: it.productoId });

  eventos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden);

  const fisico = new Map<string, number>();
  const totalProducto = new Map<string, number>();
  const minimos = new Map<string, number>();
  const costos = new Map<string, { costoUltimo: number; costoPromedio: number; fechaUltimoCosto: string }>();
  for (const p of e.productos) {
    const c = e.costoInicial.get(p.id) ?? p.costoUltimo;
    costos.set(p.id, { costoUltimo: c, costoPromedio: c, fechaUltimoCosto: p.fechaUltimoCosto });
  }
  const snapshots = new Map<string, number>();
  const movimientos: MovimientoStock[] = [];
  let n = 0;

  for (const ev of eventos) {
    const costo = costos.get(ev.productoId)!;
    if (ev.tipo === "SNAP") {
      snapshots.set(ev.itemId, costo.costoPromedio);
      continue;
    }
    const k = key(ev.productoId, ev.depositoId);
    const antes = fisico.get(k) ?? 0;
    const totalAntes = totalProducto.get(ev.productoId) ?? 0;
    let costoUnit = costo.costoPromedio;
    if (ev.mov === "INGRESO_COMPRA" && ev.costo !== undefined) {
      costo.costoPromedio = recalcularCostoPromedio(totalAntes, costo.costoPromedio, ev.cantidad, ev.costo);
      costo.costoUltimo = ev.costo;
      costo.fechaUltimoCosto = ev.fecha;
      costoUnit = ev.costo;
    }
    const despues = antes + ev.signo * ev.cantidad;
    fisico.set(k, despues);
    totalProducto.set(ev.productoId, totalAntes + ev.signo * ev.cantidad);
    minimos.set(k, Math.min(minimos.get(k) ?? 0, despues));
    movimientos.push({
      id: `mov_${String(++n).padStart(6, "0")}`,
      productoId: ev.productoId,
      depositoId: ev.depositoId,
      tipo: ev.mov,
      cantidad: ev.cantidad,
      signo: ev.signo,
      costoUnitario: costoUnit,
      referenciaTipo: ev.refTipo,
      referenciaId: ev.refId,
      usuarioId: ev.usuarioId,
      observacion: ev.obs,
      fecha: ev.fecha,
      creadoEn: ev.fecha,
      actualizadoEn: ev.fecha,
    });
  }

  const stock: StockDeposito[] = [];
  for (const p of e.productos)
    for (const d of e.depositos)
      stock.push({
        id: `stk_${p.id}_${d}`,
        productoId: p.id,
        depositoId: d,
        cantidadFisica: Math.round((fisico.get(key(p.id, d)) ?? 0) * 1000) / 1000,
        creadoEn: e.productos[0]?.creadoEn ?? new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      });

  return { movimientos, stock, costos, snapshots, minimos, finales: fisico };
}
