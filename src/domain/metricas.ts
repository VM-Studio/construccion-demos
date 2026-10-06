/**
 * Métricas de negocio puras para tablero y reportes.
 * Ventas = facturado neto (facturas − notas de crédito de clientes, incluye la facturación de acopios).
 * Margen = notas de pedido confirmadas (ventas nuevas a costo snapshot y retiros de acopio a precio congelado).
 */
import { differenceInCalendarDays, parseISO, startOfDay, startOfWeek, format } from "date-fns";
import type { Comprobante, EstadoInicial, NotaPedido } from "./types";
import { calcularRentabilidadPedido, calcularRentabilidadItem } from "./ventas";

export interface Rango {
  desde: string;
  hasta: string;
}

export interface FiltroMetricas {
  sucursalId: string | null;
  /** Unidad de negocio (null = todas). */
  unidadNegocioId?: string | null;
  /** false = excluir circuito 2. */
  circuito2?: boolean;
}

const enRango = (f: string | undefined, r: Rango) => !!f && f >= r.desde && f <= r.hasta;
const filtroDe = (f: FiltroMetricas | string | null): FiltroMetricas => (typeof f === "string" || f === null ? { sucursalId: f } : f);

/** Facturas y notas de crédito de clientes, no anuladas, según filtro. */
export function comprobantesVenta(comprobantes: Comprobante[], filtro: FiltroMetricas | string | null) {
  const f = filtroDe(filtro);
  return comprobantes.filter(
    (c) => c.clienteId && (c.tipo === "FACTURA" || c.tipo === "NOTA_CREDITO") && (!f.sucursalId || c.sucursalId === f.sucursalId) && (f.circuito2 !== false || c.circuito !== 2),
  );
}

/** Importe neto (sin IVA) con signo: NC resta. */
export function netoVenta(c: Comprobante): number {
  if (c.estado === "ANULADO") return 0;
  return c.tipo === "NOTA_CREDITO" ? -c.subtotal : c.subtotal;
}

/** Reparto del neto de un comprobante por unidad de negocio (según sus ítems, su NP o su acopio). */
export function netoPorUN(c: Comprobante, db: Pick<EstadoInicial, "productos" | "notasPedido" | "acopios">): Record<string, number> {
  const neto = netoVenta(c);
  if (!neto) return {};
  const unDe = new Map(db.productos.map((p) => [p.id, p.unidadNegocioId]));
  if (c.acopioId && !c.notaPedidoId) {
    const a = db.acopios.find((x) => x.id === c.acopioId);
    return { [a?.unidadNegocioId ?? "un_cor"]: neto };
  }
  const items = c.items ?? db.notasPedido.find((n) => n.id === c.notaPedidoId)?.items ?? [];
  const total = items.reduce((a, i) => a + i.cantidad * i.precioUnitario, 0);
  if (!total) return { un_cor: neto };
  const out: Record<string, number> = {};
  for (const i of items) {
    const un = unDe.get(i.productoId) ?? "un_cor";
    out[un] = (out[un] ?? 0) + (neto * i.cantidad * i.precioUnitario) / total;
  }
  return out;
}

/** Ventas facturadas netas en el rango. */
export function ventasFacturadas(db: Pick<EstadoInicial, "comprobantes" | "productos" | "notasPedido" | "acopios">, r: Rango, filtro: FiltroMetricas | string | null): number {
  const f = filtroDe(filtro);
  return comprobantesVenta(db.comprobantes, f)
    .filter((c) => enRango(c.fecha, r))
    .reduce((a, c) => a + (f.unidadNegocioId ? (netoPorUN(c, db)[f.unidadNegocioId] ?? 0) : netoVenta(c)), 0);
}

export function fechaVentaNP(np: NotaPedido): string {
  return np.fechaConfirmacion ?? np.fecha;
}

/** Notas de pedido confirmadas en el rango, con su rentabilidad (filtradas por UN si corresponde). */
export function notasVendidas(db: EstadoInicial, r: Rango, filtro: FiltroMetricas | string | null) {
  const f = filtroDe(filtro);
  const unDe = new Map(db.productos.map((p) => [p.id, p.unidadNegocioId]));
  const out: { nota: NotaPedido; /** alias de `nota` */ pedido: NotaPedido; fecha: string; ingreso: number; costo: number; margen: number; margenPct: number }[] = [];
  for (const np of db.notasPedido) {
    if (np.estado === "BORRADOR" || np.estado === "ANULADA") continue;
    if (f.sucursalId && np.sucursalId !== f.sucursalId) continue;
    if (f.circuito2 === false && np.circuito === 2) continue;
    const fecha = fechaVentaNP(np);
    if (!enRango(fecha, r)) continue;
    const items = f.unidadNegocioId ? np.items.filter((i) => unDe.get(i.productoId) === f.unidadNegocioId) : np.items;
    if (!items.length) continue;
    const rent = calcularRentabilidadPedido({ items, descuentoPct: np.descuentoPct });
    out.push({ nota: np, pedido: np, fecha, ingreso: rent.ingreso, costo: rent.costo, margen: rent.margenBruto, margenPct: rent.margenPct });
  }
  return out;
}

