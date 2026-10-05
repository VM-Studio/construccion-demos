/**
 * Modelo de dominio completo de la distribuidora.
 * Pensado como espejo del futuro schema de Prisma: cada entidad con id,
 * timestamps ISO y relaciones por id.
 */

// ───────────────────────── Enums ─────────────────────────

export type Rol = "DUENO" | "ADMINISTRACION" | "VENTAS" | "DEPOSITO";

export type Unidad =
  | "UN"
  | "BOLSA"
  | "M3"
  | "M2"
  | "ML"
  | "KG"
  | "LT"
  | "PALLET"
  | "CAJA"
  | "ROLLO"
  | "PLACA";

export type EstadoOC = "BORRADOR" | "ENVIADA" | "CONFIRMADA" | "RECIBIDA_PARCIAL" | "RECIBIDA" | "CANCELADA";

export type EstadoPresupuesto = "BORRADOR" | "ENVIADO" | "ACEPTADO" | "RECHAZADO" | "VENCIDO";

export type EstadoPedido =
  | "BORRADOR"
  | "CONFIRMADO"
  | "EN_PREPARACION"
  | "DESPACHADO_PARCIAL"
  | "DESPACHADO"
  | "FACTURADO"
  | "CANCELADO";

export type EstadoAcopio = "VIGENTE" | "RETIRADO_PARCIAL" | "COMPLETADO" | "VENCIDO" | "CANCELADO";

export type EstadoDespacho =
  | "PENDIENTE"
  | "EN_PREPARACION"
  | "EN_VIAJE"
  | "ENTREGADO"
  | "RETIRADO_EN_MOSTRADOR"
  | "CANCELADO";

export type TipoMovimientoStock =
  | "INGRESO_COMPRA"
  | "EGRESO_VENTA"
  | "EGRESO_ACOPIO"
  | "TRANSFERENCIA_SALIDA"
  | "TRANSFERENCIA_ENTRADA"
  | "AJUSTE_POSITIVO"
  | "AJUSTE_NEGATIVO"
  | "DEVOLUCION_CLIENTE"
  | "DEVOLUCION_PROVEEDOR";

export type TipoComprobante =
  | "FACTURA_A"
  | "FACTURA_B"
  | "NOTA_CREDITO"
  | "NOTA_DEBITO"
  | "REMITO"
  | "RECIBO"
  | "ORDEN_PAGO";

export type TipoCliente = "CORRALON" | "CONSTRUCTORA" | "PARTICULAR" | "ARQUITECTO";

export type CondicionPago = "CONTADO" | "CTA_CTE_15" | "CTA_CTE_30" | "CTA_CTE_60" | "ANTICIPO";

export type MedioPago = "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | "ECHEQ" | "TARJETA" | "MERCADOPAGO";

export type CondicionIVA = "RI" | "MONOTRIBUTO" | "EXENTO" | "CF";

export type EstadoTransferencia = "PENDIENTE" | "EN_TRANSITO" | "RECIBIDA" | "CANCELADA";
export type EstadoComprobante = "PENDIENTE" | "PARCIAL" | "PAGADO" | "ANULADO";
export type EstadoHojaRuta = "PLANIFICADA" | "EN_CURSO" | "CERRADA";
export type EstadoCheque = "EN_CARTERA" | "DEPOSITADO" | "ENTREGADO" | "RECHAZADO";
export type ReferenciaTipo = "OC" | "PEDIDO" | "ACOPIO" | "TRANSFERENCIA" | "AJUSTE" | "DESPACHO";
/** Código de motivo de ajuste (configurable en Configuración → Motivos de ajuste). */
export type MotivoAjuste = string;
export type DiferenciaRecepcion = "OK" | "FALTANTE" | "ROTURA" | "EXTRA";

// ───────────────────────── Base ─────────────────────────

export interface Entidad {
  id: string;
  creadoEn: string;
  actualizadoEn: string;
}

// ───────────────────────── Organización ─────────────────────────

export interface Sucursal extends Entidad {
  nombre: string;
  direccion: string;
  telefono: string;
  depositoId: string;
  /** Punto de venta fiscal, ej. "0001". */
  puntoVenta: string;
}

export interface Deposito extends Entidad {
  nombre: string;
  sucursalId: string;
  direccion: string;
}

export interface Usuario extends Entidad {
  nombre: string;
  email: string;
  rol: Rol;
  sucursalId?: string;
  activo: boolean;
  avatarIniciales: string;
}

