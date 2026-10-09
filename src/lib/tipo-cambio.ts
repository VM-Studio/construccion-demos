"use client";
/**
 * Tipo de cambio USD en el navegador: SOLO lectura y presentación. Todo cálculo que se guarda
 * (pesos desde USD, snapshots de documentos) lo hace el servidor con su `obtenerVigente()`.
 * Clave SWR ["tipo-cambio", …]: la sincronización la revalida cuando el servidor publica un
 * Cambio de tipo CotizacionUSD; el modo/valor manual va en la clave para que cambie al instante.
 */
import useSWR, { mutate } from "swr";
import type { FilaHistorial, Vigente } from "@/server/servicios/tipoCambio";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { useDb } from "@/lib/datos/almacen";

export type { FilaHistorial, Vigente };
export type TipoCambioRespuesta = Vigente & { historial: FilaHistorial[] };

const fetcher = async (url: string): Promise<TipoCambioRespuesta> => {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Error ${r.status}`);
  return r.json();
};

/** El CDN cachea 5 min: el parámetro `t` (minuto) acota lo viejo que puede llegar tras un aviso. */
const url = (modo?: string, manual?: number) => `/api/tipo-cambio?m=${modo ?? "AUTO"}&v=${manual ?? 0}&t=${Math.floor(Date.now() / 60_000)}`;

/** Tipo de cambio vigente + historial de 30 días. */
export function useTipoCambio(): { tc: TipoCambioRespuesta | undefined; valor: number | null; cargando: boolean; error: boolean } {
  const { tipoCambioModo, tipoCambioManual } = useDb().config;
  const manual = tipoCambioModo === "MANUAL" ? tipoCambioManual : undefined;
  const { data, isLoading, error } = useSWR(["tipo-cambio", tipoCambioModo ?? "AUTO", manual ?? 0], () => fetcher(url(tipoCambioModo, manual)), {
    keepPreviousData: true,
    dedupingInterval: 1000,
    revalidateOnFocus: false,
    refreshInterval: 15 * 60_000,
  });
  return { tc: data, valor: data?.valor ?? null, cargando: isLoading, error: Boolean(error) };
}

/** Cotización aplicable a una fecha pasada (YYYY-MM-DD), para reportes de períodos cerrados. */
export function useTipoCambioFecha(fecha: string | null): { cotizacion: FilaHistorial | null; cargando: boolean } {
  const { data, isLoading } = useSWR(fecha ? ["tipo-cambio", "fecha", fecha] : null, async () => {
    const r = await fetch(`/api/tipo-cambio?fecha=${fecha}`);
    if (!r.ok) throw new Error(`Error ${r.status}`);
    return (await r.json()) as { cotizacion: FilaHistorial | null };
  }, { revalidateOnFocus: false, dedupingInterval: 60_000 });
  return { cotizacion: data?.cotizacion ?? null, cargando: isLoading };
}

/** "Actualizar ahora" (Dueño / Administración). */
export async function actualizarTipoCambioAhora(): Promise<{ ok: boolean; error?: string; data?: TipoCambioRespuesta }> {
  const r = await fetch("/api/tipo-cambio/actualizar", { method: "POST" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: j.error ?? "No se pudo actualizar el tipo de cambio." };
  await refrescarTipoCambio();
  return { ok: j.ok !== false, data: j, error: j.ok === false ? "El Banco Nación y el respaldo no respondieron: se mantiene la última cotización." : undefined };
}

export function refrescarTipoCambio() {
  return mutate((k) => Array.isArray(k) && k[0] === "tipo-cambio");
}

// ───────────────────────── Presentación ─────────────────────────

export const FUENTE_TIPO_CAMBIO: Record<string, string> = {
  BNA: "BNA divisa vendedor",
  DOLARAPI_MAYORISTA: "Dólar mayorista (dolarapi.com)",
  MANUAL: "Valor manual",
};

export const fuenteLabel = (f: string | null | undefined) => (f ? (FUENTE_TIPO_CAMBIO[f] ?? f) : "—");

/** "USD 12,40". */
export function formatUSD(n: number, opts: { decimals?: boolean } = {}): string {
  const v = Number.isFinite(n) ? n : 0;
  const s = new Intl.NumberFormat("es-AR", { minimumFractionDigits: opts.decimals === false ? 0 : 2, maximumFractionDigits: opts.decimals === false ? 0 : 2 }).format(Math.abs(v));
  return `${v < 0 ? "−" : ""}USD ${s}`;
}

/** "USD 1.450" (indicador compacto del header). */
export const formatTipoCambioCorto = (n: number) => `USD ${formatNumber(n, 0)}`;

/** Pesos → dólares al tipo de cambio dado (solo para mostrar). */
export const aDolares = (pesos: number, tc: number | null | undefined) => (tc && tc > 0 ? pesos / tc : 0);

/** Línea de impresión de documentos en USD. */
export function textoTipoCambioAplicado(valor: number, fecha: string | undefined, fuente = "BNA"): string {
  return `Tipo de cambio aplicado: ${formatMoney(valor)} (${fuenteLabel(fuente)}, ${formatDate(fecha)})`;
}

/** "lunes 06/10". */
export const diaYFecha = (ymd: string | null | undefined) => (ymd ? formatDate(`${ymd.slice(0, 10)}T12:00:00`, "EEEE dd/MM") : "—");

/** La cotización no es de hoy (fin de semana, feriado o antes de que publique el banco). */
export function noEsDeHoy(tc: Pick<Vigente, "fecha" | "modo"> | undefined): boolean {
  if (!tc?.fecha || tc.modo === "MANUAL") return false;
  const hoy = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  return tc.fecha < hoy;
}
