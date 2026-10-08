/** Esquemas de entrada (tupla de argumentos) de las acciones del módulo clientes. */
import { z } from "zod";
import { clienteInput, id, lista, MAX_FILAS_IMPORTACION, texto } from "./comunes";

const obraInput = z.object({
  clienteId: id,
  nombre: texto,
  direccion: texto.optional(),
  localidad: texto.optional(),
  contacto: texto.optional(),
  activa: z.boolean(),
});

export const guardarCliente = z.tuple([clienteInput, id.optional()]);
export const guardarObra = z.tuple([obraInput, id.optional()]);
export const importarClientes = z.tuple([lista(z.object({ cliente: clienteInput, obras: lista(texto, 200) }), MAX_FILAS_IMPORTACION)]);
