/** Esquemas de entrada (tupla de argumentos) de las acciones del módulo ventas. */
import { z } from "zod";
import { cantidad, circuito, condicionIVA, estadoCotizacion, fecha, fechaOpcional, formaPagoVenta, id, itemVenta, lineaEntrega, lista, medioCobro, modalidadEntrega, moneda, monto, origenVenta, porcentaje, ref, texto, unidad } from "./comunes";

const itemNPInput = z.object({
  id: ref.optional(),
  productoId: ref,
  obraId: ref.optional(),
  cantidad,
  precioUnitario: monto,
  descuentoPct: porcentaje.optional(),
  unidadVenta: unidad.optional(),
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
  clienteId: ref.optional(),
  prospectoNombre: texto.optional(),
  prospectoTelefono: texto.optional(),
  tipoCliente: z.string().max(40).optional(),
  estado: z.enum(["BORRADOR", "PENDIENTE"]).optional(),
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

const datosClienteVenta = z.object({
  razonSocial: texto,
  cuit: texto.optional(),
  condicionIVA: condicionIVA.optional(),
  telefono: texto.optional(),
  email: texto.optional(),
  direccion: texto.optional(),
  localidad: texto.optional(),
  tipo: z.string().max(40).optional(),
});

const cobroVenta = z.object({ medios: lista(medioCobro, 20) });

const extrasVenta = z.object({
  retiraAhora: z.boolean().optional(),
  facturar: z.boolean().optional(),
  cobro: cobroVenta.optional(),
  datosFactura: z.object({ ventaML: texto.optional(), compradorNombre: texto.optional(), compradorDoc: texto.optional() }).optional(),
});

const aceptacion = z.object({
  cliente: datosClienteVenta.optional(),
  circuito,
  formaPago: z.enum(["CONTADO", "CUENTA_CORRIENTE"]),
  sucursalId: ref.optional(),
  depositoId: ref.optional(),
  entrega: z.enum(["RETIRA_AHORA", "RETIRA_DESPUES", "ENVIO"]),
  fechaEntregaProgramada: fechaOpcional,
  direccionEntrega: texto.optional(),
  facturar: z.boolean(),
  cobro: cobroVenta.optional(),
  observaciones: texto.optional(),
  opciones: opcionesConfirmacion.optional(),
});

const resultadoArca = z.union([
  z.object({ ok: z.literal(true), cae: z.string().max(40), caeVencimiento: z.string().max(40), puntoVenta: z.number().int(), numero: z.number().int(), tipo: z.number().int() }),
  z.object({ ok: z.literal(false), error: texto }),
]);

export const crearVenta = z.tuple([notaPedidoInput, opcionesConfirmacion.optional(), extrasVenta, id.optional()]);
export const anularVenta = z.tuple([id, texto]);
export const recuperarVenta = z.tuple([id]);
export const anularFactura = z.tuple([id, texto]);
export const registrarResultadoArca = z.tuple([id, resultadoArca]);
export const aceptarCotizacion = z.tuple([id, aceptacion]);
export const rechazarCotizacion = z.tuple([id, texto.optional()]);
export const recuperarCotizacion = z.tuple([id]);
export const eliminarCotizacion = z.tuple([id]);
