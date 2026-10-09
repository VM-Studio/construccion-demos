import "server-only";
/**
 * Adjuntos en Vercel Blob (store PRIVADO). El navegador sube directo a Blob con un token que
 * firma `/api/adjuntos/upload` después de verificar sesión, permiso sobre la entidad, tipo y
 * tamaño; la fila Adjunto se registra con la acción de negocio `registrarAdjunto` (motor).
 * Ver / descargar / eliminar pasan siempre por `/api/adjuntos/[id]`: el token nunca sale del servidor.
 */
import { del, get } from "@vercel/blob";
import type { PutBlobResult } from "@vercel/blob";
import { puede, type Permiso } from "@/domain/permisos";
import type { Adjunto, EntidadAdjunto, EstadoInicial, Usuario } from "@/domain/types";
import { analizarPathname, esClaveValida, esIdValido, esMimePermitido, idAdjuntoDe, ENTIDADES_ADJUNTO, type DatosSubida } from "@/app/api/adjuntos/ruta-blob";
import { prisma } from "../db";
import { leerColeccion } from "../datos/mapeo";
import { obtenerEstado } from "../estado";
import { estadoPara } from "../lectura";
import type { Contexto, ResultadoServidor } from "../motor";
import { eliminarAdjuntoMeta, registrarAdjunto } from "./remitos";
import { ErrorPermiso } from "./base";

/** Error con estado HTTP y mensaje apto para mostrar. */
export class ErrorAdjunto extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

const PERMISO_POR_ENTIDAD: Record<EntidadAdjunto, Permiso[]> = {
  REMITO: ["remitos.ver"],
  ACOPIO: ["acopios.ver"],
  ACOPIO_PROVEEDOR: ["compras.ver", "proveedores.ver"],
  NOTA_PEDIDO: ["ventas.ver"],
  ORDEN_COMPRA: ["compras.ver"],
  RECEPCION: ["compras.ver"],
  CLIENTE: ["clientes.ver"],
  PROVEEDOR: ["proveedores.ver"],
  COMPROBANTE: ["ventas.ver", "ctacte.ver"],
};

const COLECCION_POR_ENTIDAD: Record<EntidadAdjunto, keyof EstadoInicial> = {
  REMITO: "remitos",
  ACOPIO: "acopios",
  ACOPIO_PROVEEDOR: "acopiosProveedor",
  NOTA_PEDIDO: "notasPedido",
  ORDEN_COMPRA: "ordenesCompra",
  RECEPCION: "recepciones",
  CLIENTE: "clientes",
  PROVEEDOR: "proveedores",
  COMPROBANTE: "comprobantes",
};

/** El actor tiene el permiso del módulo y la entidad le es visible (rol, circuito 2). */
export async function exigirAccesoEntidad(actor: Usuario, entidadTipo: EntidadAdjunto, entidadId: string) {
  if (!PERMISO_POR_ENTIDAD[entidadTipo]?.some((p) => puede(actor, p))) throw new ErrorAdjunto(403, "No tenés permiso para ver los adjuntos de este documento.");
  const { db } = await estadoPara(actor);
  const lista = db[COLECCION_POR_ENTIDAD[entidadTipo]] as { id: string }[];
  if (!lista.some((x) => x.id === entidadId)) throw new ErrorAdjunto(404, "El documento no existe o no tenés acceso.");
}

async function maxBytes(): Promise<number> {
  const { db } = await obtenerEstado();
  return (db.config.tamanoMaxAdjuntoMB || 10) * 1024 * 1024;
}

function leerDatos(clientPayload: string | null): DatosSubida {
  let d: Partial<DatosSubida>;
  try {
    d = JSON.parse(clientPayload ?? "") as Partial<DatosSubida>;
  } catch {
    throw new ErrorAdjunto(400, "Datos de subida inválidos.");
  }
  if (
    !d ||
    !ENTIDADES_ADJUNTO.includes(d.entidadTipo as EntidadAdjunto) ||
    typeof d.entidadId !== "string" ||
    !esIdValido(d.entidadId) ||
    !["REMITO_FIRMADO", "FACTURA_PROVEEDOR", "OTRO"].includes(d.categoria as string) ||
    typeof d.nombre !== "string" ||
    !d.nombre.trim() ||
    d.nombre.length > 300 ||
    typeof d.tamanoBytes !== "number" ||
    !Number.isInteger(d.tamanoBytes) ||
    d.tamanoBytes <= 0 ||
    typeof d.tipoMime !== "string"
  )
    throw new ErrorAdjunto(400, "Datos de subida inválidos.");
  return d as DatosSubida;
}

/** Payload firmado que viaja con el token y vuelve en el webhook `onUploadCompleted`. */
interface DatosToken extends DatosSubida {
  actorId: string;
  adjuntoId: string;
}

