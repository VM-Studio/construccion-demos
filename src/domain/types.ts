/**
 * Modelo de dominio de Aceros RNF.
 * Espejo del futuro schema de Prisma: cada entidad con id, timestamps ISO y
 * relaciones por id.
 */

// ───────────────────────── Enums ─────────────────────────

export type Rol = "DUENO" | "ADMINISTRACION" | "VENTAS" | "DEPOSITO";

export type Unidad = "UN" | "BOLSA" | "M3" | "M2" | "ML" | "KG" | "LT" | "PALLET" | "CAJA" | "ROLLO" | "PLACA" | "TN";

/** Circuito del documento: 1 = fiscal (AC1), 2 = interno (AC2). */
export type Circuito = 1 | 2;

export type CodigoUnidadNegocio = "FER" | "COR";

/** Códigos de documento, iguales a los del sistema actual de la empresa. */
export type CodigoDoc =
  | "AC" // acopio
  | "NP" // nota de pedido
  | "DP" // devolución de nota de pedido
  | "ACD" // ajuste / traspaso de saldo de acopio
  | "RM" // remito
  | "RD" // remito de devolución
  | "F" // factura
  | "NC" // nota de crédito
  | "ND" // nota de débito
  | "RC" // recibo
  | "OC" // orden de compra
  | "OP" // orden de pago
  | "ACP" // acopio con proveedor
  | "COT" // cotización
  | "RCP" // recepción de mercadería
  | "TRF" // transferencia
  | "AJU" // ajuste de stock
  | "DES" // despacho
  | "SI"; // saldo inicial de cuenta corriente

export type EstadoOC = "BORRADOR" | "ENVIADA" | "CONFIRMADA" | "RECIBIDA_PARCIAL" | "RECIBIDA" | "CANCELADA";
export type EstadoCotizacion = "BORRADOR" | "ENVIADA" | "ACEPTADA" | "RECHAZADA" | "VENCIDA";
export type EstadoNP = "BORRADOR" | "PENDIENTE" | "ENTREGADA_PARCIAL" | "ENTREGADA" | "ANULADA";
export type EstadoAcopio = "VIGENTE" | "VENCIDO" | "AGOTADO" | "CANCELADO";
export type EstadoRemito = "INICIAL" | "PICKING" | "HECHO" | "ANULADO";
export type TipoRemito = "VENTA" | "DESACOPIO" | "DEVOLUCION" | "TRANSFERENCIA";
export type EstadoDespacho = "ESPERA" | "PREPARACION" | "FINALIZADO" | "EN_VIAJE" | "ENTREGADO" | "CANCELADO";

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

/** FACTURA (F1 con letra A/B, o F2 interno), nota de crédito/débito, saldo a favor de un recibo y saldo inicial (migración, sin ítems). */
export type TipoComprobante = "FACTURA" | "NOTA_CREDITO" | "NOTA_DEBITO" | "SALDO_A_FAVOR" | "SALDO_INICIAL";
export type LetraComprobante = "A" | "B";

export type TipoCliente = "CONSTRUCTORA" | "CORRALON" | "FERRETERIA" | "PARTICULAR" | "ARQUITECTO";
export type TipoProveedor = "FABRICANTE" | "DISTRIBUIDOR" | "TRANSPORTISTA" | "SERVICIOS";
export type CondicionPago = "CONTADO" | "CTA_CTE_15" | "CTA_CTE_30" | "CTA_CTE_60" | "ANTICIPO";
export type MedioPago = "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE" | "ECHEQ" | "TARJETA" | "MERCADOPAGO";
export type CondicionIVA = "RI" | "MONOTRIBUTO" | "EXENTO" | "CF";

export type FormaPagoAcopio = "ANTICIPO" | "CUENTA_CORRIENTE";
export type Moneda = "ARS" | "USD";
/** Snapshot del dólar en documentos en USD. */
export interface ConTipoCambio {
  moneda?: Moneda;
  tipoCambioAplicado?: number;
  tipoCambioFecha?: string;
}
export type FormaPagoVenta = "CONTADO" | "CUENTA_CORRIENTE" | "ACOPIO";
export type OrigenVenta = "NUEVA" | "ACOPIO";
export type ModalidadEntrega = "ENVIO" | "RETIRA";

