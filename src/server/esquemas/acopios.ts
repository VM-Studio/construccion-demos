/** Esquemas de entrada (tupla de argumentos) de las acciones del módulo acopios (clientes). */
import { z } from "zod";
import { circuito, fecha, formaPagoAcopio, id, lista, MAX_ITEMS, medioCobro, monto, montoNoNegativo, porcentaje, ref, texto } from "./comunes";

const acopioInput = z.object({
  clienteId: ref,
  sucursalId: ref,
  depositoId: ref,
  vendedorId: ref.optional(),
  fechaCreacion: fecha,
  fechaVencimiento: fecha,
  circuito,
  obraIds: lista(ref, 200),
  importe: montoNoNegativo,
  alicuotaIIBBPct: porcentaje,
  formaPago: formaPagoAcopio,
  listaPreciosBaseId: ref,
  unidadNegocioId: ref,
  ajustesPrecio: z.record(z.string().max(100), montoNoNegativo).refine((r) => Object.keys(r).length <= MAX_ITEMS * 20, { message: "Demasiados ajustes" }).optional(),
  observaciones: texto.optional(),
  medios: lista(medioCobro, 50).optional(),
});

export const crearAcopio = z.tuple([acopioInput]);
export const traspasarSaldo = z.tuple([id, id, monto, texto.optional()]);
export const ajustarSaldoAcopio = z.tuple([id, monto, texto]);
export const extenderVencimientoAcopio = z.tuple([id, fecha]);
export const cancelarAcopio = z.tuple([id, texto]);
