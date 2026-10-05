import type { Numeradores, TipoComprobante } from "./types";

export const PREFIJOS = {
  OC: "OC",
  PRE: "PRE",
  PED: "PED",
  ACO: "ACO",
  RET: "RET",
  REM: "REM",
  REC: "REC",
  OP: "OP",
  TRF: "TRF",
  AJU: "AJU",
  RCP: "RCP",
} as const;

export type EntidadNumerada = keyof typeof PREFIJOS;

/** Formatea un número interno: `OC-00012`. */
export function formatearNumero(entidad: EntidadNumerada, n: number): string {
  return `${PREFIJOS[entidad]}-${String(n).padStart(5, "0")}`;
}

/** Extrae la parte numérica de `OC-00012` → 12. */
export function parsearNumero(numero: string): number {
  const m = numero.match(/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

/**
 * Siguiente número para una entidad a partir de la lista existente
 * (toma el máximo y suma uno). Padding de 5 dígitos.
 */
export function siguienteNumero(entidad: EntidadNumerada, lista: { numero: string }[]): string {
  const max = lista.reduce((m, x) => Math.max(m, parsearNumero(x.numero)), 0);
  return formatearNumero(entidad, max + 1);
}

/** Punto de venta fiscal por sucursal: Norte 0001, Sur 0002. */
export const PUNTO_VENTA_POR_DEFECTO: Record<string, string> = {
  suc_norte: "0001",
  suc_sur: "0002",
};

/** Número fiscal `0001-00001234`. */
export function formatearNumeroFiscal(puntoVenta: string, n: number): string {
  return `${puntoVenta.padStart(4, "0")}-${String(n).padStart(8, "0")}`;
}

/** Reserva el siguiente número fiscal y devuelve [numero, numeradoresActualizados]. */
export function siguienteNumeroFiscal(
  numeradores: Numeradores,
  puntoVenta: string,
  tipo: TipoComprobante,
): [string, Numeradores] {
  const actual = numeradores.fiscal[puntoVenta]?.[tipo] ?? 0;
  const n = actual + 1;
  return [
    formatearNumeroFiscal(puntoVenta, n),
    { ...numeradores, fiscal: { ...numeradores.fiscal, [puntoVenta]: { ...numeradores.fiscal[puntoVenta], [tipo]: n } } },
  ];
}

/** Reserva el siguiente número interno y devuelve [numero, numeradoresActualizados]. */
export function reservarNumero(numeradores: Numeradores, entidad: EntidadNumerada): [string, Numeradores] {
  const n = numeradores[entidad] + 1;
  return [formatearNumero(entidad, n), { ...numeradores, [entidad]: n }];
}
