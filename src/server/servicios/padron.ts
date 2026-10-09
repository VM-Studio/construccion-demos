/**
 * Consulta del padrón por CUIT/CUIL para autocompletar clientes y proveedores:
 * 1. Valida formato y dígito verificador localmente.
 * 2. Caché (tabla PadronCache, 30 días).
 * 3. ARCA oficial (A13 + A5) si hay certificado (ARCA_CERT / ARCA_KEY); si no o si falla,
 * 4. fuente pública. Si todo falla, null y el formulario sigue manual.
 * Timeout total 8 s. No se auditan las consultas (son muchas); sí los errores del proveedor oficial.
 */
import type { Prisma } from "@prisma/client";
import { validarCUIT } from "@/domain/cuit";
import { cacheVigente, type DatosPadron } from "@/domain/padron";
import { prisma } from "../db-base";
import { configArca, ErrorArca, vencimientoCertificado } from "../arca/config";
import { consultarArca } from "../arca/padron";
import { consultarPublico } from "../padron/publico";

export type { DatosPadron };

const TIMEOUT_TOTAL_MS = 8000;

const conLimite = <T,>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

async function auditarErrorArca(e: ErrorArca, cuit: string) {
  await prisma.auditoria
    .create({ data: { fecha: new Date(), usuarioId: "sistema", accion: "Error del padrón de ARCA", entidad: "Sistema", entidadId: "arca", detalle: `${e.tipo} · ${cuit} · ${e.detalle ?? e.message}`.slice(0, 500) } })
    .catch(() => undefined);
}

/** Datos del padrón del CUIT, o null si no se pudo (el CUIT inválido también da null). */
export async function consultarPadron(cuit: string, opts: { forzar?: boolean } = {}): Promise<DatosPadron | null> {
  if (validarCUIT(cuit)) return null;
  const d = cuit.replace(/\D/g, "");
  const t0 = Date.now();
  if (!opts.forzar) {
    const c = await prisma.padronCache.findUnique({ where: { cuit: d } }).catch(() => null);
    if (c && cacheVigente(c.obtenidoEn)) return c.datos as unknown as DatosPadron;
  }
  let datos: DatosPadron | null = null;
  const cfg = configArca();
  if (cfg) {
    try {
      datos = await conLimite(consultarArca(cfg, d, 6000), TIMEOUT_TOTAL_MS - 500);
    } catch (e) {
      if (e instanceof ErrorArca) {
        await auditarErrorArca(e, d);
        if (e.tipo === "INEXISTENTE") return null;
      } else console.error("[padron] ARCA", e);
    }
  }
  if (!datos) {
    const resta = TIMEOUT_TOTAL_MS - (Date.now() - t0);
    if (resta > 1000) datos = await conLimite(consultarPublico(d), resta);
  }
  if (datos) {
    const json = datos as unknown as Prisma.InputJsonValue;
    await prisma.padronCache.upsert({ where: { cuit: d }, create: { cuit: d, datos: json, obtenidoEn: new Date(datos.obtenidoEn) }, update: { datos: json, obtenidoEn: new Date(datos.obtenidoEn) } }).catch(() => undefined);
  }
  return datos;
}

/** Estado para Configuración → Parámetros. */
export function estadoPadron(): { fuente: "ARCA" | "PUBLICO"; entorno?: "homologacion" | "produccion"; certVence?: string } {
  const cfg = configArca();
  if (!cfg) return { fuente: "PUBLICO" };
  const vence = vencimientoCertificado(cfg);
  return { fuente: "ARCA", entorno: cfg.entorno, certVence: vence?.toISOString() };
}
