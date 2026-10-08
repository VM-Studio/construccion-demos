/** Esquemas de entrada (tupla de argumentos) de las acciones del módulo ventas. */
import { z } from "zod";
import { cantidad, circuito, estadoCotizacion, fecha, fechaOpcional, formaPagoVenta, id, itemVenta, lineaEntrega, lista, modalidadEntrega, moneda, monto, origenVenta, porcentaje, ref, texto } from "./comunes";

const itemNPInput = z.object({
  id: ref.optional(),
  productoId: ref,
  obraId: ref.optional(),
  cantidad,
  precioUnitario: monto,
  descuentoPct: porcentaje.optional(),
});

const notaPedidoInput = z.object({
  clienteId: ref,
  sucursalId: ref,
  depositoId: ref,
  vendedorId: ref.optional(),
  fecha,
  circuito,
  origen: origenVenta,
  acopioId: ref.optional(),
  formaPago: formaPagoVenta,
  items: lista(itemNPInput),
  descuentoPct: porcentaje,
  pendienteEntrega: z.boolean(),
  modalidadEntrega,
  fechaEntregaProgramada: fechaOpcional,
  direccionEntrega: texto.optional(),
  observaciones: texto.optional(),
  cotizacionId: ref.optional(),
  moneda: moneda.optional(),
});

const opcionesConfirmacion = z.object({
  forzarSinDisponible: z.boolean().optional(),
  autorizarSaldoNegativo: z.boolean().optional(),
  excepcionCredito: z.boolean().optional(),
});

const cotizacionInput = z.object({
  clienteId: ref,
  obraId: ref.optional(),
  sucursalId: ref,
  circuito,
  fecha,
  validezDias: z.number().int().nonnegative().max(3650),
  items: lista(itemVenta),
  descuentoPct: porcentaje,
  observaciones: texto.optional(),
  moneda: moneda.optional(),
});

const devolucionInput = z.object({
  notaPedidoId: id,
  items: lista(lineaEntrega),
  motivo: texto,
  fecha: fecha.optional(),
});

export const guardarNotaPedido = z.tuple([notaPedidoInput, id.optional()]);
export const confirmarNotaPedido = z.tuple([id, opcionesConfirmacion.optional()]);
export const crearNotaPedido = z.tuple([notaPedidoInput, opcionesConfirmacion.optional(), id.optional()]);
export const eliminarBorradorNP = z.tuple([id]);
export const anularNotaPedido = z.tuple([id, texto]);
export const facturarNotaPedido = z.tuple([id]);
export const registrarDevolucion = z.tuple([devolucionInput]);
export const guardarCotizacion = z.tuple([cotizacionInput, id.optional()]);
export const cambiarEstadoCotizacion = z.tuple([id, estadoCotizacion]);
