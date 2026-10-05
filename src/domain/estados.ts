import type { BadgeVariant } from "@/components/ui/badge";

/** Diccionario único: estado del dominio → etiqueta en español y variante de badge. */
export const ESTADOS: Record<string, { label: string; variant: BadgeVariant }> = {
  // Órdenes de compra
  "OC.BORRADOR": { label: "Borrador", variant: "neutral" },
  "OC.ENVIADA": { label: "Enviada", variant: "info" },
  "OC.CONFIRMADA": { label: "Confirmada", variant: "info" },
  "OC.RECIBIDA_PARCIAL": { label: "Recibida parcial", variant: "warning" },
  "OC.RECIBIDA": { label: "Recibida", variant: "success" },
  "OC.CANCELADA": { label: "Cancelada", variant: "neutral" },
  // Presupuestos
  "PRESUPUESTO.BORRADOR": { label: "Borrador", variant: "neutral" },
  "PRESUPUESTO.ENVIADO": { label: "Enviado", variant: "info" },
  "PRESUPUESTO.ACEPTADO": { label: "Aceptado", variant: "success" },
  "PRESUPUESTO.RECHAZADO": { label: "Rechazado", variant: "danger" },
  "PRESUPUESTO.VENCIDO": { label: "Vencido", variant: "danger" },
  // Pedidos
  "PEDIDO.BORRADOR": { label: "Borrador", variant: "neutral" },
  "PEDIDO.CONFIRMADO": { label: "Confirmado", variant: "info" },
  "PEDIDO.EN_PREPARACION": { label: "En preparación", variant: "warning" },
  "PEDIDO.DESPACHADO_PARCIAL": { label: "Despachado parcial", variant: "warning" },
  "PEDIDO.DESPACHADO": { label: "Despachado", variant: "success" },
  "PEDIDO.FACTURADO": { label: "Facturado", variant: "success" },
  "PEDIDO.CANCELADO": { label: "Cancelado", variant: "neutral" },
  // Acopios
  "ACOPIO.VIGENTE": { label: "Vigente", variant: "accent" },
  "ACOPIO.RETIRADO_PARCIAL": { label: "Retirado parcial", variant: "warning" },
  "ACOPIO.COMPLETADO": { label: "Completado", variant: "success" },
  "ACOPIO.VENCIDO": { label: "Vencido", variant: "danger" },
  "ACOPIO.CANCELADO": { label: "Cancelado", variant: "neutral" },
  // Despachos
  "DESPACHO.PENDIENTE": { label: "Pendiente", variant: "neutral" },
  "DESPACHO.EN_PREPARACION": { label: "En preparación", variant: "info" },
  "DESPACHO.EN_VIAJE": { label: "En viaje", variant: "warning" },
  "DESPACHO.ENTREGADO": { label: "Entregado", variant: "success" },
  "DESPACHO.RETIRADO_EN_MOSTRADOR": { label: "Retirado en mostrador", variant: "success" },
  "DESPACHO.CANCELADO": { label: "Cancelado", variant: "neutral" },
  // Movimientos de stock
  "MOVIMIENTO.INGRESO_COMPRA": { label: "Ingreso por compra", variant: "success" },
  "MOVIMIENTO.EGRESO_VENTA": { label: "Egreso por venta", variant: "info" },
  "MOVIMIENTO.EGRESO_ACOPIO": { label: "Egreso por acopio", variant: "accent" },
  "MOVIMIENTO.TRANSFERENCIA_SALIDA": { label: "Transferencia salida", variant: "neutral" },
  "MOVIMIENTO.TRANSFERENCIA_ENTRADA": { label: "Transferencia entrada", variant: "neutral" },
  "MOVIMIENTO.AJUSTE_POSITIVO": { label: "Ajuste positivo", variant: "success" },
  "MOVIMIENTO.AJUSTE_NEGATIVO": { label: "Ajuste negativo", variant: "danger" },
  "MOVIMIENTO.DEVOLUCION_CLIENTE": { label: "Devolución de cliente", variant: "warning" },
  "MOVIMIENTO.DEVOLUCION_PROVEEDOR": { label: "Devolución a proveedor", variant: "warning" },
  // Transferencias
  "TRANSFERENCIA.PENDIENTE": { label: "Pendiente", variant: "neutral" },
  "TRANSFERENCIA.EN_TRANSITO": { label: "En tránsito", variant: "warning" },
  "TRANSFERENCIA.RECIBIDA": { label: "Recibida", variant: "success" },
  "TRANSFERENCIA.CANCELADA": { label: "Cancelada", variant: "neutral" },
  // Comprobantes
  "COMPROBANTE.PENDIENTE": { label: "Pendiente", variant: "warning" },
  "COMPROBANTE.PARCIAL": { label: "Parcial", variant: "info" },
  "COMPROBANTE.PAGADO": { label: "Pagado", variant: "success" },
  "COMPROBANTE.ANULADO": { label: "Anulado", variant: "neutral" },
  // Hoja de ruta
  "HOJA.PLANIFICADA": { label: "Planificada", variant: "neutral" },
  "HOJA.EN_CURSO": { label: "En curso", variant: "warning" },
  "HOJA.CERRADA": { label: "Cerrada", variant: "success" },
  // Cheques
  "CHEQUE.EN_CARTERA": { label: "En cartera", variant: "accent" },
  "CHEQUE.DEPOSITADO": { label: "Depositado", variant: "success" },
  "CHEQUE.ENTREGADO": { label: "Entregado a proveedor", variant: "info" },
  "CHEQUE.RECHAZADO": { label: "Rechazado", variant: "danger" },
  // Stock
  "STOCK.OK": { label: "OK", variant: "success" },
  "STOCK.BAJO_MINIMO": { label: "Bajo mínimo", variant: "danger" },
  "STOCK.SIN_STOCK": { label: "Sin stock", variant: "danger" },
};

