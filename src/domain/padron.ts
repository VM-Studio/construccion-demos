/**
 * Padrón de ARCA (reglas puras): tipos, mapeo de las respuestas de los web services A13/A5,
 * validez de la caché y cómo se completan los formularios sin pisar lo que ya escribió el usuario.
 */
import type { CondicionIVA } from "./types";

export type CondicionPadron = CondicionIVA | "NO_INSCRIPTO";

export interface DatosPadron {
  cuit: string;
  razonSocial: string;
  tipoPersona: "FISICA" | "JURIDICA";
  /** Vacía si el proveedor no la informa (ej. A13 sin A5): se elige a mano. */
  condicionIVA?: CondicionPadron;
  domicilio?: string;
  localidad?: string;
  provincia?: string;
  codigoPostal?: string;
  estado: "ACTIVO" | "INACTIVO";
  fuente: "ARCA" | "PUBLICO";
  obtenidoEn: string;
}

/** Validez de la caché del padrón: 30 días. */
export const VALIDEZ_CACHE_MS = 30 * 24 * 60 * 60 * 1000;

export function cacheVigente(obtenidoEn: string | Date, ahora = new Date()): boolean {
  const t = new Date(obtenidoEn).getTime();
  return Number.isFinite(t) && ahora.getTime() - t < VALIDEZ_CACHE_MS;
}

/** La condición del padrón llevada a la del sistema (NO_INSCRIPTO se factura como consumidor final). */
export function condicionSistema(c: CondicionPadron | undefined): CondicionIVA | undefined {
  if (!c) return undefined;
  return c === "NO_INSCRIPTO" ? "CF" : c;
}

const titulo = (s?: string | null) =>
  (s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-záéíóúñü])/g, (_, a: string, b: string) => a + b.toUpperCase());

const lista = <T,>(x: T | T[] | undefined | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

// ───────────────────────── ARCA: ws_sr_padron_a13 ─────────────────────────

/** `personaReturn.persona` de A13 (ya parseado de XML a objeto). */
export interface PersonaA13 {
  idPersona?: string | number;
  tipoPersona?: string;
  razonSocial?: string;
  nombre?: string;
  apellido?: string;
  estadoClave?: string;
  domicilio?: DomicilioA13 | DomicilioA13[];
}
interface DomicilioA13 {
  tipoDomicilio?: string;
  direccion?: string;
  localidad?: string;
  descripcionProvincia?: string;
  /** A13 lo informa como `codPostal`. */
  codPostal?: string | number;
  codigoPostal?: string | number;
}

export function mapearA13(p: PersonaA13, ahora = new Date()): Omit<DatosPadron, "condicionIVA"> {
  const juridica = String(p.tipoPersona ?? "").toUpperCase() === "JURIDICA";
  const nombre = juridica ? (p.razonSocial ?? "").trim() : [p.apellido, p.nombre].filter(Boolean).join(" ").trim() || (p.razonSocial ?? "").trim();
  const doms = lista(p.domicilio);
  const fiscal = doms.find((d) => String(d.tipoDomicilio ?? "").toUpperCase() === "FISCAL") ?? doms[0];
  return {
    cuit: String(p.idPersona ?? ""),
    razonSocial: juridica ? nombre.toUpperCase() : titulo(nombre),
    tipoPersona: juridica ? "JURIDICA" : "FISICA",
    domicilio: fiscal?.direccion ? titulo(fiscal.direccion) : undefined,
    localidad: fiscal?.localidad ? titulo(fiscal.localidad) : undefined,
    provincia: fiscal?.descripcionProvincia ? titulo(fiscal.descripcionProvincia) : undefined,
    codigoPostal: (() => {
      const cp = fiscal?.codPostal ?? fiscal?.codigoPostal;
      return cp != null && String(cp).trim() ? String(cp).trim() : undefined;
    })(),
    estado: String(p.estadoClave ?? "ACTIVO").toUpperCase() === "ACTIVO" ? "ACTIVO" : "INACTIVO",
    fuente: "ARCA",
    obtenidoEn: ahora.toISOString(),
  };
}

// ───────────────────────── ARCA: ws_sr_padron_a5 ─────────────────────────

/** `personaReturn` de A5 (ya parseado): impuestos del régimen general y datos de monotributo. */
export interface PersonaA5 {
  datosRegimenGeneral?: { impuesto?: ImpuestoA5 | ImpuestoA5[] };
  datosMonotributo?: { categoriaMonotributo?: unknown; impuesto?: ImpuestoA5 | ImpuestoA5[] };
  errorConstancia?: unknown;
}
interface ImpuestoA5 {
  idImpuesto?: string | number;
  estadoImpuesto?: string;
}

/**
 * Condición frente al IVA desde A5: categoría de monotributo → MONOTRIBUTO; impuesto 30 (IVA)
 * activo → RI; 32 (IVA exento) → EXENTO; si solo tiene ganancias (20) o nada → NO_INSCRIPTO.
 */
export function condicionDesdeA5(p: PersonaA5): CondicionPadron {
  if (p.datosMonotributo && (p.datosMonotributo.categoriaMonotributo || lista(p.datosMonotributo.impuesto).length)) return "MONOTRIBUTO";
  const imp = lista(p.datosRegimenGeneral?.impuesto).filter((i) => !i.estadoImpuesto || String(i.estadoImpuesto).toUpperCase() === "AC");
  const ids = new Set(imp.map((i) => Number(i.idImpuesto)));
  if (ids.has(30)) return "RI";
  if (ids.has(32)) return "EXENTO";
  return "NO_INSCRIPTO";
}

// ───────────────────────── Formularios ─────────────────────────

export interface CamposPadron {
  razonSocial: string;
  condicionIVA: CondicionIVA;
  direccion: string;
  localidad?: string;
  provincia?: string;
  codigoPostal?: string;
}

/**
 * Valores del padrón para el formulario. Sin `reemplazar` solo se completan los campos vacíos
 * (o los que el usuario no tocó, `tocados`); con `reemplazar` se pisan todos los que trae el padrón.
 */
export function completarDesdePadron<T extends CamposPadron>(form: T, datos: DatosPadron, opts: { reemplazar?: boolean; tocados?: ReadonlySet<string> } = {}): Partial<T> {
  const cambios: Partial<CamposPadron> = {};
  const libre = (k: keyof CamposPadron) => opts.reemplazar || (!opts.tocados?.has(k) && !String(form[k] ?? "").trim());
  const poner = <K extends keyof CamposPadron>(k: K, v: CamposPadron[K] | undefined) => {
    if (v !== undefined && v !== "" && libre(k)) cambios[k] = v;
  };
  poner("razonSocial", datos.razonSocial);
  poner("direccion", datos.domicilio);
  poner("localidad", datos.localidad);
  poner("provincia", datos.provincia);
  poner("codigoPostal", datos.codigoPostal);
  // La condición de IVA siempre tiene un valor por defecto en el formulario: se completa salvo que el usuario la haya elegido.
  const iva = condicionSistema(datos.condicionIVA);
  if (iva && (opts.reemplazar || !opts.tocados?.has("condicionIVA"))) cambios.condicionIVA = iva;
  return cambios as Partial<T>;
}
