/** Esquemas de entrada (tupla de argumentos) de las acciones del módulo compras. */
import { z } from "zod";
import { cantidad, circuito, diferenciaRecepcion, estadoOC, fecha, id, lista, moneda, montoNoNegativo, origenVenta, porcentaje, ref, texto } from "./comunes";

const itemOC = z.object({
  id: ref,
  productoId: ref,
  cantidadPedida: cantidad,
  cantidadRecibida: cantidad,
  costoUnitario: montoNoNegativo,
  costoUSD: montoNoNegativo.optional(),
  descuentoPct: porcentaje,
});

const ocInput = z.object({
  proveedorId: ref,
  circuito,
  origen: origenVenta,
  acopioProveedorId: ref.optional(),
  depositoDestinoId: ref,
  sucursalId: ref,
  fechaEmision: fecha,
  fechaEntregaEstimada: fecha,
  items: lista(itemOC),
  observaciones: texto.optional(),
  moneda: moneda.optional(),
});

const recepcionInput = z.object({
  ordenCompraId: id,
  remitoProveedor: texto,
  facturaProveedor: texto.optional(),
  fecha,
  depositoId: ref,
  observaciones: texto.optional(),
  items: lista(
    z.object({
      itemOCId: id,
      cantidad,
      costoUnitario: montoNoNegativo,
      costoUSD: montoNoNegativo.optional(),
      diferencia: diferenciaRecepcion,
      observacion: texto.optional(),
    }),
  ),
});

export const guardarOC = z.tuple([ocInput, id.optional()]);
export const cambiarEstadoOC = z.tuple([id, estadoOC]);
export const cancelarSaldoOC = z.tuple([id]);
export const eliminarOC = z.tuple([id]);
export const recibirMercaderia = z.tuple([recepcionInput]);
export const reclamarOC = z.tuple([id, texto]);