export type EstadoTransferencia = "PENDIENTE" | "EN_TRANSITO" | "RECIBIDA" | "CANCELADA";
export type EstadoComprobante = "PENDIENTE" | "PARCIAL" | "PAGADO" | "ANULADO";
export type EstadoHojaRuta = "PLANIFICADA" | "EN_CURSO" | "CERRADA";
export type EstadoCheque = "EN_CARTERA" | "DEPOSITADO" | "ENTREGADO" | "RECHAZADO";
export type ReferenciaTipo = "OC" | "REMITO" | "TRANSFERENCIA" | "AJUSTE";
export type MotivoAjuste = string;
export type DiferenciaRecepcion = "OK" | "FALTANTE" | "ROTURA" | "EXTRA";
export type CategoriaAdjunto = "REMITO_FIRMADO" | "FACTURA_PROVEEDOR" | "OTRO";
export type EntidadAdjunto =
  | "REMITO"
  | "ACOPIO"
  | "ACOPIO_PROVEEDOR"
  | "NOTA_PEDIDO"
  | "ORDEN_COMPRA"
  | "RECEPCION"
  | "CLIENTE"
  | "PROVEEDOR"
  | "COMPROBANTE";

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
  /** Punto de venta para documentos comerciales, ej. "0001". */
  puntoVenta: string;
  /** Punto de venta de remitos, ej. "00016". */
  puntoVentaRemito: string;
}

export interface Deposito extends Entidad {
  nombre: string;
  sucursalId: string;
  direccion: string;
  /** Posiciones / zonas de carga, ej. "Playa 1", "Galpón 2". */
  posiciones: string[];
}

export interface Usuario extends Entidad {
  nombre: string;
  apellido?: string;
  email: string;
  rol: Rol;
  sucursalId?: string;
  activo: boolean;
  avatarIniciales: string;
  /** Solo lectura (lo maneja la autenticación): debe cambiar la contraseña temporal. */
  debeCambiarPassword?: boolean;
  ultimoAcceso?: string;
}

export interface UnidadNegocio extends Entidad {
  nombre: string;
  codigo: CodigoUnidadNegocio;
  orden: number;
}

// ───────────────────────── Catálogo ─────────────────────────

export interface Rubro extends Entidad {
  nombre: string;
  orden: number;
  prefijo: string;
  unidadNegocioId: string;
}

export interface Proveedor extends Entidad {
  codigo: string;
  razonSocial: string;
  tipo: TipoProveedor;
  cuit: string;
  condicionIVA: CondicionIVA;
  circuitoHabitual: Circuito;
  email: string;
  telefono: string;
  direccion: string;
  contacto: string;
  plazoEntregaDias: number;
  condicionPago: CondicionPago;
  unidadNegocioIds: string[];
  activo: boolean;
  notas?: string;
}

export interface Producto extends Entidad {
  codigo: string;
  nombre: string;
  descripcion?: string;
  rubroId: string;
  unidadNegocioId: string;
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
  /** Moneda del costo: en USD el costo en pesos sale del tipo de cambio vigente. */
  monedaCosto?: Moneda;
  costoUSD?: number;
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
  /** Solo inventario inicial: costo al que entra lo que ya estaba en el galpón. */
  costoUnitario?: number;
}

export interface AjusteStock extends Entidad {
  numero: string;
  depositoId: string;
  items: ItemAjuste[];
  usuarioId: string;
  fecha: string;
  observacion?: string;
  forzado?: boolean;
}

// ───────────────────────── Clientes y obras ─────────────────────────

export interface Cliente extends Entidad {
  codigo: string;
  razonSocial: string;
  nombreFantasia?: string;
  tipo: TipoCliente;
  cuit: string;
  condicionIVA: CondicionIVA;
  circuitoHabitual: Circuito;
  email: string;
  telefono: string;
  contacto?: string;
  direccion: string;
  localidad: string;
  listaPreciosId: string;
  condicionPago: CondicionPago;
  limiteCredito: number;
  vendedorId?: string;
  sucursalPreferidaId: string;
  /** Habilita precios en USD en cotizaciones y notas de pedido. */
  facturaEnUSD?: boolean;
  activo: boolean;
  notas?: string;
}

