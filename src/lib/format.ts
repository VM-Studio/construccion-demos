import { format as dfFormat, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { BRAND } from "@/config/brand";

const moneyFmt = new Intl.NumberFormat(BRAND.locale, {
  style: "currency",
  currency: BRAND.moneda,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const numberFmt = new Intl.NumberFormat(BRAND.locale, { maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat(BRAND.locale, { maximumFractionDigits: 0 });

/**
 * Formatea un importe en pesos: `$ 1.234.567,89`.
 * Con `compact` devuelve `$ 1,2M` / `$ 850k`.
 */
export function formatMoney(n: number, opts: { compact?: boolean; decimals?: boolean } = {}): string {
  const v = Number.isFinite(n) ? n : 0;
  if (opts.compact) {
    const abs = Math.abs(v);
    const sign = v < 0 ? "−" : "";
    if (abs >= 1_000_000_000) return `${sign}$ ${numberFmt.format(round1(abs / 1_000_000_000))}MM`;
    if (abs >= 1_000_000) return `${sign}$ ${numberFmt.format(round1(abs / 1_000_000))}M`;
    if (abs >= 1_000) return `${sign}$ ${intFmt.format(abs / 1_000)}k`;
    return `${sign}$ ${intFmt.format(abs)}`;
  }
  if (opts.decimals === false) {
    return `${v < 0 ? "−" : ""}$ ${intFmt.format(Math.abs(v))}`;
  }
  // Intl en es-AR produce "$ 1.234,56" con espacio duro; normalizamos.
  return moneyFmt.format(v).replace(/ /g, " ").replace("-", "−");
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function formatNumber(n: number, decimals = 2): string {
  return new Intl.NumberFormat(BRAND.locale, { maximumFractionDigits: decimals }).format(
    Number.isFinite(n) ? n : 0,
  );
}

function toDate(d: Date | string): Date {
  return typeof d === "string" ? parseISO(d) : d;
}

/** Fecha con date-fns, por defecto `dd/MM/yyyy`. */
export function formatDate(d: Date | string | undefined | null, pattern = "dd/MM/yyyy"): string {
  if (!d) return "—";
  const date = toDate(d);
  if (Number.isNaN(date.getTime())) return "—";
  return dfFormat(date, pattern, { locale: es });
}

export function formatDateTime(d: Date | string | undefined | null): string {
  return formatDate(d, "dd/MM/yyyy HH:mm");
}

/** Porcentaje: recibe 0.256 → `25,6 %` (o 25.6 con `{ base100: true }`). */
export function formatPercent(n: number, opts: { base100?: boolean; decimals?: number; signo?: boolean } = {}): string {
  const v = Number.isFinite(n) ? n : 0;
  const pct = opts.base100 ? v : v * 100;
  const s = new Intl.NumberFormat(BRAND.locale, {
    maximumFractionDigits: opts.decimals ?? 1,
    minimumFractionDigits: opts.decimals ?? 1,
  }).format(Math.abs(pct));
  const sign = pct < 0 ? "−" : opts.signo && pct > 0 ? "+" : "";
  return `${sign}${s} %`;
}

const UNIDAD_LABEL: Record<string, [string, string]> = {
  UN: ["unidad", "unidades"],
  BOLSA: ["bolsa", "bolsas"],
  M3: ["m³", "m³"],
  M2: ["m²", "m²"],
  ML: ["ml", "ml"],
  KG: ["kg", "kg"],
  LT: ["l", "l"],
  PALLET: ["pallet", "pallets"],
  CAJA: ["caja", "cajas"],
  ROLLO: ["rollo", "rollos"],
  PLACA: ["placa", "placas"],
  TN: ["tn", "tn"],
};

/** Cantidad con unidad: `120 bolsas`, `4,5 m³`. */
export function formatQty(n: number, unidad: string): string {
  const [sing, plural] = UNIDAD_LABEL[unidad] ?? [unidad.toLowerCase(), unidad.toLowerCase()];
  return `${formatNumber(n)} ${Math.abs(n) === 1 ? sing : plural}`;
}

export function unidadCorta(unidad: string): string {
  return UNIDAD_LABEL[unidad]?.[1] ?? unidad.toLowerCase();
}
