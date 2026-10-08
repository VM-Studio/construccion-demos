"use client";

/**
 * Adjuntos: los archivos viven en Vercel Blob (store privado). El navegador sube directo a Blob
 * con un token que firma `/api/adjuntos/upload` (sesión, permiso, tipo y tamaño verificados en el
 * servidor) y, al terminar, registra la fila Adjunto con la acción de negocio `registrarAdjunto`.
 * Ver, descargar y eliminar pasan por `/api/adjuntos/[id]`.
 */
import { upload } from "@vercel/blob/client";
import { nanoid } from "nanoid";
import type { CategoriaAdjunto, EntidadAdjunto } from "@/domain/types";
import type { Diferencia } from "@/capacitacion/slice";
import { useStore } from "@/store";
import { obtenerDb } from "@/lib/datos/almacen";
import { aplicarResultadoPropio } from "@/lib/datos/proveedor";
import { armarPathname, esIdValido, esMimePermitido, idAdjuntoDe, LARGO_CLAVE, type DatosSubida } from "@/app/api/adjuntos/ruta-blob";

export const ACCEPT_ADJUNTOS = "image/*,application/pdf";

type Meta = { entidadTipo: EntidadAdjunto; entidadId: string; categoria: CategoriaAdjunto; nombre?: string };

export function validarArchivo(file: File, maxMB: number): string | null {
  if (!esMimePermitido(file.type)) return `Tipo de archivo no permitido (${file.type || "desconocido"}). Subí una foto o un PDF.`;
  if (file.size > maxMB * 1024 * 1024) return `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${maxMB} MB.`;
  if (!file.size) return "El archivo está vacío.";
  return null;
}

/** Sube el archivo a Vercel Blob y registra la metadata (fila Adjunto) en el servidor. */
export async function guardarAdjunto(file: File, meta: Meta): Promise<{ ok: true; id: string; efectos: Diferencia[] } | { ok: false; error: string }> {
  const maxMB = obtenerDb().config.tamanoMaxAdjuntoMB || 10;
  const err = validarArchivo(file, maxMB);
  if (err) return { ok: false, error: err };
  if (!esIdValido(meta.entidadId)) return { ok: false, error: "Documento inválido." };
  const nombre = meta.nombre ?? file.name;
  const clave = nanoid(LARGO_CLAVE);
  const pathname = armarPathname(meta.entidadTipo, meta.entidadId, clave, nombre);
  const datos: DatosSubida = { entidadTipo: meta.entidadTipo, entidadId: meta.entidadId, categoria: meta.categoria, nombre, tamanoBytes: file.size, tipoMime: file.type };
  let blob: Awaited<ReturnType<typeof upload>>;
  try {
    blob = await upload(pathname, file, { access: "private", handleUploadUrl: "/api/adjuntos/upload", clientPayload: JSON.stringify(datos), contentType: file.type });
  } catch (e) {
    console.warn("[adjuntos] upload", e);
    return { ok: false, error: "No se pudo subir el archivo. Revisá la conexión y tus permisos, y probá de nuevo." };
  }
  const r = await useStore.getState().registrarAdjunto({ id: idAdjuntoDe(clave), ...datos, blobKey: blob.pathname, url: blob.url });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, id: r.data, efectos: r.efectos };
}

/** Adjunta un enlace web (solo metadata, sin archivo). */
export async function adjuntarEnlace(url: string, meta: Meta) {
  if (!/^https?:\/\/\S+\.\S+/.test(url)) return { ok: false as const, error: "Ingresá una dirección web válida (https://…)." };
  return useStore.getState().registrarAdjunto({ ...meta, nombre: meta.nombre?.trim() || url, tamanoBytes: 0, tipoMime: "text/uri-list", blobKey: "", url });
}

/** URL para ver el adjunto (la sirve el servidor verificando sesión y permisos). */
export function obtenerUrl(adjuntoId: string, opts: { descargar?: boolean } = {}): string {
  return `/api/adjuntos/${encodeURIComponent(adjuntoId)}${opts.descargar ? "?descargar=1" : ""}`;
}

/** Descarga el archivo; devuelve false si no está disponible o no hay permiso. */
export async function descargarAdjunto(adjuntoId: string, nombre: string): Promise<boolean> {
  try {
    const res = await fetch(obtenerUrl(adjuntoId, { descargar: true }));
    if (!res.ok) return false;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/** Elimina el archivo y su metadata en el servidor (y refresca los datos). */
export async function eliminarAdjunto(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(obtenerUrl(id), { method: "DELETE" });
    const r = (await res.json()) as { ok: boolean; error?: string; tipos?: string[] };
    if (!r.ok) return { ok: false, error: r.error ?? "No se pudo eliminar el adjunto." };
    await aplicarResultadoPropio(r.tipos ?? ["Adjunto", "Remito"]).catch(() => undefined);
    return { ok: true };
  } catch {
    return { ok: false, error: "No hay conexión con el servidor. Revisá internet y probá de nuevo." };
  }
}
