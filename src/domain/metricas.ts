/**
 * Métricas de negocio puras para tablero y reportes.
 */
import { differenceInCalendarDays, parseISO, startOfDay, startOfWeek, format } from "date-fns";
import type { Acopio, Comprobante, EstadoInicial, Pedido } from "./types";
import { calcularRentabilidadPedido, calcularRentabilidadItem } from "./ventas";

export interface Rango {
  desde: string;
  hasta: string;
}

const enRango = (f: string | undefined, r: Rango) => !!f && f >= r.desde && f <= r.hasta;

/** Facturas de venta (A/B) y notas de crédito de clientes, no anuladas. */
export function comprobantesVenta(comprobantes: Comprobante[], sucursalId: string | null) {
  return comprobantes.filter(
    (c) => c.clienteId && (c.tipo === "FACTURA_A" || c.tipo === "FACTURA_B" || c.tipo === "NOTA_CREDITO") && (!sucursalId || c.sucursalId === sucursalId),
  );
}

/** Importe neto (sin IVA) con signo: NC resta. Las facturas anuladas no suman (su NC tampoco). */
export function netoVenta(c: Comprobante): number {
  if (c.estado === "ANULADO") return 0;
  if (c.tipo === "NOTA_CREDITO") return c.comprobanteOrigenId && c.pedidoId ? 0 : -c.subtotal;
  return c.subtotal;
}

/** Ventas facturadas netas en el rango. */
export function ventasFacturadas(comprobantes: Comprobante[], r: Rango, sucursalId: string | null): number {
  return comprobantesVenta(comprobantes, sucursalId)
    .filter((c) => enRango(c.fecha, r))
    .reduce((a, c) => a + netoVenta(c), 0);
}

/**
 * Fecha de venta de un pedido: fecha de la factura si está facturado,
 * si no, la última entrega (o la confirmación).
 */
export function fechaVentaPedido(p: Pedido, db: Pick<EstadoInicial, "comprobantes" | "despachos">): string {
  if (p.comprobanteId) {
    const c = db.comprobantes.find((x) => x.id === p.comprobanteId);
    if (c) return c.fecha;
  }
  let ult = "";
  for (const d of db.despachos) if (d.origenTipo === "PEDIDO" && d.origenId === p.id && d.fechaEntrega && d.fechaEntrega > ult) ult = d.fechaEntrega;
  return ult || p.fechaConfirmacion || p.fecha;
}

/** Pedidos vendidos (facturados o despachados) en el rango, con su rentabilidad. */
export function pedidosVendidos(db: EstadoInicial, r: Rango, sucursalId: string | null) {
  const fechas = new Map<string, string>();
  const out: { pedido: Pedido; fecha: string; ingreso: number; costo: number; margen: number; margenPct: number }[] = [];
  for (const p of db.pedidos) {
    if (p.estado !== "FACTURADO" && p.estado !== "DESPACHADO") continue;
    if (sucursalId && p.sucursalId !== sucursalId) continue;
    const f = fechas.get(p.id) ?? fechaVentaPedido(p, db);
    if (!enRango(f, r)) continue;
    const rent = calcularRentabilidadPedido(p);
    out.push({ pedido: p, fecha: f, ingreso: rent.ingreso, costo: rent.costo, margen: rent.margenBruto, margenPct: rent.margenPct });
  }
  return out;
}

export function margenPeriodo(db: EstadoInicial, r: Rango, sucursalId: string | null) {
  const ps = pedidosVendidos(db, r, sucursalId);
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

/** Serie temporal de ventas netas y margen. */
export function serieVentasMargen(db: EstadoInicial, r: Rango, sucursalId: string | null, g: Agrupacion) {
  const buckets = new Map<string, { clave: string; ventas: number; margen: number; norte: number; sur: number }>();
  // Pre-crear todas las claves del rango para que el gráfico no tenga huecos
  const desde = startOfDay(parseISO(r.desde));
  const dias = differenceInCalendarDays(parseISO(r.hasta), desde);
  for (let i = 0; i <= dias; i++) {
    const k = claveFecha(new Date(desde.getTime() + i * 86_400_000).toISOString(), g);
    if (!buckets.has(k)) buckets.set(k, { clave: k, ventas: 0, margen: 0, norte: 0, sur: 0 });
  }
  for (const c of comprobantesVenta(db.comprobantes, sucursalId)) {
    if (!enRango(c.fecha, r)) continue;
    const b = buckets.get(claveFecha(c.fecha, g));
    if (!b) continue;
    const v = netoVenta(c);
    b.ventas += v;
    if (c.sucursalId === "suc_norte") b.norte += v;
    else b.sur += v;
  }
  for (const p of pedidosVendidos(db, r, sucursalId)) {
    const b = buckets.get(claveFecha(p.fecha, g));
    if (b) b.margen += p.margen;
  }
  return [...buckets.values()].sort((a, b) => a.clave.localeCompare(b.clave));
}

/** Ranking de productos por margen y facturación (pedidos vendidos en el rango). */
export function rankingProductos(db: EstadoInicial, r: Rango, sucursalId: string | null) {
  const m = new Map<string, { productoId: string; unidades: number; facturado: number; costo: number; margen: number }>();
  for (const { pedido } of pedidosVendidos(db, r, sucursalId))
    for (const it of pedido.items) {
      const rent = calcularRentabilidadItem(it, pedido.descuentoPct);
      const x = m.get(it.productoId) ?? { productoId: it.productoId, unidades: 0, facturado: 0, costo: 0, margen: 0 };
      x.unidades += it.cantidad;
      x.facturado += rent.ingreso;
      x.costo += rent.costo;
      x.margen += rent.margenBruto;
      m.set(it.productoId, x);
    }
  return [...m.values()].map((x) => ({ ...x, margenPct: x.facturado ? x.margen / x.facturado : 0 }));
}

/** Margen bruto de un acopio a costo snapshot (sobre todo lo acopiado). */
export function margenAcopio(a: Acopio) {
  let ingreso = 0;
  let costo = 0;
  for (const i of a.items) {
    ingreso += i.cantidadAcopiada * i.precioUnitarioPactado;
    costo += i.cantidadAcopiada * i.costoUnitarioSnapshot;
  }
  return { ingreso, costo, margen: ingreso - costo, margenPct: ingreso ? (ingreso - costo) / ingreso : 0 };
}
