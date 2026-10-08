/**
 * Pathname de los adjuntos en Vercel Blob, compartido entre el navegador (que lo arma antes de
 * subir) y el servidor (que lo verifica antes de firmar el token de subida):
 *   aceros-rnf/{entidadTipo}/{entidadId}/{clave}-{nombre-saneado}
 * `clave` es un nanoid de 16 caracteres; el id del Adjunto se deriva de ella (`adj_{clave}`),
 * así el registro desde el navegador y el webhook de Vercel apuntan a la misma fila.
 * Módulo puro: sin dependencias de servidor ni de navegador.
 */
import type { EntidadAdjunto } from "@/domain/types";

export const PREFIJO_BLOB = "aceros-rnf";
export const LARGO_CLAVE = 16;
const MAX_NOMBRE = 80;

export const ENTIDADES_ADJUNTO: readonly EntidadAdjunto[] = ["REMITO", "ACOPIO", "ACOPIO_PROVEEDOR", "NOTA_PEDIDO", "ORDEN_COMPRA", "RECEPCION", "CLIENTE", "PROVEEDOR", "COMPROBANTE"];

const RE_ID = /^[A-Za-z0-9_-]{1,100}$/;
const RE_CLAVE = new RegExp(`^[A-Za-z0-9_-]{${LARGO_CLAVE}}$`);
const RE_PATHNAME = new RegExp(`^${PREFIJO_BLOB}/([A-Z_]+)/([A-Za-z0-9_-]{1,100})/([A-Za-z0-9_-]{${LARGO_CLAVE}})-([a-z0-9._-]{1,${MAX_NOMBRE}})$`);

/** Fotos y PDF. SVG no: puede llevar scripts y se serviría desde nuestro dominio. */
export function esMimePermitido(tipo: string): boolean {
  return tipo === "application/pdf" || (tipo.startsWith("image/") && tipo !== "image/svg+xml");
}

/** Nombre apto para URL: sin acentos, minúsculas, solo [a-z0-9._-], máximo 80 caracteres (conserva la extensión). */
export function sanearNombre(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  if (!limpio) return "archivo";
  if (limpio.length <= MAX_NOMBRE) return limpio;
  const punto = limpio.lastIndexOf(".");
  const ext = punto > 0 && limpio.length - punto <= 10 ? limpio.slice(punto) : "";
  return `${limpio.slice(0, MAX_NOMBRE - ext.length).replace(/[-.]+$/g, "") || "archivo"}${ext}`;
}

export const esIdValido = (id: string) => RE_ID.test(id);
export const esClaveValida = (clave: string) => RE_CLAVE.test(clave);

export function armarPathname(entidadTipo: EntidadAdjunto, entidadId: string, clave: string, nombre: string): string {
  return `${PREFIJO_BLOB}/${entidadTipo}/${entidadId}/${clave}-${sanearNombre(nombre)}`;
}

export function analizarPathname(pathname: string): { entidadTipo: EntidadAdjunto; entidadId: string; clave: string; nombre: string } | null {
  const m = RE_PATHNAME.exec(pathname);
  if (!m || !ENTIDADES_ADJUNTO.includes(m[1] as EntidadAdjunto)) return null;
  return { entidadTipo: m[1] as EntidadAdjunto, entidadId: m[2], clave: m[3], nombre: m[4] };
}

export const idAdjuntoDe = (clave: string) => `adj_${clave}`;

/** Lo que el navegador manda en `clientPayload` (JSON). */
export interface DatosSubida {
  entidadTipo: EntidadAdjunto;
  entidadId: string;
  categoria: "REMITO_FIRMADO" | "FACTURA_PROVEEDOR" | "OTRO";
  nombre: string;
  tamanoBytes: number;
  tipoMime: string;
}
