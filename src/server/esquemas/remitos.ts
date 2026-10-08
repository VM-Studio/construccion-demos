/** Esquemas de entrada (tupla de argumentos) de las acciones del módulo remitos (incluye adjuntos). */
import { z } from "zod";
import { categoriaAdjunto, entidadAdjunto, id, lineaEntrega, lista, ref, texto } from "./comunes";

const adjuntoInput = z.object({
  id: ref.optional(),
  entidadTipo: entidadAdjunto,
  entidadId: id,
  nombre: texto,
  tamanoBytes: z.number().int().nonnegative(),
  tipoMime: z.string().max(200),
  categoria: categoriaAdjunto,
  blobKey: texto,
  url: texto.optional(),
});

export const generarRemito = z.tuple([
  id,
  z.object({ lineas: lista(lineaEntrega).optional(), estado: z.enum(["INICIAL", "PICKING", "HECHO"]).optional() }).optional(),
]);
export const retiroEnMostrador = z.tuple([id, lista(lineaEntrega).optional()]);
export const iniciarPicking = z.tuple([id]);
export const marcarRemitoHecho = z.tuple([id]);
export const anularRemito = z.tuple([id, texto]);
export const comentarRemito = z.tuple([id, texto]);
export const registrarAdjunto = z.tuple([adjuntoInput]);
export const eliminarAdjuntoMeta = z.tuple([id]);
