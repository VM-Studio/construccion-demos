/**
 * Tipo de cambio USD: dólar divisa vendedor del Banco Nación.
 * - Fuente principal: https://www.bna.com.ar/Personas, solapa "Cotización Divisas" (no "Billetes").
 * - Respaldo: dólar mayorista de dolarapi.com (≈ divisa).
 * - Una fila de CotizacionUSD por fecha de cotización (upsert). Cada actualización publica un
 *   Cambio de tipo "CotizacionUSD" para que todos los navegadores revaliden la clave "tipo-cambio".
 * - TODO valor en dólares del sistema sale de `obtenerVigente()` (modo AUTO o MANUAL).
 * Sin `server-only`: lo importa el motor, que también corre en los scripts de pruebas (tsx).
 */
import * as cheerio from "cheerio";
import { prisma } from "../db-base";
import type { Configuracion, TipoCambioVigente } from "@/domain/types";

export type FuenteTipoCambio = "BNA" | "DOLARAPI_MAYORISTA" | "MANUAL";

export interface CotizacionObtenida {
  /** Fecha de la cotización (YYYY-MM-DD). */
  fecha: string;
  divisaCompra: number;
  divisaVenta: number;
  billeteCompra?: number;
  billeteVenta?: number;
  fuente: FuenteTipoCambio;
}

export interface Vigente {
  /** Dólar divisa vendedor (o el valor manual). null si nunca se pudo obtener. */
  valor: number | null;
  compra: number | null;
  /** Fecha de la cotización (YYYY-MM-DD). */
  fecha: string | null;
  fuente: FuenteTipoCambio | null;
  /** Cuándo se leyó de la fuente (ISO). */
  obtenidoEn: string | null;
  modo: "AUTO" | "MANUAL";
  /** La última es de más de 1 día hábil atrás, o el último intento de actualizar falló. */
  desactualizado: boolean;
  /** Último intento fallido (ISO), si es posterior a la última cotización. */
  ultimoError: string | null;
  /** Hoy (hora Argentina) es lunes a viernes. */
  esDiaHabil: boolean;
}

export interface FilaHistorial {
  fecha: string;
  compra: number;
  venta: number;
  billeteCompra: number | null;
  billeteVenta: number | null;
  fuente: string;
  obtenidoEn: string;
}

const TIMEOUT_MS = 8000;
const REFRESCO_MS = 2 * 60 * 60 * 1000;
/** Entre intentos automáticos (si la fuente no responde, no se reintenta en cada request). */
const ENTRE_INTENTOS_MS = 10 * 60 * 1000;
export const ACCION_FALLO = "No se pudo actualizar el tipo de cambio";
const ACCION_OK = "Actualizó el tipo de cambio";
const UA = "Mozilla/5.0 (compatible; AcerosRNF/1.0; +https://construccion-demos.vercel.app)";

// ───────────────────────── Fechas (hora Argentina, UTC−3 sin horario de verano) ─────────────────────────

const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const enArgentina = (d = new Date()) => new Date(d.getTime() - AR_OFFSET_MS);
/** YYYY-MM-DD de hoy en Argentina. */
export const hoyAR = (d = new Date()) => enArgentina(d).toISOString().slice(0, 10);
const esHabil = (ymd: string) => {
  const dia = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  return dia >= 1 && dia <= 5;
};
const restarDia = (ymd: string) => new Date(Date.parse(`${ymd}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
/** Día hábil anterior a `ymd` (lunes → viernes). */
function habilAnterior(ymd: string): string {
  let d = restarDia(ymd);
  while (!esHabil(d)) d = restarDia(d);
  return d;
}
const aFechaDb = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const deFechaDb = (d: Date) => d.toISOString().slice(0, 10);

// ───────────────────────── Parseo ─────────────────────────

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
function parsearFechaBNA(txt: string): string | null {
  const m = txt.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const ymd = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return Number.isNaN(Date.parse(ymd)) ? null : ymd;
}

/** Lee la fila "Dolar U.S.A" de la tabla de una solapa (#divisas o #billetes). */
function leerTabla($: cheerio.CheerioAPI, solapa: "divisas" | "billetes") {
  const tabla = $(`#${solapa} table`).first();
  if (!tabla.length) return null;
  const fecha = parsearFechaBNA(tabla.find("th.fechaCot").first().text());
  let compra = Number.NaN;
  let venta = Number.NaN;
  tabla.find("tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (/d[oó]lar\s+u\.?s\.?a/i.test(tds.eq(0).text())) {
      compra = parsearNumero(tds.eq(1).text());
      venta = parsearNumero(tds.eq(2).text());
      return false;
    }
  });
  if (!(compra > 0 && venta > 0)) return null;
  return { fecha, compra, venta };
}

