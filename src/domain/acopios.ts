import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Acopio, EstadoAcopio, ItemAcopio } from "./types";

/** Cantidad pendiente de retiro de un ítem. */
export function pendienteItem(item: ItemAcopio): number {
  return Math.max(0, item.cantidadAcopiada - item.cantidadRetirada);
}

/** Saldo por ítem: cantidad pendiente de retiro. */
export function saldoAcopio(acopio: Pick<Acopio, "items">): { itemId: string; productoId: string; pendiente: number }[] {
  return acopio.items.map((it) => ({ itemId: it.id, productoId: it.productoId, pendiente: pendienteItem(it) }));
}

export interface DeudaMercaderia {
  /** Valor pendiente a precio pactado (lo que el cliente ya compró). */
  aPrecioPactado: number;
  /** Lo que costaría hoy reponer lo pendiente. */
  aCostoActual: number;
  /** Lo que costaba cuando se pactó. */
  aCostoSnapshot: number;
  /** Cuánto subió el costo desde que se pactó (erosiona el margen). Positivo = peor. */
  exposicion: number;
  /** Margen que queda sobre lo pendiente a costo actual (0..1). */
  margenActualPct: number;
}

/**
 * Valoriza la deuda de mercadería de un acopio.
 * `costosActuales` devuelve el costo de reposición actual de un producto.
 */
export function valorDeudaMercaderia(
  acopio: Pick<Acopio, "items">,
  costosActuales: (productoId: string) => number,
): DeudaMercaderia {
  let aPrecioPactado = 0;
  let aCostoActual = 0;
  let aCostoSnapshot = 0;
  for (const it of acopio.items) {
    const q = pendienteItem(it);
    aPrecioPactado += q * it.precioUnitarioPactado;
    aCostoActual += q * costosActuales(it.productoId);
    aCostoSnapshot += q * it.costoUnitarioSnapshot;
  }
  return {
    aPrecioPactado,
    aCostoActual,
    aCostoSnapshot,
    exposicion: aCostoActual - aCostoSnapshot,
    margenActualPct: aPrecioPactado ? (aPrecioPactado - aCostoActual) / aPrecioPactado : 0,
  };
}

/** Proporción retirada en valor (0..1) a precio pactado. */
export function proporcionRetirada(acopio: Pick<Acopio, "items">): number {
  let total = 0;
  let ret = 0;
  for (const it of acopio.items) {
    total += it.cantidadAcopiada * it.precioUnitarioPactado;
    ret += it.cantidadRetirada * it.precioUnitarioPactado;
  }
  return total ? ret / total : 0;
}

/** Proporción pagada (0..1). */
export function proporcionPagada(acopio: Pick<Acopio, "total" | "montoPagado">): number {
  return acopio.total ? Math.min(1, acopio.montoPagado / acopio.total) : 0;
}

/**
 * Estado derivado por fecha y retiros. CANCELADO se respeta;
 * COMPLETADO si no queda saldo; VENCIDO si pasó la fecha con saldo.
 */
export function estadoDerivado(acopio: Pick<Acopio, "estado" | "items" | "fechaVencimiento">, hoy: Date): EstadoAcopio {
  if (acopio.estado === "CANCELADO") return "CANCELADO";
  const pendiente = acopio.items.some((i) => pendienteItem(i) > 0);
  if (!pendiente) return "COMPLETADO";
  if (differenceInCalendarDays(hoy, parseISO(acopio.fechaVencimiento)) > 0) return "VENCIDO";
  if (acopio.items.some((i) => i.cantidadRetirada > 0)) return "RETIRADO_PARCIAL";
  return "VIGENTE";
}

/** Días hasta el vencimiento (negativo si ya venció). */
export function diasParaVencer(acopio: Pick<Acopio, "fechaVencimiento">, hoy: Date): number {
  return differenceInCalendarDays(parseISO(acopio.fechaVencimiento), hoy);
}

/**
 * Valida que un retiro no supere la proporción pagada.
 * Devuelve true si el retiro (en valor a precio pactado) deja lo retirado ≤ lo pagado.
 */
export function retiroDentroDeLoPagado(acopio: Acopio, valorRetiro: number): boolean {
  let retiradoValor = 0;
  for (const it of acopio.items) retiradoValor += it.cantidadRetirada * it.precioUnitarioPactado;
  const pagadoNeto = acopio.total ? (acopio.montoPagado / acopio.total) * acopio.subtotal : 0;
  return retiradoValor + valorRetiro <= pagadoNeto + 0.01;
}
