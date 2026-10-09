/** Esquemas de entrada (tupla de argumentos) de las acciones del módulo catálogo. */
import { z } from "zod";
import { id, lista, MAX_CAMBIOS_PRECIO, MAX_FILAS_IMPORTACION, montoNoNegativo, porcentaje, productoInput, ref, texto } from "./comunes";

const cambioPrecio = z.object({ productoId: id, listaPreciosId: id, anterior: montoNoNegativo, nuevo: montoNoNegativo });

const listaPreciosInput = z.object({
  nombre: texto,
  descripcion: texto,
  markupPorDefecto: porcentaje,
  activa: z.boolean(),
});

const rubroInput = z.object({
  nombre: texto,
  orden: z.number().finite(),
  prefijo: texto,
  unidadNegocioId: ref,
});

export const guardarProducto = z.tuple([productoInput, id.optional()]);
export const actualizarPrecio = z.tuple([id, id, montoNoNegativo]);
const recalculoDesdeUSD = z.object({
  tipo: z.literal("DESDE_USD"),
  markups: z.record(z.string().max(100), porcentaje),
  redondeo: z.union([z.literal(1), z.literal(10), z.literal(100)]).optional(),
});

export const aplicarCambiosPrecios = z.tuple([lista(cambioPrecio, MAX_CAMBIOS_PRECIO), texto, recalculoDesdeUSD.optional()]);
export const guardarLista = z.tuple([listaPreciosInput, id.optional()]);
export const guardarRubro = z.tuple([rubroInput, id.optional()]);
export const importarArticulos = z.tuple([lista(productoInput, MAX_FILAS_IMPORTACION)]);