/** Falla simulada para pruebas: TIPO_CAMBIO_SIMULAR_FALLA=bna | todo. */
function simularFalla(fuente: "bna" | "fallback") {
  const f = process.env.TIPO_CAMBIO_SIMULAR_FALLA;
  if (f === "todo" || f === fuente) throw new Error(`Falla simulada (${fuente})`);
}

async function traer(url: string, tipo: "text" | "json"): Promise<string | unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store", headers: { "User-Agent": UA, Accept: tipo === "json" ? "application/json" : "text/html" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return tipo === "json" ? await r.json() : await r.text();
  } finally {
    clearTimeout(t);
  }
}

// ───────────────────────── Fuentes ─────────────────────────

export async function obtenerDesdeBNA(): Promise<CotizacionObtenida> {
  simularFalla("bna");
  const html = (await traer("https://www.bna.com.ar/Personas", "text")) as string;
  const $ = cheerio.load(html);
  const divisa = leerTabla($, "divisas");
  if (!divisa) throw new Error("No se encontró la cotización Divisas del Dólar U.S.A. en la página del BNA");
  if (divisa.venta < 100 || divisa.venta > 1_000_000 || divisa.compra > divisa.venta) throw new Error(`Cotización del BNA fuera de rango: ${divisa.compra} / ${divisa.venta}`);
  const billete = leerTabla($, "billetes");
  return {
    fecha: divisa.fecha ?? hoyAR(),
    divisaCompra: divisa.compra,
    divisaVenta: divisa.venta,
    billeteCompra: billete?.compra,
    billeteVenta: billete?.venta,
    fuente: "BNA",
  };
}

export async function obtenerDesdeFallback(): Promise<CotizacionObtenida> {
  simularFalla("fallback");
  const j = (await traer("https://dolarapi.com/v1/dolares/mayorista", "json")) as { compra?: number; venta?: number; fechaActualizacion?: string };
  const compra = Number(j.compra);
  const venta = Number(j.venta);
  if (!(compra > 0 && venta > 0)) throw new Error("Respuesta inválida de dolarapi");
  const fecha = j.fechaActualizacion && !Number.isNaN(Date.parse(j.fechaActualizacion)) ? hoyAR(new Date(j.fechaActualizacion)) : hoyAR();
  return { fecha, divisaCompra: compra, divisaVenta: venta, fuente: "DOLARAPI_MAYORISTA" };
}

// ───────────────────────── Persistencia ─────────────────────────

type Fila = Awaited<ReturnType<typeof prisma.cotizacionUSD.findFirst>>;

const filaAHistorial = (f: NonNullable<Fila>): FilaHistorial => ({
  fecha: deFechaDb(f.fecha),
  compra: f.divisaCompra.toNumber(),
  venta: f.divisaVenta.toNumber(),
  billeteCompra: f.billeteCompra?.toNumber() ?? null,
  billeteVenta: f.billeteVenta?.toNumber() ?? null,
  fuente: f.fuente,
  obtenidoEn: f.obtenidoEn.toISOString(),
});

const g = globalThis as unknown as { __tcEnCurso?: Promise<ResultadoActualizacion>; __tcUltimoIntento?: number; __tcCache?: { hasta: number; ultima: Fila; error: Date | null } };

export interface ResultadoActualizacion {
  ok: boolean;
  fuente: FuenteTipoCambio | null;
  cotizacion: FilaHistorial | null;
  errores: string[];
}