export interface Obra extends Entidad {
  clienteId: string;
  nombre: string;
  direccion?: string;
  localidad?: string;
  contacto?: string;
  activa: boolean;
}

// ───────────────────────── Acopios de clientes (por monto) ─────────────────────────

export interface PrecioCongelado {
  productoId: string;
  precio: number;
  costoSnapshot: number;
}

export interface Acopio extends Entidad {
  numero: string;
  circuito: Circuito;
  clienteId: string;
  sucursalId: string;
  depositoId: string;
  vendedorId: string;
  obraIds: string[];
  fechaCreacion: string;
  fechaVencimiento: string;
  /** Plata depositada / pactada. */
  importe: number;
  alicuotaIIBBPct: number;
  importeConIIBB: number;
  formaPago: FormaPagoAcopio;
  listaPreciosBaseId: string;
  unidadNegocioId: string;
  /** Toda la lista de precios de la unidad de negocio al momento del acopio. */
  preciosCongelados: PrecioCongelado[];
  comprobanteIds: string[];
  reciboIds: string[];
  estado: EstadoAcopio;
  observaciones?: string;
}

export interface ItemNP {
  id: string;
  productoId: string;
  obraId?: string;
  cantidad: number;
  entregados: number;
  /** Cantidad devuelta por DP (resta del pendiente). */
  devueltos?: number;
  precioUnitario: number;
  costoUnitarioSnapshot: number;
  descuentoPct?: number;
  subtotal: number;
}

/** Nota de pedido: retiro de acopio o venta nueva. Es la fuente de verdad de las ventas. */
export interface NotaPedido extends Entidad, ConTipoCambio {
  numero: string;
  circuito: Circuito;
  tipo: "RETIRO_ACOPIO" | "VENTA";
  origen: OrigenVenta;
  acopioId?: string;
  cotizacionId?: string;
  clienteId: string;
  sucursalId: string;
  depositoId: string;
  vendedorId: string;
  fecha: string;
  fechaConfirmacion?: string;
  items: ItemNP[];
  /** Σ subtotales (precios congelados si es retiro). */
  monto: number;
  descuentoPct: number;
  iva: number;
  total: number;
  estado: EstadoNP;
  formaPago: FormaPagoVenta;
  condicionPago: CondicionPago;
  pendienteEntrega: boolean;
  modalidadEntrega: ModalidadEntrega;
  direccionEntrega?: string;
  fechaEntregaProgramada?: string;
  remitoIds: string[];
  comprobanteIds: string[];
  observaciones?: string;
  forzadoSinDisponible?: boolean;
  autorizadoSaldoNegativo?: boolean;
  excepcionCredito?: boolean;
}

/** Alias de compatibilidad: un "pedido" es una nota de pedido. */
export type Pedido = NotaPedido;

export interface ItemDP {
  itemNPId: string;
  productoId: string;
  obraId?: string;
  cantidad: number;
  precioUnitario: number;
  /** Importe devuelto (positivo). Si falta se usa cantidad × precio. */
  subtotal?: number;
}

export interface DevolucionNP extends Entidad {
  numero: string;
  circuito: Circuito;
  notaPedidoId: string;
  acopioId?: string;
  clienteId: string;
  fecha: string;
  items: ItemDP[];
  /** Negativo. */
  monto: number;
  remitoDevolucionId?: string;
  notaCreditoId?: string;
  /** Números informativos (datos históricos). */
  remitosRef?: string[];
  notasCreditoRef?: string[];
  motivo: string;
  usuarioId: string;
}

export interface AjusteAcopio extends Entidad {
  numero: string;
  circuito: Circuito;
  acopioId: string;
  fecha: string;
  tipo: "TRASPASO_ENTRADA" | "TRASPASO_SALIDA" | "AJUSTE";
  acopioRelacionadoId?: string;
  /** Efecto sobre el saldo: positivo suma, negativo resta. */
  monto: number;
  descripcion: string;
  usuarioId: string;
}

