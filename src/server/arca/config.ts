/**
 * Configuración del acceso a los web services de ARCA. Las credenciales vienen de variables de
 * entorno: ARCA_CUIT (de Aceros RNF), ARCA_CERT y ARCA_KEY (PEM en base64) y ARCA_ENTORNO.
 */
import forge from "node-forge";

export type EntornoArca = "homologacion" | "produccion";

export interface ConfigArca {
  cuit: string;
  certPem: string;
  keyPem: string;
  entorno: EntornoArca;
}

const pem = (b64?: string) => {
  if (!b64) return null;
  const t = b64.trim();
  return t.startsWith("-----BEGIN") ? t : Buffer.from(t, "base64").toString("utf8");
};

/** null si falta alguna variable: entonces se usa la fuente pública. */
export function configArca(): ConfigArca | null {
  const certPem = pem(process.env.ARCA_CERT);
  const keyPem = pem(process.env.ARCA_KEY);
  const cuit = (process.env.ARCA_CUIT ?? "").replace(/\D/g, "");
  if (!certPem || !keyPem || cuit.length !== 11) return null;
  return { cuit, certPem, keyPem, entorno: process.env.ARCA_ENTORNO === "produccion" ? "produccion" : "homologacion" };
}

/** Vencimiento del certificado configurado (para Configuración y la alerta de 30 días). */
export function vencimientoCertificado(cfg: ConfigArca | null = configArca()): Date | null {
  if (!cfg) return null;
  try {
    return forge.pki.certificateFromPem(cfg.certPem).validity.notAfter;
  } catch {
    return null;
  }
}

export const URLS = {
  wsaa: { homologacion: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms", produccion: "https://wsaa.afip.gov.ar/ws/services/LoginCms" },
  a13: { homologacion: "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA13", produccion: "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA13" },
  a5: { homologacion: "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5", produccion: "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5" },
} as const;

/** Errores de ARCA con mensaje para la interfaz. */
export class ErrorArca extends Error {
  constructor(
    readonly tipo: "CERTIFICADO_VENCIDO" | "NO_HABILITADO" | "INEXISTENTE" | "CAIDO" | "OTRO",
    mensaje: string,
    readonly detalle?: string,
  ) {
    super(mensaje);
  }
}

/** Clasifica un faultstring de ARCA. */
export function errorDesdeFault(fault: string): ErrorArca {
  const f = fault.toLowerCase();
  if (/expir|vencid|caduc/.test(f) && /certif/.test(f)) return new ErrorArca("CERTIFICADO_VENCIDO", "El certificado de ARCA está vencido: hay que renovarlo.", fault);
  if (/no autorizado|not authorized|no habilitad|computador no autorizado/.test(f)) return new ErrorArca("NO_HABILITADO", "El servicio de padrón no está habilitado para el certificado de ARCA.", fault);
  if (/no existe persona|inexistente|no se encontr/.test(f)) return new ErrorArca("INEXISTENTE", "El CUIT no existe en el padrón de ARCA.", fault);
  return new ErrorArca("OTRO", "ARCA respondió con un error.", fault);
}