/** BNA → respaldo → si fallan ambos, auditoría y la última conocida. */
export function actualizarCotizacion(): Promise<ResultadoActualizacion> {
  // Un solo intento a la vez por instancia.
  g.__tcEnCurso ??= (async () => {
    g.__tcUltimoIntento = Date.now();
    const errores: string[] = [];
    let c: CotizacionObtenida | null = null;
    for (const fuente of [obtenerDesdeBNA, obtenerDesdeFallback]) {
      try {
        c = await fuente();
        break;
      } catch (e) {
        errores.push(`${fuente === obtenerDesdeBNA ? "BNA" : "dolarapi"}: ${(e as Error).message}`);
      }
    }
    g.__tcCache = undefined;
    if (!c) {
      console.warn("[tipo-cambio]", ACCION_FALLO, errores);
      await prisma.$transaction([
        prisma.auditoria.create({ data: { fecha: new Date(), usuarioId: "sistema", accion: ACCION_FALLO, entidad: "CotizacionUSD", entidadId: hoyAR(), detalle: errores.join(" · ").slice(0, 500) } }),
        prisma.cambio.create({ data: { tipos: ["CotizacionUSD"], entidadIds: [], usuarioId: null } }),
      ]);
      const ultima = await prisma.cotizacionUSD.findFirst({ orderBy: { fecha: "desc" } });
      return { ok: false, fuente: null, cotizacion: ultima ? filaAHistorial(ultima) : null, errores };
    }
    // El respaldo no pisa una cotización del BNA del mismo día (solo completa días sin BNA).
    if (c.fuente !== "BNA") {
      const previa = await prisma.cotizacionUSD.findUnique({ where: { fecha: aFechaDb(c.fecha) } });
      if (previa?.fuente === "BNA") return { ok: true, fuente: "BNA" as const, cotizacion: filaAHistorial(previa), errores };
    }
    const datos = {
      divisaCompra: c.divisaCompra,
      divisaVenta: c.divisaVenta,
      ...(c.billeteCompra !== undefined ? { billeteCompra: c.billeteCompra, billeteVenta: c.billeteVenta ?? null } : {}),
      fuente: c.fuente,
      obtenidoEn: new Date(),
    };
    const [fila] = await prisma.$transaction([
      prisma.cotizacionUSD.upsert({ where: { fecha: aFechaDb(c.fecha) }, create: { fecha: aFechaDb(c.fecha), ...datos }, update: datos }),
      prisma.auditoria.create({ data: { fecha: new Date(), usuarioId: "sistema", accion: ACCION_OK, entidad: "CotizacionUSD", entidadId: c.fecha, detalle: `${c.fuente} · divisa ${c.divisaCompra} / ${c.divisaVenta}${errores.length ? ` · ${errores.join(" · ")}` : ""}`.slice(0, 500) } }),
      prisma.cambio.create({ data: { tipos: ["CotizacionUSD"], entidadIds: [c.fecha], usuarioId: null } }),
    ]);
    return { ok: true, fuente: c.fuente, cotizacion: filaAHistorial(fila), errores };
  })().finally(() => {
    g.__tcEnCurso = undefined;
  });
  return g.__tcEnCurso;
}

/** Dispara la actualización sin bloquear la respuesta (after() dentro de un request). */
async function actualizarEnSegundoPlano() {
  if (g.__tcEnCurso || Date.now() - (g.__tcUltimoIntento ?? 0) < ENTRE_INTENTOS_MS) return;
  g.__tcUltimoIntento = Date.now();
  const tarea = () => actualizarCotizacion().then(() => undefined, (e) => console.warn("[tipo-cambio] actualización en segundo plano", e));
  try {
    const { after } = await import("next/server");
    after(tarea);
  } catch {
    void tarea();
  }
}

/** Última fila y último fallo posterior (caché de 30 s por instancia; se invalida al actualizar). */
async function ultimaConocida(): Promise<{ ultima: Fila; error: Date | null }> {
  if (g.__tcCache && g.__tcCache.hasta > Date.now()) return g.__tcCache;
  const [ultima, fallo] = await Promise.all([
    prisma.cotizacionUSD.findFirst({ orderBy: [{ fecha: "desc" }] }),
    prisma.auditoria.findFirst({ where: { accion: ACCION_FALLO }, orderBy: { fecha: "desc" }, select: { fecha: true } }),
  ]);
  const error = fallo && (!ultima || fallo.fecha > ultima.obtenidoEn) ? fallo.fecha : null;
  g.__tcCache = { hasta: Date.now() + 30_000, ultima, error };
  return g.__tcCache;
}

/**
 * Tipo de cambio vigente. MANUAL → el valor cargado en Configuración. AUTO → la última cotización;
 * si es día hábil y tiene más de 2 h, dispara una actualización sin bloquear (y devuelve la última).
 * `config`: la del estado ya leído (el motor la pasa para no volver a consultar la base).
 */