/** @deprecated nombre anterior */
export const pedidosVendidos = notasVendidas;

export function margenPeriodo(db: EstadoInicial, r: Rango, filtro: FiltroMetricas | string | null) {
  const ps = notasVendidas(db, r, filtro);
  const ingreso = ps.reduce((a, p) => a + p.ingreso, 0);
  const margen = ps.reduce((a, p) => a + p.margen, 0);
  return { ingreso, margen, margenPct: ingreso ? margen / ingreso : 0, pedidos: ps.length };
}

export type Agrupacion = "dia" | "semana" | "mes";

export function claveFecha(iso: string, g: Agrupacion): string {
  const d = parseISO(iso);
  if (g === "dia") return format(startOfDay(d), "yyyy-MM-dd");
  if (g === "semana") return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
  return format(d, "yyyy-MM");
}

export interface PuntoSerie {
  clave: string;
  ventas: number;
  margen: number;
  /** Ventas por unidad de negocio (id → neto). */
  porUN: Record<string, number>;
  /** Ventas por sucursal (id → neto). */
  porSucursal: Record<string, number>;
}

/** Serie temporal de ventas netas y margen, con desglose por unidad de negocio y sucursal. */
export function serieVentasMargen(db: EstadoInicial, r: Rango, filtro: FiltroMetricas | string | null, g: Agrupacion): PuntoSerie[] {
  const f = filtroDe(filtro);
  const buckets = new Map<string, PuntoSerie>();
  const desde = startOfDay(parseISO(r.desde));
  const dias = differenceInCalendarDays(parseISO(r.hasta), desde);
  for (let i = 0; i <= dias; i++) {
    const k = claveFecha(new Date(desde.getTime() + i * 86_400_000).toISOString(), g);
    if (!buckets.has(k)) buckets.set(k, { clave: k, ventas: 0, margen: 0, porUN: {}, porSucursal: {} });
  }
  for (const c of comprobantesVenta(db.comprobantes, f)) {
    if (!enRango(c.fecha, r)) continue;
    const b = buckets.get(claveFecha(c.fecha, g));
    if (!b) continue;
    const porUN = netoPorUN(c, db);
    const v = f.unidadNegocioId ? (porUN[f.unidadNegocioId] ?? 0) : netoVenta(c);
    b.ventas += v;
    for (const [un, x] of Object.entries(porUN)) if (!f.unidadNegocioId || un === f.unidadNegocioId) b.porUN[un] = (b.porUN[un] ?? 0) + x;
    if (c.sucursalId) b.porSucursal[c.sucursalId] = (b.porSucursal[c.sucursalId] ?? 0) + v;
  }
  for (const p of notasVendidas(db, r, f)) {
    const b = buckets.get(claveFecha(p.fecha, g));
    if (b) b.margen += p.margen;
  }
  return [...buckets.values()].sort((a, b) => a.clave.localeCompare(b.clave));
}

/** Ranking de productos por margen y facturación (NP confirmadas en el rango). */
export function rankingProductos(db: EstadoInicial, r: Rango, filtro: FiltroMetricas | string | null) {
  const f = filtroDe(filtro);
  const unDe = new Map(db.productos.map((p) => [p.id, p.unidadNegocioId]));
  const m = new Map<string, { productoId: string; unidades: number; facturado: number; costo: number; margen: number }>();
  for (const { nota } of notasVendidas(db, r, f))
    for (const it of nota.items) {
      if (f.unidadNegocioId && unDe.get(it.productoId) !== f.unidadNegocioId) continue;
      const rent = calcularRentabilidadItem(it, nota.descuentoPct);
      const x = m.get(it.productoId) ?? { productoId: it.productoId, unidades: 0, facturado: 0, costo: 0, margen: 0 };
      x.unidades += it.cantidad;
      x.facturado += rent.ingreso;
      x.costo += rent.costo;
      x.margen += rent.margenBruto;
      m.set(it.productoId, x);
    }
  return [...m.values()].map((x) => ({ ...x, margenPct: x.facturado ? x.margen / x.facturado : 0 }));
}
