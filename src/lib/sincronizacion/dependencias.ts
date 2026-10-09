/**
 * Qué datos del cliente hay que volver a pedir cuando el servidor publica un Cambio de cada tipo
 * (modelo de la base). El cliente pide solo esas colecciones; el resto queda como está.
 */
export const COLECCION_DE_MODELO: Record<string, string[]> = {
  Sucursal: ["sucursales"],
  Deposito: ["depositos"],
  Usuario: ["usuarios"],
  UnidadNegocio: ["unidadesNegocio"],
  Rubro: ["rubros"],
  Proveedor: ["proveedores"],
  Producto: ["productos"],
  ListaPrecios: ["listasPrecios"],
  PrecioProducto: ["precios"],
  StockDeposito: ["stock"],
  MovimientoStock: ["stock", "movimientos"],
  TransferenciaStock: ["transferencias", "stock"],
  AjusteStock: ["ajustes", "stock"],
  OrdenCompra: ["ordenesCompra", "stock"],
  RecepcionMercaderia: ["recepciones", "ordenesCompra", "stock"],
  AcopioProveedor: ["acopiosProveedor"],
  Cliente: ["clientes"],
  Obra: ["obras"],
  Cotizacion: ["cotizaciones"],
  NotaPedido: ["notasPedido", "stock"],
  DevolucionNP: ["devoluciones", "notasPedido"],
  AjusteAcopio: ["ajustesAcopio", "acopios"],
  Acopio: ["acopios"],
  Remito: ["remitos", "notasPedido", "stock", "despachos"],
  Adjunto: ["adjuntos", "remitos"],
  Comprobante: ["comprobantes"],
  Vehiculo: ["vehiculos"],
  Chofer: ["choferes"],
  Despacho: ["despachos"],
  HojaRuta: ["hojasRuta", "despachos"],
  Recibo: ["cobranzas", "comprobantes", "cheques"],
  OrdenPago: ["pagosProveedores", "comprobantes", "cheques"],
  Cheque: ["cheques"],
  Configuracion: ["config"],
  Contador: ["numeradores"],
  CotizacionUSD: ["tipo-cambio"],
  Auditoria: ["auditoria"],
};

/** Colecciones a refrescar para una lista de tipos de cambio. */
export function coleccionesDe(tipos: string[]): string[] {
  const out = new Set<string>();
  for (const t of tipos) for (const c of COLECCION_DE_MODELO[t] ?? []) out.add(c);
  // Toda escritura deja auditoría (panel "¿Qué pasó?", historial de la ficha).
  if (tipos.length) out.add("auditoria");
  return [...out];
}
