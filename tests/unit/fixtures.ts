/**
 * Fixtures mínimos y tipados para los tests unitarios del dominio.
 * Cada fábrica arma una entidad válida con valores neutros y permite pisar campos.
 */
import type {
  AcopioProveedor,
  Comprobante,
  EstadoInicial,
  ItemNP,
  ItemOC,
  NotaPedido,
  OrdenCompra,
  PrecioProducto,
  Producto,
  Remito,
  Rubro,
  StockDeposito,
  TransferenciaStock,
} from "@/domain/types";

const T = "2026-01-01T00:00:00.000Z";
const base = (id: string) => ({ id, creadoEn: T, actualizadoEn: T });

export function producto(id: string, over: Partial<Producto> = {}): Producto {
  return {
    ...base(id),
    codigo: id,
    nombre: `Producto ${id}`,
    rubroId: "rub_1",
    unidadNegocioId: "un_cor",
    unidad: "UN",
    costoUltimo: 0,
    costoPromedio: 0,
    fechaUltimoCosto: T,
    stockMinimo: 0,
    activo: true,
    ...over,
  };
}

export function rubro(id: string, prefijo: string, over: Partial<Rubro> = {}): Rubro {
  return { ...base(id), nombre: `Rubro ${id}`, orden: 1, prefijo, unidadNegocioId: "un_cor", ...over };
}

export function precio(productoId: string, listaPreciosId: string, valor: number): PrecioProducto {
  return { ...base(`pre_${productoId}_${listaPreciosId}`), productoId, listaPreciosId, precio: valor };
}

export function stock(productoId: string, depositoId: string, cantidadFisica: number): StockDeposito {
  return { ...base(`stk_${productoId}_${depositoId}`), productoId, depositoId, cantidadFisica };
}

export function itemNP(id: string, productoId: string, cantidad: number, over: Partial<ItemNP> = {}): ItemNP {
  const precioUnitario = over.precioUnitario ?? 100;
  return {
    id,
    productoId,
    cantidad,
    entregados: 0,
    precioUnitario,
    costoUnitarioSnapshot: 60,
    subtotal: cantidad * precioUnitario,
    ...over,
  };
}

export function notaPedido(id: string, items: ItemNP[], over: Partial<NotaPedido> = {}): NotaPedido {
  return {
    ...base(id),
    numero: `NP1 0001-${id}`,
    circuito: 1,
    tipo: "VENTA",
    origen: "NUEVA",
    clienteId: "cli_1",
    sucursalId: "suc_1",
    depositoId: "dep_1",
    vendedorId: "usr_1",
    fecha: "2026-10-01T12:00:00.000Z",
    items,
    monto: items.reduce((a, i) => a + i.subtotal, 0),
    descuentoPct: 0,
    iva: 0,
    total: 0,
    estado: "PENDIENTE",
    formaPago: "CONTADO",
    condicionPago: "CONTADO",
    pendienteEntrega: true,
    modalidadEntrega: "RETIRA",
    remitoIds: [],
    comprobanteIds: [],
    ...over,
  };
}

export function remito(id: string, items: Remito["items"], over: Partial<Remito> = {}): Remito {
  return {
    ...base(id),
    numero: `RM1 00016-${id}`,
    circuito: 1,
    tipo: "VENTA",
    sucursalId: "suc_1",
    depositoId: "dep_1",
    fecha: "2026-10-01T12:00:00.000Z",
    items,
    cantidadTotal: items.reduce((a, i) => a + i.cantidad, 0),
    pesoTotalKg: 0,
    valorDeclarado: 0,
    estado: "PICKING",
    facturado: false,
    ...over,
  };
}

export function itemOC(id: string, productoId: string, cantidadPedida: number, cantidadRecibida = 0): ItemOC {
  return { id, productoId, cantidadPedida, cantidadRecibida, costoUnitario: 10, descuentoPct: 0 };
}

export function ordenCompra(id: string, items: ItemOC[], over: Partial<OrdenCompra> = {}): OrdenCompra {
  return {
    ...base(id),
    numero: `OC1 0001-${id}`,
    circuito: 1,
    origen: "NUEVA",
    proveedorId: "prv_1",
    depositoDestinoId: "dep_1",
    sucursalId: "suc_1",
    estado: "CONFIRMADA",
    fechaEmision: T,
    fechaEntregaEstimada: T,
    items,
    subtotal: 0,
    iva: 0,
    total: 0,
    usuarioId: "usr_1",
    ...over,
  };
}

export function acopioProveedor(id: string, over: Partial<AcopioProveedor> = {}): AcopioProveedor {
  return {
    ...base(id),
    numero: `ACP1 0001-${id}`,
    circuito: 1,
    proveedorId: "prv_1",
    sucursalId: "suc_1",
    depositoDestinoId: "dep_1",
    fechaCreacion: T,
    fechaVencimiento: "2027-01-01T00:00:00.000Z",
    modalidad: "CANTIDAD",
    importe: 0,
    formaPago: "ANTICIPO",
    preciosCongelados: [],
    items: [],
    pagado: 0,
    comprobanteCompraIds: [],
    ordenPagoIds: [],
    estado: "VIGENTE",
    ...over,
  };
}

export function transferencia(id: string, items: TransferenciaStock["items"], over: Partial<TransferenciaStock> = {}): TransferenciaStock {
  return {
    ...base(id),
    numero: `TRF ${id}`,
    depositoOrigenId: "dep_1",
    depositoDestinoId: "dep_2",
    items,
    estado: "EN_TRANSITO",
    usuarioId: "usr_1",
    fecha: T,
    ...over,
  };
}

export function comprobante(id: string, over: Partial<Comprobante> = {}): Comprobante {
  return {
    ...base(id),
    tipo: "FACTURA",
    circuito: 1,
    numero: `F1 0001-${id}`,
    clienteId: "cli_1",
    sucursalId: "suc_1",
    fecha: "2026-10-05T12:00:00.000Z",
    subtotal: 0,
    iva: 0,
    total: 0,
    saldoPendiente: 0,
    estado: "PENDIENTE",
    ...over,
  };
}

/** Estado mínimo para las métricas: solo las colecciones que usan. */
export function estado(over: Partial<EstadoInicial> = {}): EstadoInicial {
  return {
    productos: [],
    notasPedido: [],
    acopios: [],
    comprobantes: [],
    ...over,
  } as unknown as EstadoInicial;
}