// ───────────────────────── Cotizaciones ─────────────────────────

export interface ItemVenta {
  id: string;
  productoId: string;
  obraId?: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitarioSnapshot: number;
  descuentoPct: number;
}

export interface Cotizacion extends Entidad, ConTipoCambio {
  numero: string;
  circuito: Circuito;
  clienteId: string;
  obraId?: string;
  sucursalId: string;
  vendedorId: string;
  estado: EstadoCotizacion;
  fecha: string;
  validezDias: number;
  items: ItemVenta[];
  subtotal: number;
  descuentoPct: number;
  iva: number;
  total: number;
  observaciones?: string;
  notaPedidoId?: string;
}

// ───────────────────────── Remitos, despachos y adjuntos ─────────────────────────

export interface ItemRemito {
  productoId: string;
  cantidad: number;
  itemNPId?: string;
  obraId?: string;
  nroSerie?: string[];
}

export interface Remito extends Entidad {
  numero: string;
  circuito: Circuito;
  tipo: TipoRemito;
  notaPedidoId?: string;
  acopioId?: string;
  devolucionId?: string;
  transferenciaId?: string;
  clienteId?: string;
  proveedorId?: string;
  obraId?: string;
  sucursalId: string;
  depositoId: string;
  fecha: string;
  fechaEntrega?: string;
  direccionEntrega?: string;
  items: ItemRemito[];
  cantidadTotal: number;
  pesoTotalKg: number;
  valorDeclarado: number;
  estado: EstadoRemito;
  facturado: boolean;
  /** Números de factura asociados (en desacopios, informativos). */
  facturasRef?: string[];
  despachoId?: string;
  firmadoAdjuntoId?: string;
  comentario?: string;
  /** true cuando ya se generaron los movimientos de stock. */
  stockAplicado?: boolean;
}

export interface Adjunto extends Entidad {
  entidadTipo: EntidadAdjunto;
  entidadId: string;
  nombre: string;
  tamanoBytes: number;
  tipoMime: string;
  categoria: CategoriaAdjunto;
  subidoPor: string;
  subidoEn: string;
  /** Clave del blob en IndexedDB (vacía para enlaces web). */
  blobKey: string;
  url?: string;
}

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
  itemNPId?: string;
}

export interface Despacho extends Entidad {
  numero: string;
  sucursalId: string;
  depositoId: string;
  clienteId: string;
  notaPedidoId?: string;
  remitoId?: string;
  modalidad: ModalidadEntrega;
  estado: EstadoDespacho;
  posicion: string;
  fechaProgramada: string;
  fechaEspera: string;
  fechaInicioPreparacion?: string;
  fechaFin?: string;
  fechaEntrega?: string;
  vehiculoId?: string;
  choferId?: string;
  operarioId?: string;
  direccionEntrega: string;
  obraId?: string;
  items: ItemDespacho[];
  observaciones?: string;
  reprogramaciones?: number;
}

export interface HojaRuta extends Entidad {
  fecha: string;
  vehiculoId: string;
  choferId: string;
  despachoIds: string[];
  estado: EstadoHojaRuta;
}

// ───────────────────────── Compras y acopios con proveedores ─────────────────────────

export interface ItemOC {
  id: string;
  productoId: string;
  cantidadPedida: number;
  cantidadRecibida: number;
  /** Pesos (OC en USD: costoUSD × tipo de cambio de la OC). */
  costoUnitario: number;
  /** OC en USD: costo cargado en dólares. */
  costoUSD?: number;
  descuentoPct: number;
}

export interface OrdenCompra extends Entidad, ConTipoCambio {
  numero: string;
  circuito: Circuito;
  origen: OrigenVenta;
  acopioProveedorId?: string;
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
  reclamos?: string[];
}

export interface ItemRecepcion {
  itemOCId: string;
  productoId: string;
  cantidadRecibida: number;
  /** Pesos: el costo que entra al stock. */
  costoUnitario: number;
  /** OC en USD: costo en dólares de la recepción. */
  costoUSD?: number;
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
  /** OC en USD: tipo de cambio del día de la recepción. */
  tipoCambioAplicado?: number;
  tipoCambioFecha?: string;
}