export async function obtenerVigente(config?: Pick<Configuracion, "tipoCambioModo" | "tipoCambioManual">): Promise<Vigente> {
  let cfg: Pick<Configuracion, "tipoCambioModo" | "tipoCambioManual">;
  if (config) cfg = config;
  else {
    const c = await prisma.configuracion.findUnique({ where: { id: "config" }, select: { tipoCambioModo: true, tipoCambioManual: true } });
    cfg = { tipoCambioModo: c?.tipoCambioModo, tipoCambioManual: c?.tipoCambioManual?.toNumber() };
  }
  const hoy = hoyAR();
  const esDiaHabil = esHabil(hoy);
  if (cfg.tipoCambioModo === "MANUAL" && (cfg.tipoCambioManual ?? 0) > 0) {
    return { valor: cfg.tipoCambioManual!, compra: null, fecha: hoy, fuente: "MANUAL", obtenidoEn: null, modo: "MANUAL", desactualizado: false, ultimoError: null, esDiaHabil };
  }
  let { ultima, error } = await ultimaConocida();
  if (!ultima) {
    // Primera vez: no hay nada que mostrar, se espera la actualización.
    if (Date.now() - (g.__tcUltimoIntento ?? 0) >= ENTRE_INTENTOS_MS || g.__tcEnCurso) await actualizarCotizacion().catch(() => undefined);
    ({ ultima, error } = await ultimaConocida());
  } else if (esDiaHabil && Date.now() - ultima.obtenidoEn.getTime() > REFRESCO_MS) {
    await actualizarEnSegundoPlano();
  }
  if (!ultima) return { valor: null, compra: null, fecha: null, fuente: null, obtenidoEn: null, modo: "AUTO", desactualizado: true, ultimoError: error?.toISOString() ?? null, esDiaHabil };
  const fecha = deFechaDb(ultima.fecha);
  // Desactualizada: anterior al último día hábil completo (hoy hábil → ayer hábil; finde → viernes).
  const limite = habilAnterior(hoy);
  return {
    valor: ultima.divisaVenta.toNumber(),
    compra: ultima.divisaCompra.toNumber(),
    fecha,
    fuente: ultima.fuente as FuenteTipoCambio,
    obtenidoEn: ultima.obtenidoEn.toISOString(),
    modo: "AUTO",
    desactualizado: fecha < limite || error !== null,
    ultimoError: error?.toISOString() ?? null,
    esDiaHabil,
  };
}

/** Para el dominio (config.tipoCambioVigente): solo si hay valor. */
export function aDominio(v: Vigente): TipoCambioVigente | undefined {
  return v.valor && v.valor > 0 && v.fecha && v.fuente ? { valor: v.valor, fecha: `${v.fecha}T12:00:00.000Z`, fuente: v.fuente } : undefined;
}

/** Última cotización con fecha ≤ la pedida (reportes de períodos pasados). */
export async function obtenerParaFecha(fecha: string | Date): Promise<FilaHistorial | null> {
  const ymd = typeof fecha === "string" ? fecha.slice(0, 10) : hoyAR(fecha);
  if (Number.isNaN(Date.parse(ymd))) return null;
  const f = await prisma.cotizacionUSD.findFirst({ where: { fecha: { lte: aFechaDb(ymd) } }, orderBy: { fecha: "desc" } });
  return f ? filaAHistorial(f) : null;
}

/** Cotizaciones de los últimos `dias` días (más reciente primero). */
export async function historial(dias = 30): Promise<FilaHistorial[]> {
  const desde = aFechaDb(hoyAR(new Date(Date.now() - dias * 86_400_000)));
  const filas = await prisma.cotizacionUSD.findMany({ where: { fecha: { gte: desde } }, orderBy: { fecha: "desc" }, take: dias + 5 });
  return filas.map(filaAHistorial);
}

/** Limpieza del cron: filas de Cambio de más de 7 días (la sincronización solo mira las recientes). */
export async function purgarCambios(dias = 7): Promise<number> {
  // Siempre queda la última fila: la versión del estado es MAX(id).
  return prisma.$executeRaw`DELETE FROM "Cambio" WHERE "creadoEn" < ${new Date(Date.now() - dias * 86_400_000)} AND "id" < (SELECT MAX("id") FROM "Cambio")`;
}
