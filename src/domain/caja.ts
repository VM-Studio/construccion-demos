/** Caja chica: saldos por caja y moneda, préstamos entre cajas y arqueos (funciones puras). */
import type { Caja, Moneda, MovimientoCaja } from "./types";

const r2 = (n: number) => Math.round(n * 100) / 100;

export const TIPO_MOVIMIENTO_CAJA_LABEL: Record<MovimientoCaja["tipo"], string> = {
  INGRESO: "Ingreso",
  EGRESO: "Egreso",
  TRANSFERENCIA: "Transferencia",
  PRESTAMO: "Préstamo",
  DEVOLUCION_PRESTAMO: "Devolución de préstamo",
  APERTURA: "Saldo inicial",
  AJUSTE: "Ajuste de arqueo",
};

/** Categorías sugeridas para ingresos y egresos manuales. */
export const CATEGORIAS_CAJA = ["Fletes", "Compras varias", "Combustible", "Sueldos y adelantos", "Servicios", "Comida y limpieza", "Retiro de socios", "Aporte de socios", "Depósito en banco", "Extracción del banco", "Otros"];

/** Saldo de una caja en una moneda (movimientos no anulados). */
export function saldoCaja(cajaId: string, moneda: Moneda, movimientos: MovimientoCaja[], hasta?: string): number {
  let s = 0;
  for (const m of movimientos) if (m.cajaId === cajaId && m.moneda === moneda && !m.anulado && (!hasta || m.fecha <= hasta)) s += m.signo * m.importe;
  return r2(s);
}

/** Movimientos de una caja con saldo corrido por moneda (orden cronológico). */
export function movimientosConSaldo(cajaId: string, movimientos: MovimientoCaja[]): (MovimientoCaja & { saldo: number })[] {
  const saldo: Record<Moneda, number> = { ARS: 0, USD: 0 };
  return movimientos
    .filter((m) => m.cajaId === cajaId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn))
    .map((m) => {
      if (!m.anulado) saldo[m.moneda] = r2(saldo[m.moneda] + m.signo * m.importe);
      return { ...m, saldo: saldo[m.moneda] };
    });
}

export interface PrestamoEntreCajas {
  /** Caja que prestó (le deben). */
  acreedorId: string;
  /** Caja que recibió el préstamo (debe). */
  deudorId: string;
  moneda: Moneda;
  saldo: number;
}

/**
 * Lo que una caja le debe a otra: préstamos (salida de la acreedora) menos devoluciones. Se
 * calcula sobre la pata de salida de cada operación.
 */
export function prestamosPendientes(movimientos: MovimientoCaja[]): PrestamoEntreCajas[] {
  const m = new Map<string, PrestamoEntreCajas>();
  for (const x of movimientos) {
    if (x.anulado || x.signo !== -1 || !x.cajaRelacionadaId) continue;
    if (x.tipo === "PRESTAMO") {
      const k = `${x.cajaId}|${x.cajaRelacionadaId}|${x.moneda}`;
      const p = m.get(k) ?? { acreedorId: x.cajaId, deudorId: x.cajaRelacionadaId, moneda: x.moneda, saldo: 0 };
      p.saldo = r2(p.saldo + x.importe);
      m.set(k, p);
    } else if (x.tipo === "DEVOLUCION_PRESTAMO") {
      const k = `${x.cajaRelacionadaId}|${x.cajaId}|${x.moneda}`;
      const p = m.get(k) ?? { acreedorId: x.cajaRelacionadaId, deudorId: x.cajaId, moneda: x.moneda, saldo: 0 };
      p.saldo = r2(p.saldo - x.importe);
      m.set(k, p);
    }
  }
  return [...m.values()].filter((p) => Math.abs(p.saldo) > 0.009);
}

/** Caja por defecto para un cobro/pago en efectivo: la de la sucursal o la primera activa. */
export function cajaPorDefecto(cajas: Caja[], sucursalId?: string): Caja | undefined {
  const activas = [...cajas].filter((c) => c.activa).sort((a, b) => a.orden - b.orden);
  return activas.find((c) => c.sucursalId && c.sucursalId === sucursalId) ?? activas.find((c) => !c.sucursalId) ?? activas[0];
}

/** Billetes para el arqueo (calculadora de billetes). */
export const DENOMINACIONES: Record<Moneda, number[]> = {
  ARS: [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10],
  USD: [100, 50, 20, 10, 5, 2, 1],
};

export function totalBilletes(billetes: { denominacion: number; cantidad: number }[]): number {
  return r2(billetes.reduce((a, b) => a + b.denominacion * (b.cantidad || 0), 0));
}
