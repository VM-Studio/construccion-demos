import { round2 } from "@/lib/utils";
import type { CondicionIVA, ItemVenta, LetraComprobante, Pedido } from "./types";

export interface Totales {
  /** Suma de líneas con descuento por línea, antes del descuento general. */
  subtotal: number;
  descuento: number;
  neto: number;
  iva: number;
  total: number;
}

/** Importe neto de una línea (con su descuento de línea). */
export function importeLinea(item: { cantidad: number; precioUnitario: number; descuentoPct?: number }): number {
  return item.cantidad * item.precioUnitario * (1 - (item.descuentoPct || 0) / 100);
}

/**
 * Totales de un comprobante: subtotal → descuento general → neto → IVA → total.
 * `descuentoPct` e `ivaPct` en base 100.
 */
export function calcularTotales(
  items: { cantidad: number; precioUnitario: number; descuentoPct?: number }[],
  descuentoPct: number,
  ivaPct: number,
): Totales {
  const subtotal = items.reduce((a, it) => a + importeLinea(it), 0);
  const descuento = subtotal * ((descuentoPct || 0) / 100);
  const neto = subtotal - descuento;
  const iva = neto * (ivaPct / 100);
  return {
    subtotal: round2(subtotal),
    descuento: round2(descuento),
    neto: round2(neto),
    iva: round2(iva),
    total: round2(neto + iva),
  };
}

export interface Rentabilidad {
  ingreso: number;
  costo: number;
  margenBruto: number;
  margenPct: number;
}

/** Rentabilidad de una línea con su costo snapshot (sin IVA). */
export function calcularRentabilidadItem(item: Pick<ItemVenta, "cantidad" | "precioUnitario" | "costoUnitarioSnapshot"> & { descuentoPct?: number }, descuentoGeneralPct = 0, costoUnitario?: number): Rentabilidad {
  const ingreso = importeLinea(item) * (1 - descuentoGeneralPct / 100);
  const costo = item.cantidad * (costoUnitario ?? item.costoUnitarioSnapshot);
  const margenBruto = ingreso - costo;
  return { ingreso: round2(ingreso), costo: round2(costo), margenBruto: round2(margenBruto), margenPct: ingreso ? margenBruto / ingreso : 0 };
}

/**
 * Rentabilidad de un pedido = Σ (precio vendido − costo al momento de la venta) × cantidad.
 * Usa SIEMPRE el snapshot de costo de cada línea, nunca el costo actual.
 */
export function calcularRentabilidadPedido(pedido: Pick<Pedido, "items" | "descuentoPct">): Rentabilidad {
  let ingreso = 0;
  let costo = 0;
  for (const it of pedido.items) {
    const r = calcularRentabilidadItem(it, pedido.descuentoPct);
    ingreso += r.ingreso;
    costo += r.costo;
  }
  const margenBruto = ingreso - costo;
  return { ingreso: round2(ingreso), costo: round2(costo), margenBruto: round2(margenBruto), margenPct: ingreso ? margenBruto / ingreso : 0 };
}

/** Rentabilidad "si vendieras hoy": mismo precio con el costo actual. */
export function calcularRentabilidadACostoActual(
  pedido: Pick<Pedido, "items" | "descuentoPct">,
  costoActual: (productoId: string) => number,
): Rentabilidad {
  let ingreso = 0;
  let costo = 0;
  for (const it of pedido.items) {
    const r = calcularRentabilidadItem(it, pedido.descuentoPct, costoActual(it.productoId));
    ingreso += r.ingreso;
    costo += r.costo;
  }
  const margenBruto = ingreso - costo;
  return { ingreso: round2(ingreso), costo: round2(costo), margenBruto: round2(margenBruto), margenPct: ingreso ? margenBruto / ingreso : 0 };
}

/** Letra de factura fiscal (AC1) según la condición de IVA del cliente: RI → A, resto → B. */
export function letraFacturaPara(condicionIVA: CondicionIVA): LetraComprobante {
  return condicionIVA === "RI" ? "A" : "B";
}

/** Días de plazo según condición de pago. */
export function diasCondicionPago(c: string): number {
  return { CONTADO: 0, ANTICIPO: 0, CTA_CTE_15: 15, CTA_CTE_30: 30, CTA_CTE_60: 60 }[c] ?? 0;
}

/** Porcentaje despachado de un pedido (0..1). */
/** Porcentaje entregado de una nota de pedido (0..1), descontando devoluciones. */
export function porcentajeEntregado(np: Pick<Pedido, "items">): number {
  const total = np.items.reduce((a, i) => a + i.cantidad - (i.devueltos ?? 0), 0);
  const ent = np.items.reduce((a, i) => a + Math.min(i.cantidad, i.entregados), 0);
  return total > 0 ? Math.min(1, ent / total) : 1;
}
