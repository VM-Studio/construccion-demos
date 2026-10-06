import type { Circuito, CodigoDoc, Numeradores } from "./types";

/** Clave del numerador: numeración independiente por código, circuito y punto de venta. */
export function claveNumerador(codigo: CodigoDoc, circuito: Circuito | null, puntoVenta: string): string {
  return `${codigo}|${circuito ?? 0}|${puntoVenta}`;
}

/**
 * Formatea el número de un documento: `${codigo}${circuito} ${puntoVenta}-${correlativo}`.
 * Ej. `NP2 0001-00067299`, `RM2 00016-00013536`, `F1 0001-00088073`.
 * Los documentos internos sin circuito (TRF, AJU, DES, RCP) no llevan sufijo.
 */
export function formatearDoc(codigo: CodigoDoc, circuito: Circuito | null, puntoVenta: string, n: number): string {
  return `${codigo}${circuito ?? ""} ${puntoVenta}-${String(n).padStart(8, "0")}`;
}

/** Reserva el siguiente número y devuelve [numero, numeradoresActualizados]. */
export function reservarNumeroDoc(
  numeradores: Numeradores,
  codigo: CodigoDoc,
  circuito: Circuito | null,
  puntoVenta: string,
): [string, Numeradores] {
  const k = claveNumerador(codigo, circuito, puntoVenta);
  const n = (numeradores[k] ?? 0) + 1;
  return [formatearDoc(codigo, circuito, puntoVenta, n), { ...numeradores, [k]: n }];
}

/** Descompone un número de documento. */
export function parsearNumeroDoc(numero: string): { codigo: string; circuito: Circuito | null; puntoVenta: string; correlativo: number } | null {
  const m = numero.match(/^([A-Z]+?)([12])?\s+(\d+)-(\d+)/);
  if (!m) return null;
  return { codigo: m[1], circuito: m[2] ? (Number(m[2]) as Circuito) : null, puntoVenta: m[3], correlativo: Number(m[4]) };
}

/** Número corto para mostrar en espacios reducidos: "NP2 67299". */
export function numeroCorto(numero: string): string {
  const p = parsearNumeroDoc(numero);
  return p ? `${p.codigo}${p.circuito ?? ""} ${p.correlativo}` : numero;
}

/** Actualiza los numeradores a partir de una lista de números existentes (para el seed). */
export function numeradoresDesde(numeros: string[]): Numeradores {
  const out: Numeradores = {};
  for (const num of numeros) {
    const p = parsearNumeroDoc(num);
    if (!p) continue;
    const k = `${p.codigo}|${p.circuito ?? 0}|${p.puntoVenta}`;
    out[k] = Math.max(out[k] ?? 0, p.correlativo);
  }
  return out;
}