export interface CostoCongelado {
  productoId: string;
  costo: number;
}

export interface AcopioProveedor extends Entidad, ConTipoCambio {
  numero: string;
  circuito: Circuito;
  proveedorId: string;
  sucursalId: string;
  depositoDestinoId: string;
  fechaCreacion: string;
  fechaVencimiento: string;
  modalidad: "MONTO" | "CANTIDAD";
  importe: number;
  formaPago: FormaPagoAcopio;
  preciosCongelados: CostoCongelado[];
  /** Acopios por cantidad: ej. 2.000 bolsas de cemento. */
  items?: { productoId: string; cantidadPactada: number }[];
  /** Σ órdenes de pago imputadas. */
  pagado: number;
  comprobanteCompraIds: string[];
  ordenPagoIds: string[];
  estado: EstadoAcopio;
  observaciones?: string;
}

// ───────────────────────── Finanzas ─────────────────────────

export interface Comprobante extends Entidad {
  tipo: TipoComprobante;
  letra?: LetraComprobante;
  circuito: Circuito;
  /** Ej. "F2 0001-00086926". */
  numero: string;
  clienteId?: string;
  proveedorId?: string;
  notaPedidoId?: string;
  acopioId?: string;
  acopioProveedorId?: string;
  recepcionId?: string;
  devolucionId?: string;
  comprobanteOrigenId?: string;
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

export interface MedioCobro {
  medio: MedioPago;
  importe: number;
  referencia?: string;
  banco?: string;
  numeroCheque?: string;
  fechaCobro?: string;
  chequeId?: string;
}

export interface Imputacion {
  comprobanteId: string;
  importe: number;
}

/** Recibo (entrada de fondos). */
export interface Cobranza extends Entidad {
  numero: string;
  circuito: Circuito;
  clienteId: string;
  sucursalId?: string;
  fecha: string;
  medios: MedioCobro[];
  imputaciones: Imputacion[];
  total: number;
  saldoAFavor?: number;
  usuarioId: string;
  observaciones?: string;
}

/** Orden de pago (salida de fondos). */
export interface PagoProveedor extends Entidad {
  numero: string;
  circuito: Circuito;
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
  /** Cambios reales medidos por la acción (modo capacitación). */
  efectos?: unknown;
  accionId?: string;
  ip?: string;
  userAgent?: string;
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
  alicuotaIIBBPct: number;
  alertaStockMinimo: boolean;
  umbralSubaCostoPct: number;
  tipoCambioUSD?: number;
  tipoCambioModo?: "AUTO" | "MANUAL";
  tipoCambioManual?: number;
  /**
   * Tipo de cambio vigente (obtenerVigente() del servidor). NO se guarda en la base: el motor lo
   * inyecta antes de correr cada acción para que las reglas del dominio lo lean de `tx.config`.
   */
  tipoCambioVigente?: TipoCambioVigente;
  tamanoMaxAdjuntoMB: number;
  categoriasAdjunto: { codigo: CategoriaAdjunto; nombre: string }[];
  empresa: DatosEmpresa;
  motivosAjuste: { codigo: string; nombre: string; activo: boolean }[];
}

export interface TipoCambioVigente {
  /** Dólar divisa vendedor (o el valor manual). */
  valor: number;
  /** Fecha de la cotización (ISO). */
  fecha: string;
  fuente: string;
}

/** Último número usado por clave `${codigo}|${circuito}|${puntoVenta}`. */
export type Numeradores = Record<string, number>;

/** Estado completo de datos de negocio (lo que hoy vive en localStorage). */
export interface EstadoInicial {
  sucursales: Sucursal[];
  depositos: Deposito[];
  usuarios: Usuario[];
  unidadesNegocio: UnidadNegocio[];
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
  acopiosProveedor: AcopioProveedor[];
  clientes: Cliente[];
  obras: Obra[];
  cotizaciones: Cotizacion[];
  notasPedido: NotaPedido[];
  devoluciones: DevolucionNP[];
  ajustesAcopio: AjusteAcopio[];
  acopios: Acopio[];
  remitos: Remito[];
  adjuntos: Adjunto[];
  comprobantes: Comprobante[];
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
