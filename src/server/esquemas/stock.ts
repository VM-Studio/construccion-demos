/** Esquemas de entrada (tupla de argumentos) de las acciones del módulo stock. */
import { z } from "zod";
import { cantidad, id, lista, montoNoNegativo, ref, signo, texto } from "./comunes";

const itemTransferencia = z.object({ productoId: ref, cantidad });

const itemAjuste = z.object({
  productoId: ref,
  cantidad,
  signo,
  motivo: texto,
  costoUnitario: montoNoNegativo.optional(),
});

export const crearTransferencia = z.tuple([
  z.object({ depositoOrigenId: ref, depositoDestinoId: ref, items: lista(itemTransferencia), observacion: texto.optional() }),
]);
export const despacharTransferencia = z.tuple([id]);
export const recibirTransferencia = z.tuple([id]);
export const cancelarTransferencia = z.tuple([id]);
export const crearAjuste = z.tuple([z.object({ depositoId: ref, items: lista(itemAjuste), observacion: texto.optional() })]);
