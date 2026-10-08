/**
 * Esquemas zod comunes a todas las acciones: ids, fechas, montos, cantidades, enums del
 * dominio y entidades que viajan completas. Solo validan estructura, tipos y límites; las
 * reglas de negocio (stock, saldos, permisos) las aplica el dominio.
 */
import { z } from "zod";

// ───────────────────────── Límites ─────────────────────────

export const MAX_TEXTO = 2000;
export const MAX_ITEMS = 1000;
export const MAX_FILAS_IMPORTACION = 5000;
/** Actualización masiva de precios: productos × listas (5.000 artículos × 4 listas). */
export const MAX_CAMBIOS_PRECIO = 20000;

// ───────────────────────── Primitivos ─────────────────────────

/** Id de una entidad pasado como argumento propio de la acción (nunca vacío). */
export const id = z.string().min(1).max(100);
/**
 * Referencia a otra entidad dentro de un formulario. Puede llegar vacía (selector sin elegir):
 * el dominio responde con el mensaje correspondiente ("Elegí un cliente.", etc.).
 */
export const ref = z.string().max(100);
export const texto = z.string().max(MAX_TEXTO);
export const lista = <T extends z.ZodType>(item: T, max = MAX_ITEMS) => z.array(item).max(max);

/** Fecha ISO (o cualquier fecha que `Date.parse` entienda). */
export const fecha = z
  .string()
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Fecha inválida" });
/** Fecha opcional de formulario: puede llegar vacía. */
export const fechaOpcional = z.union([fecha, z.literal("")]).optional();

export const monto = z.number().finite();
export const montoNoNegativo = z.number().finite().nonnegative();
export const cantidad = z.number().finite().nonnegative();
export const porcentaje = z.number().finite().min(-100).max(10000);
export const entero = z.number().int();
export const enteroNoNegativo = z.number().int().nonnegative();

// ───────────────────────── Enums del dominio ─────────────────────────

export const circuito = z.union([z.literal(1), z.literal(2)]);
export const signo = z.union([z.literal(1), z.literal(-1)]);
export const rol = z.enum(["DUENO", "ADMINISTRACION", "VENTAS", "DEPOSITO"]);
export const unidad = z.enum(["UN", "BOLSA", "M3", "M2", "ML", "KG", "LT", "PALLET", "CAJA", "ROLLO", "PLACA", "TN"]);
export const codigoUnidadNegocio = z.enum(["FER", "COR"]);
export const estadoOC = z.enum(["BORRADOR", "ENVIADA", "CONFIRMADA", "RECIBIDA_PARCIAL", "RECIBIDA", "CANCELADA"]);
export const estadoCotizacion = z.enum(["BORRADOR", "ENVIADA", "ACEPTADA", "RECHAZADA", "VENCIDA"]);
export const estadoCheque = z.enum(["EN_CARTERA", "DEPOSITADO", "ENTREGADO", "RECHAZADO"]);
export const tipoCliente = z.enum(["CONSTRUCTORA", "CORRALON", "FERRETERIA", "PARTICULAR", "ARQUITECTO"]);
export const tipoProveedor = z.enum(["FABRICANTE", "DISTRIBUIDOR", "TRANSPORTISTA", "SERVICIOS"]);
export const condicionPago = z.enum(["CONTADO", "CTA_CTE_15", "CTA_CTE_30", "CTA_CTE_60", "ANTICIPO"]);
export const medioPago = z.enum(["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "ECHEQ", "TARJETA", "MERCADOPAGO"]);
export const condicionIVA = z.enum(["RI", "MONOTRIBUTO", "EXENTO", "CF"]);
export const formaPagoAcopio = z.enum(["ANTICIPO", "CUENTA_CORRIENTE"]);
export const formaPagoVenta = z.enum(["CONTADO", "CUENTA_CORRIENTE", "ACOPIO"]);
export const origenVenta = z.enum(["NUEVA", "ACOPIO"]);
export const modalidadEntrega = z.enum(["ENVIO", "RETIRA"]);
export const moneda = z.enum(["ARS", "USD"]);
export const diferenciaRecepcion = z.enum(["OK", "FALTANTE", "ROTURA", "EXTRA"]);
export const categoriaAdjunto = z.enum(["REMITO_FIRMADO", "FACTURA_PROVEEDOR", "OTRO"]);
export const entidadAdjunto = z.enum(["REMITO", "ACOPIO", "ACOPIO_PROVEEDOR", "NOTA_PEDIDO", "ORDEN_COMPRA", "RECEPCION", "CLIENTE", "PROVEEDOR", "COMPROBANTE"]);

// ───────────────────────── Piezas compartidas ─────────────────────────

/** Snapshot del dólar en documentos en USD (`ConTipoCambio`). */
export const conTipoCambio = {
  moneda: moneda.optional(),
  tipoCambioAplicado: z.number().finite().positive().optional(),
  tipoCambioFecha: fechaOpcional,
};

export const medioCobro = z.object({
  medio: medioPago,
  importe: monto,
  referencia: texto.optional(),
  banco: texto.optional(),
  numeroCheque: texto.optional(),
  fechaCobro: fechaOpcional,
  chequeId: ref.optional(),
});

export const imputacion = z.object({
  comprobanteId: id,
  importe: monto,
});

/** Línea de cotización / comprobante (`ItemVenta`). */
export const itemVenta = z.object({
  id: ref,
  productoId: ref,
  obraId: ref.optional(),
  cantidad,
  precioUnitario: monto,
  costoUnitarioSnapshot: monto,
  descuentoPct: porcentaje,
});

/** Líneas de entrega parcial (remito, despacho, devolución). */
export const lineaEntrega = z.object({ itemId: id, cantidad });

// ───────────────────────── Entidades que viajan completas ─────────────────────────

export const productoInput = z.object({
  codigo: texto,
  nombre: texto,
  descripcion: texto.optional(),
  rubroId: ref,
  unidadNegocioId: ref,
  marca: texto.optional(),
  unidad,
  unidadesPorPallet: cantidad.optional(),
  proveedorHabitualId: ref.optional(),
  costoUltimo: montoNoNegativo,
  costoPromedio: montoNoNegativo,
  fechaUltimoCosto: texto,
  stockMinimo: cantidad,
  activo: z.boolean(),
  codigoBarras: texto.optional(),
  pesoKg: cantidad.optional(),
  monedaCosto: moneda.optional(),
  costoUSD: montoNoNegativo.optional(),
});

export const proveedorInput = z.object({
  codigo: texto,
  razonSocial: texto,
  tipo: tipoProveedor,
  cuit: texto,
  condicionIVA,
  circuitoHabitual: circuito,
  email: texto,
  telefono: texto,
  direccion: texto,
  contacto: texto,
  plazoEntregaDias: enteroNoNegativo,
  condicionPago,
  unidadNegocioIds: lista(ref, 50),
  activo: z.boolean(),
  notas: texto.optional(),
});

export const clienteInput = z.object({
  codigo: texto,
  razonSocial: texto,
  nombreFantasia: texto.optional(),
  tipo: tipoCliente,
  cuit: texto,
  condicionIVA,
  circuitoHabitual: circuito,
  email: texto,
  telefono: texto,
  contacto: texto.optional(),
  direccion: texto,
  localidad: texto,
  listaPreciosId: ref,
  condicionPago,
  limiteCredito: montoNoNegativo,
  vendedorId: ref.optional(),
  sucursalPreferidaId: ref,
  facturaEnUSD: z.boolean().optional(),
  activo: z.boolean(),
  notas: texto.optional(),
});