// ───────────────────────── Catálogo ─────────────────────────

export interface Rubro extends Entidad {
  nombre: string;
  orden: number;
  /** Prefijo de código de producto, ej. "GRU". */
  prefijo: string;
}

export interface Proveedor extends Entidad {
  razonSocial: string;
  cuit: string;
  condicionIVA: CondicionIVA;
  email: string;
  telefono: string;
  direccion: string;
  contacto: string;
  plazoEntregaDias: number;
  condicionPago: CondicionPago;
  activo: boolean;
  notas?: string;
}

export interface Producto extends Entidad {
  codigo: string;
  nombre: string;
  descripcion?: string;
  rubroId: string;
  marca?: string;
  unidad: Unidad;
  unidadesPorPallet?: number;
  proveedorHabitualId?: string;
  costoUltimo: number;
  costoPromedio: number;
  fechaUltimoCosto: string;
  stockMinimo: number;
  activo: boolean;
  codigoBarras?: string;
  pesoKg?: number;
  imagenUrl?: string;
}

export interface ListaPrecios extends Entidad {
  nombre: string;
  descripcion: string;
  markupPorDefecto: number;
  activa: boolean;
}

export interface PrecioProducto extends Entidad {
  productoId: string;
  listaPreciosId: string;
  precio: number;
}

// ───────────────────────── Stock ─────────────────────────

export interface StockDeposito extends Entidad {
  productoId: string;
  depositoId: string;
  cantidadFisica: number;
}

/** INMUTABLE: nunca se edita ni se borra. */
export interface MovimientoStock extends Entidad {
  productoId: string;
  depositoId: string;
  tipo: TipoMovimientoStock;
  /** Siempre positiva; el sentido lo da `signo`. */
  cantidad: number;
  signo: 1 | -1;
  costoUnitario: number;
  referenciaTipo: ReferenciaTipo;
  referenciaId: string;
  usuarioId: string;
  observacion?: string;
  fecha: string;
}

export interface ItemTransferencia {
  productoId: string;
  cantidad: number;
}

export interface TransferenciaStock extends Entidad {
  numero: string;
  depositoOrigenId: string;
  depositoDestinoId: string;
  items: ItemTransferencia[];
  estado: EstadoTransferencia;
  usuarioId: string;
  fecha: string;
  fechaDespacho?: string;
  fechaRecepcion?: string;
  observacion?: string;
}

export interface ItemAjuste {
  productoId: string;
  cantidad: number;
  signo: 1 | -1;
  motivo: MotivoAjuste;
}

export interface AjusteStock extends Entidad {
  numero: string;
  depositoId: string;
  items: ItemAjuste[];
  usuarioId: string;
  fecha: string;
  observacion?: string;
}

// ───────────────────────── Compras ─────────────────────────

export interface ItemOC {
  id: string;
  productoId: string;
  cantidadPedida: number;
  cantidadRecibida: number;
  costoUnitario: number;
  descuentoPct: number;
}

export interface OrdenCompra extends Entidad {
  numero: string;
  proveedorId: string;
  depositoDestinoId: string;
  sucursalId: string;
  estado: EstadoOC;
  fechaEmision: string;
  fechaEntregaEstimada: string;
  items: ItemOC[];
  subtotal: number;
  iva: number;
  total: number;
  observaciones?: string;
  usuarioId: string;
}

export interface ItemRecepcion {
  itemOCId: string;
  productoId: string;
  cantidadRecibida: number;
  costoUnitario: number;
  diferencia?: DiferenciaRecepcion;
  observacion?: string;
}

export interface RecepcionMercaderia extends Entidad {
  numero: string;
  ordenCompraId: string;
  depositoId: string;
  remitoProveedor: string;
  fecha: string;
  items: ItemRecepcion[];
  usuarioId: string;
  observaciones?: string;
  comprobanteId?: string;
}

// ───────────────────────── Ventas ─────────────────────────

export interface Cliente extends Entidad {
  razonSocial: string;
  nombreFantasia?: string;
  tipo: TipoCliente;
  cuit: string;
  condicionIVA: CondicionIVA;
  email: string;
  telefono: string;
  direccion: string;
  localidad: string;
  listaPreciosId: string;
  condicionPago: CondicionPago;
  limiteCredito: number;
  vendedorId?: string;
  sucursalPreferidaId: string;
  activo: boolean;
  notas?: string;
}

