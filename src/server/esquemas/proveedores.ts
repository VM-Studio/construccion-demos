/** Esquemas de entrada (tupla de argumentos) de las acciones del módulo proveedores. */
import { z } from "zod";
import { cantidad, circuito, fecha, formaPagoAcopio, id, lista, MAX_FILAS_IMPORTACION, MAX_ITEMS, moneda, montoNoNegativo, proveedorInput, ref, texto } from "./comunes";

const acopioProveedorInput = z.object({
  proveedorId: ref,
  sucursalId: ref,
  depositoDestinoId: ref,
  circuito,
  fechaCreacion: fecha,
  fechaVencimiento: fecha,
  modalidad: z.enum(["MONTO", "CANTIDAD"]),
  importe: montoNoNegativo.optional(),
  items: lista(z.object({ productoId: ref, cantidadPactada: cantidad })).optional(),
  formaPago: formaPagoAcopio,
  costos: z.record(z.string().max(100), montoNoNegativo).refine((r) => Object.keys(r).length <= MAX_ITEMS * 20, { message: "Demasiados costos" }),
  observaciones: texto.optional(),
  moneda: moneda.optional(),
});

export const guardarProveedor = z.tuple([proveedorInput, id.optional()]);
export const importarProveedores = z.tuple([lista(proveedorInput, MAX_FILAS_IMPORTACION)]);
export const crearAcopioProveedor = z.tuple([acopioProveedorInput]);
export const extenderVencimientoACP = z.tuple([id, fecha]);
export const cancelarACP = z.tuple([id, texto]);
