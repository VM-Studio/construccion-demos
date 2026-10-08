import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Cliente, Comprobante } from "./types";

const TIPOS_DEUDA = new Set(["FACTURA", "NOTA_DEBITO", "SALDO_INICIAL"]);

/** True si el comprobante genera deuda (facturas, notas de débito y saldos iniciales). */
export function esComprobanteDeuda(c: Pick<Comprobante, "tipo">): boolean {
  return TIPOS_DEUDA.has(c.tipo);
}

/**
 * Saldo de cuenta corriente de un cliente: suma de saldos pendientes
 * (facturas positivas, saldos a favor negativos), excluyendo anulados.
 */
export function saldoCliente(clienteId: string, comprobantes: Comprobante[]): number {
  let s = 0;
  for (const c of comprobantes) if (c.clienteId === clienteId && c.estado !== "ANULADO") s += c.saldoPendiente;
  return s;
}

/** Saldo con un proveedor (lo que le debemos). */
export function saldoProveedor(proveedorId: string, comprobantes: Comprobante[]): number {
  let s = 0;
  for (const c of comprobantes) if (c.proveedorId === proveedorId && c.estado !== "ANULADO") s += c.saldoPendiente;
  return s;
}

/** True si el comprobante tiene saldo y su vencimiento ya pasó. */
export function estaVencido(c: Comprobante, hoy: Date): boolean {
  if (c.saldoPendiente <= 0.009 || c.estado === "ANULADO" || !esComprobanteDeuda(c)) return false;
  const v = c.vencimiento ?? c.fecha;
  return differenceInCalendarDays(hoy, parseISO(v)) > 0;
}

/** Días de atraso respecto del vencimiento (0 si no venció). */
export function diasAtraso(c: Comprobante, hoy: Date): number {
  const v = c.vencimiento ?? c.fecha;
  return Math.max(0, differenceInCalendarDays(hoy, parseISO(v)));
}

export interface Antiguedad {
  "0-30": number;
  "31-60": number;
  "61-90": number;
  "+90": number;
}

/**
 * Antigüedad de deuda por días desde la emisión del comprobante:
 * buckets 0–30 / 31–60 / 61–90 / +90 sobre el saldo pendiente.
 */
export function antiguedadDeuda(comprobantes: Comprobante[], hoy: Date): Antiguedad {
  const out: Antiguedad = { "0-30": 0, "31-60": 0, "61-90": 0, "+90": 0 };
  for (const c of comprobantes) {
    if (c.estado === "ANULADO" || c.saldoPendiente <= 0 || !esComprobanteDeuda(c)) continue;
    const d = differenceInCalendarDays(hoy, parseISO(c.fecha));
    if (d <= 30) out["0-30"] += c.saldoPendiente;
    else if (d <= 60) out["31-60"] += c.saldoPendiente;
    else if (d <= 90) out["61-90"] += c.saldoPendiente;
    else out["+90"] += c.saldoPendiente;
  }
  return out;
}

/** Crédito disponible = límite − saldo (nunca menor a 0 en la visualización). */
export function disponibleCredito(cliente: Pick<Cliente, "limiteCredito">, saldo: number): number {
  return cliente.limiteCredito - saldo;
}

/** Estado de un comprobante según su saldo. */
export function estadoPorSaldo(total: number, saldo: number): "PENDIENTE" | "PARCIAL" | "PAGADO" {
  if (saldo <= 0.009) return "PAGADO";
  if (saldo < total - 0.009) return "PARCIAL";
  return "PENDIENTE";
}

/**
 * Imputa un importe a comprobantes pendientes, del más antiguo al más nuevo.
 * Devuelve las imputaciones y el remanente no imputado.
 */
export function imputarAutomaticamente(
  importe: number,
  pendientes: Pick<Comprobante, "id" | "fecha" | "saldoPendiente">[],
): { imputaciones: { comprobanteId: string; importe: number }[]; remanente: number } {
  let resto = Math.round(importe * 100) / 100;
  const imputaciones: { comprobanteId: string; importe: number }[] = [];
  const orden = [...pendientes].filter((c) => c.saldoPendiente > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const c of orden) {
    if (resto <= 0) break;
    const imp = Math.min(resto, c.saldoPendiente);
    imputaciones.push({ comprobanteId: c.id, importe: Math.round(imp * 100) / 100 });
    resto = Math.round((resto - imp) * 100) / 100;
  }
  return { imputaciones, remanente: resto };
}