export interface ItemVenta {
  id: string;
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  /** Se congela al confirmar el pedido. */
  costoUnitarioSnapshot: number;
  descuentoPct: number;
  /** Cantidad ya despachada (entregada o en viaje). */
  cantidadDespachada?: number;
  /** Faltante marcado al confirmar sin stock suficiente. */
  backorder?: number;
}

export interface Presupuesto extends Entidad {
  numero: string;
  clienteId: string;
  sucursalId: string;
  vendedorId: string;
  estado: EstadoPresupuesto;
  fecha: string;
  validezDias: number;
  items: ItemVenta[];
  subtotal: number;
  descuentoPct: number;
  iva: number;
  total: number;
  observaciones?: string;
  pedidoId?: string;
}

export type ModalidadEntrega = "ENVIO" | "RETIRA";

export interface Pedido extends Entidad {
  numero: string;
  clienteId: string;
  sucursalId: string;
  depositoId: string;
  vendedorId: string;
  presupuestoId?: string;
  estado: EstadoPedido;
  fecha: string;
  fechaConfirmacion?: string;
  fechaEntregaComprometida?: string;
  items: ItemVenta[];
  subtotal: number;
  descuentoPct: number;
  iva: number;
  total: number;
  condicionPago: CondicionPago;
  modalidadEntrega: ModalidadEntrega;
  direccionEntrega?: string;
  observaciones?: string;
  comprobanteId?: string;
  excepcionCredito?: boolean;
}

export interface Comprobante extends Entidad {
  tipo: TipoComprobante;
  /** Ej. "0001-00001234". */
  numero: string;
  clienteId?: string;
  proveedorId?: string;
  pedidoId?: string;
  acopioId?: string;
  recepcionId?: string;
  /** Comprobante al que anula / ajusta (notas de crédito). */
  comprobanteOrigenId?: string;
  /** Aplicación de una nota de crédito a comprobantes con saldo. */
  aplicadoA?: Imputacion[];
  sucursalId?: string;
  fecha: string;
  vencimiento?: string;
  subtotal: number;
  iva: number;
  total: number;
  saldoPendiente: number;
  estado: EstadoComprobante;
  items?: ItemVenta[];
  observaciones?: string;
}

// ───────────────────────── Acopios ─────────────────────────

export interface ItemAcopio {
  id: string;
  productoId: string;
  cantidadAcopiada: number;
  cantidadRetirada: number;
  precioUnitarioPactado: number;
  costoUnitarioSnapshot: number;
}

export interface Acopio extends Entidad {
  numero: string;
  clienteId: string;
  sucursalId: string;
  depositoId: string;
  vendedorId: string;
  estado: EstadoAcopio;
  fechaInicio: string;
  fechaVencimiento: string;
  items: ItemAcopio[];
  subtotal: number;
  iva: number;
  total: number;
  montoPagado: number;
  comprobanteId?: string;
  comprobanteIds?: string[];
  condicionPago?: CondicionPago;
  observaciones?: string;
}

export interface ItemRetiro {
  itemAcopioId: string;
  productoId: string;
  cantidad: number;
}

export interface RetiroAcopio extends Entidad {
  numero: string;
  acopioId: string;
  fecha: string;
  items: ItemRetiro[];
  despachoId?: string;
  usuarioId: string;
  observaciones?: string;
}

// ───────────────────────── Logística ─────────────────────────

export interface Vehiculo extends Entidad {
  patente: string;
  descripcion: string;
  capacidadKg: number;
  choferId?: string;
  activo: boolean;
}

export interface Chofer extends Entidad {
  nombre: string;
  telefono: string;
  activo: boolean;
}

export interface ItemDespacho {
  productoId: string;
  cantidad: number;
  /** Para despachos de pedidos: id del ItemVenta. Para acopios: id del ItemAcopio. */
  itemOrigenId?: string;
  cantidadEntregada?: number;
}

export interface Despacho extends Entidad {
  /** Número de remito, ej. "REM-00012" (con punto de venta en la impresión). */
  numero: string;
  sucursalId: string;
  depositoId: string;
  clienteId: string;
  origenTipo: "PEDIDO" | "RETIRO_ACOPIO";
  origenId: string;
  /** Para retiros de acopio: id del acopio (origenId es el retiro). */
  acopioId?: string;
  estado: EstadoDespacho;
  fechaProgramada: string;
  fechaEntrega?: string;
  fechaSalida?: string;
  vehiculoId?: string;
  choferId?: string;
  direccionEntrega: string;
  localidad?: string;
  items: ItemDespacho[];
  firmaRecibido?: string;
  observaciones?: string;
  reprogramaciones?: number;
  /** true cuando ya se generaron los egresos de stock. */
  egresoGenerado?: boolean;
}