/** `onBeforeGenerateToken`: valida todo y devuelve las restricciones del token de subida. */
export async function prepararSubida(actor: Usuario, pathname: string, clientPayload: string | null) {
  const d = leerDatos(clientPayload);
  const p = analizarPathname(pathname);
  if (!p || p.entidadTipo !== d.entidadTipo || p.entidadId !== d.entidadId || !esClaveValida(p.clave)) throw new ErrorAdjunto(400, "Ruta de archivo inválida.");
  if (!esMimePermitido(d.tipoMime)) throw new ErrorAdjunto(415, "Tipo de archivo no permitido. Subí una foto o un PDF.");
  const max = await maxBytes();
  if (d.tamanoBytes > max) throw new ErrorAdjunto(413, `El archivo supera el máximo de ${Math.round(max / 1024 / 1024)} MB.`);
  if (!puede(actor, "remitos.ver")) throw new ErrorAdjunto(403, "No tenés permiso para adjuntar archivos.");
  await exigirAccesoEntidad(actor, d.entidadTipo, d.entidadId);
  const tokenPayload: DatosToken = { ...d, actorId: actor.id, adjuntoId: idAdjuntoDe(p.clave) };
  return {
    allowedContentTypes: [d.tipoMime],
    maximumSizeInBytes: max,
    addRandomSuffix: false,
    allowOverwrite: false,
    validUntil: Date.now() + 10 * 60 * 1000,
    tokenPayload: JSON.stringify(tokenPayload),
  };
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function existeAdjunto(id: string, blobKey: string) {
  return (await prisma.adjunto.count({ where: { OR: [{ id }, { blobKey }] } })) > 0;
}

/**
 * `onUploadCompleted` (webhook de Vercel, solo en despliegues): si el navegador ya registró la
 * fila no hace nada; si no (pestaña cerrada a mitad de camino), la registra con el actor del token.
 */
export async function completarSubida(blob: PutBlobResult, tokenPayload: string | null | undefined) {
  let d: DatosToken;
  try {
    d = JSON.parse(tokenPayload ?? "") as DatosToken;
  } catch {
    return;
  }
  if (!d?.adjuntoId) return;
  // El navegador registra apenas termina `upload()`: le damos margen para no duplicar.
  for (const ms of [0, 4000, 6000]) {
    await espera(ms);
    if (await existeAdjunto(d.adjuntoId, blob.pathname)) return;
  }
  const { db } = await obtenerEstado();
  const actor = db.usuarios.find((u) => u.id === d.actorId && u.activo);
  if (!actor) return;
  try {
    const r = await registrarAdjunto(
      { actor },
      { id: d.adjuntoId, entidadTipo: d.entidadTipo, entidadId: d.entidadId, categoria: d.categoria, nombre: d.nombre, tamanoBytes: d.tamanoBytes, tipoMime: d.tipoMime, blobKey: blob.pathname, url: blob.url },
    );
    if (!r.ok && !(await existeAdjunto(d.adjuntoId, blob.pathname))) console.warn("[adjuntos] webhook: no se pudo registrar", r.error);
  } catch (e) {
    console.warn("[adjuntos] webhook: no se pudo registrar", e);
  }
}

export async function buscarAdjunto(id: string): Promise<Adjunto | undefined> {
  if (!esIdValido(id)) return undefined;
  return (await leerColeccion(prisma, "adjuntos", { where: { id } }))[0];
}

function disposicion(tipo: "inline" | "attachment", nombre: string) {
  const ascii = nombre.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

/** Respuesta con el archivo (stream del blob privado). Los enlaces web redirigen. */
export async function servirAdjunto(actor: Usuario, id: string, descargar: boolean): Promise<Response> {
  const a = await buscarAdjunto(id);
  if (!a) throw new ErrorAdjunto(404, "El adjunto no existe.");
  await exigirAccesoEntidad(actor, a.entidadTipo, a.entidadId);
  if (!a.blobKey) {
    if (a.url && /^https?:\/\//i.test(a.url)) return Response.redirect(a.url, 302);
    throw new ErrorAdjunto(404, "El adjunto no tiene archivo.");
  }
  const r = await get(a.blobKey, { access: "private" }).catch((e: unknown) => {
    console.warn("[adjuntos] get", a.blobKey, e);
    return null;
  });
  if (!r || r.statusCode !== 200) throw new ErrorAdjunto(404, "El archivo no está disponible.");
  const tipo = esMimePermitido(a.tipoMime) ? a.tipoMime : "application/octet-stream";
  return new Response(r.stream, {
    headers: {
      "Content-Type": tipo,
      "Content-Length": String(r.blob.size),
      "Content-Disposition": disposicion(descargar || tipo === "application/octet-stream" ? "attachment" : "inline", a.nombre),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Borra la fila (acción de negocio: solo quien lo subió o DUEÑO/ADMIN) y después el blob. */
export async function borrarAdjunto(ctx: Contexto, id: string): Promise<ResultadoServidor> {
  const a = await buscarAdjunto(id);
  if (!a) throw new ErrorAdjunto(404, "El adjunto no existe.");
  await exigirAccesoEntidad(ctx.actor, a.entidadTipo, a.entidadId);
  let r: ResultadoServidor;
  try {
    r = await eliminarAdjuntoMeta(ctx, id);
  } catch (e) {
    if (e instanceof ErrorPermiso) throw new ErrorAdjunto(403, e.message);
    throw e;
  }
  if (!r.ok) return r;
  if (a.blobKey) await del(a.blobKey).catch((e: unknown) => console.warn("[adjuntos] no se pudo borrar el blob", a.blobKey, e));
  return r;
}