export type TipoEstado =
  | "OC"
  | "PRESUPUESTO"
  | "PEDIDO"
  | "ACOPIO"
  | "DESPACHO"
  | "MOVIMIENTO"
  | "TRANSFERENCIA"
  | "COMPROBANTE"
  | "HOJA"
  | "CHEQUE"
  | "STOCK";

export function estadoInfo(tipo: TipoEstado, estado: string) {
  return ESTADOS[`${tipo}.${estado}`] ?? { label: estado, variant: "neutral" as BadgeVariant };
}

export const TIPO_COMPROBANTE_LABEL: Record<string, string> = {
  FACTURA_A: "Factura A",
  FACTURA_B: "Factura B",
  NOTA_CREDITO: "Nota de crédito",
  NOTA_DEBITO: "Nota de débito",
  REMITO: "Remito",
  RECIBO: "Recibo",
  ORDEN_PAGO: "Orden de pago",
};

export const TIPO_CLIENTE_LABEL: Record<string, string> = {
  CORRALON: "Corralón",
  CONSTRUCTORA: "Constructora",
  PARTICULAR: "Particular",
  ARQUITECTO: "Arquitecto",
};

export const CONDICION_PAGO_LABEL: Record<string, string> = {
  CONTADO: "Contado",
  CTA_CTE_15: "Cta. cte. 15 días",
  CTA_CTE_30: "Cta. cte. 30 días",
  CTA_CTE_60: "Cta. cte. 60 días",
  ANTICIPO: "Anticipo",
};

export const CONDICION_IVA_LABEL: Record<string, string> = {
  RI: "Responsable inscripto",
  MONOTRIBUTO: "Monotributo",
  EXENTO: "Exento",
  CF: "Consumidor final",
};

export const MEDIO_PAGO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  CHEQUE: "Cheque",
  ECHEQ: "eCheq",
  TARJETA: "Tarjeta",
  MERCADOPAGO: "Mercado Pago",
};

export const UNIDAD_LABEL: Record<string, string> = {
  UN: "Unidad",
  BOLSA: "Bolsa",
  M3: "m³",
  M2: "m²",
  ML: "Metro lineal",
  KG: "Kilogramo",
  LT: "Litro",
  PALLET: "Pallet",
  CAJA: "Caja",
  ROLLO: "Rollo",
  PLACA: "Placa",
};

export const DIFERENCIA_LABEL: Record<string, string> = {
  OK: "OK",
  FALTANTE: "Faltante",
  ROTURA: "Rotura",
  EXTRA: "Cantidad extra",
};

export const opciones = (dict: Record<string, string>) => Object.entries(dict).map(([value, label]) => ({ value, label }));
