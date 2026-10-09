/**
 * Reglas puras del tipo de cambio (dólar divisa vendedor BNA): fechas en hora Argentina,
 * días hábiles, parseo de los números de la página del banco y modo MANUAL vs AUTO.
 */
import type { Configuracion } from "./types";

// Hora Argentina: UTC−3, sin horario de verano.
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
export const enArgentina = (d = new Date()) => new Date(d.getTime() - AR_OFFSET_MS);
/** YYYY-MM-DD de hoy en Argentina. */
export const hoyAR = (d = new Date()) => enArgentina(d).toISOString().slice(0, 10);

/** Lunes a viernes (los feriados no se contemplan: el BNA simplemente no publica). */
export function esHabil(ymd: string): boolean {
  const dia = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  return dia >= 1 && dia <= 5;
}

const restarDia = (ymd: string) => new Date(Date.parse(`${ymd}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** Día hábil anterior a `ymd` (lunes → viernes). */
export function habilAnterior(ymd: string): string {
  let d = restarDia(ymd);
  while (!esHabil(d)) d = restarDia(d);
  return d;
}

/**
 * Número de la página del BNA. Billetes viene "1.450,00" (es-AR) y Divisas "1506.5000" (punto
 * decimal). Con coma: los puntos son miles. Solo con punto: decimal, salvo que dé un valor
 * absurdo para un dólar (ej. "1.450" → 1,45), en cuyo caso son miles.
 */
export function parsearNumero(txt: string): number {
  const s = txt.replace(/[^\d.,-]/g, "");
  if (!s) return Number.NaN;
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  const decimal = Number(s);
  if ((s.match(/\./g) ?? []).length > 1 || (decimal < 50 && /^\d{1,3}\.\d{3}$/.test(s))) return Number(s.replace(/\./g, ""));
  return decimal;
}

/** "8/10/2026" → "2026-10-08". */
export function parsearFechaBNA(txt: string): string | null {
  const m = txt.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const ymd = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return Number.isNaN(Date.parse(ymd)) ? null : ymd;
}

/** Valor manual vigente: solo en modo MANUAL con un valor positivo; si no, se usa la cotización. */
export function valorManual(cfg: Pick<Configuracion, "tipoCambioModo" | "tipoCambioManual">): number | null {
  return cfg.tipoCambioModo === "MANUAL" && (cfg.tipoCambioManual ?? 0) > 0 ? cfg.tipoCambioManual! : null;
}

/** Desactualizada: anterior al último día hábil completo (hoy hábil → ayer hábil; finde → viernes), o falló el último intento. */
export function estaDesactualizada(fechaCotizacion: string, hoy: string, huboError: boolean): boolean {
  return fechaCotizacion < habilAnterior(hoy) || huboError;
}