export interface HojaRuta extends Entidad {
  fecha: string;
  vehiculoId: string;
  choferId: string;
  despachoIds: string[];
  estado: EstadoHojaRuta;
}

// ───────────────────────── Finanzas ─────────────────────────

export interface MedioCobro {
  medio: MedioPago;
  importe: number;
  referencia?: string;
  banco?: string;
  numeroCheque?: string;
  fechaCobro?: string;
  /** Si se usa un cheque de cartera para pagar a un proveedor. */
  chequeId?: string;
}

export interface Imputacion {
  comprobanteId: string;
  importe: number;
}

export interface Cobranza extends Entidad {
  /** Número de recibo. */
  numero: string;
  clienteId: string;
  sucursalId?: string;
  fecha: string;
  medios: MedioCobro[];
  imputaciones: Imputacion[];
  total: number;
  /** Importe no imputado que queda a favor del cliente. */
  saldoAFavor?: number;
  usuarioId: string;
  observaciones?: string;
}

export interface PagoProveedor extends Entidad {
  /** Número de orden de pago. */
  numero: string;
  proveedorId: string;
  fecha: string;
  medios: MedioCobro[];
  imputaciones: Imputacion[];
  total: number;
  usuarioId: string;
  observaciones?: string;
}

export interface Cheque extends Entidad {
  tipo: "CHEQUE" | "ECHEQ";
  banco: string;
  numero: string;
  importe: number;
  fechaCobro: string;
  clienteId: string;
  cobranzaId: string;
  estado: EstadoCheque;
  proveedorId?: string;
  pagoProveedorId?: string;
}

// ───────────────────────── Sistema ─────────────────────────

export interface Auditoria extends Entidad {
  fecha: string;
  usuarioId: string;
  accion: string;
  entidad: string;
  entidadId: string;
  detalle: string;
}

export interface DatosEmpresa {
  empresa: string;
  razonSocial: string;
  cuit: string;
  direccion: string;
  telefono: string;
  email: string;
}

export interface Configuracion {
  ivaPct: number;
  validezPresupuestoDias: number;
  diasVencimientoAcopio: number;
  alertaStockMinimo: boolean;
  umbralSubaCostoPct: number;
  tipoCambioUSD?: number;
  empresa: DatosEmpresa;
  motivosAjuste: { codigo: string; nombre: string; activo: boolean }[];
}

export interface Numeradores {
  OC: number;
  PRE: number;
  PED: number;
  ACO: number;
  RET: number;
  REM: number;
  REC: number;
  OP: number;
  TRF: number;
  AJU: number;
  RCP: number;
  /** Comprobantes fiscales por punto de venta y tipo: { "0001": { FACTURA_A: 123 } } */
  fiscal: Record<string, Partial<Record<TipoComprobante, number>>>;
}

/** Estado completo de datos de negocio (lo que hoy vive en localStorage). */
export interface EstadoInicial {
  sucursales: Sucursal[];
  depositos: Deposito[];
  usuarios: Usuario[];
  rubros: Rubro[];
  proveedores: Proveedor[];
  productos: Producto[];
  listasPrecios: ListaPrecios[];
  precios: PrecioProducto[];
  stock: StockDeposito[];
  movimientos: MovimientoStock[];
  transferencias: TransferenciaStock[];
  ajustes: AjusteStock[];
  ordenesCompra: OrdenCompra[];
  recepciones: RecepcionMercaderia[];
  clientes: Cliente[];
  presupuestos: Presupuesto[];
  pedidos: Pedido[];
  comprobantes: Comprobante[];
  acopios: Acopio[];
  retiros: RetiroAcopio[];
  vehiculos: Vehiculo[];
  choferes: Chofer[];
  despachos: Despacho[];
  hojasRuta: HojaRuta[];
  cobranzas: Cobranza[];
  pagosProveedores: PagoProveedor[];
  cheques: Cheque[];
  auditoria: Auditoria[];
  config: Configuracion;
  numeradores: Numeradores;
}
