import type { ClavePrerequisito } from "@/domain/prerequisitos";

/**
 * Textos de los estados vacíos de cada pantalla: qué es la pantalla en una frase,
 * la primera acción y qué hace falta antes (los prerrequisitos salen de `src/domain/prerequisitos.ts`).
 */
export interface TextoVacio {
  titulo: string;
  /** Qué es esta pantalla, en una frase. */
  texto: string;
  /** Frase cuando falta algo; si no se define se arma con los prerrequisitos ("Para empezar necesitás …"). */
  siFalta?: string;
  /** Acción principal cuando no falta nada. */
  accion?: { label: string; href?: string };
  requiere?: ClavePrerequisito[];
}

export const VACIOS = {
  productos: {
    titulo: "Todavía no hay artículos",
    texto: "Todo lo que se compra, se vende y se acopia es un artículo. Cargalos uno por uno o importalos desde un CSV.",
    accion: { label: "Nuevo artículo" },
  },
  clientes: {
    titulo: "Todavía no hay clientes",
    texto: "El cliente es el centro: desde su ficha se ven sus obras, acopios, ventas, cuenta corriente y entregas pendientes.",
    accion: { label: "Nuevo cliente" },
  },
  obras: {
    titulo: "Todavía no hay obras",
    texto: "Cada línea de una nota de pedido indica a qué obra va, y los acopios se asocian a una o más obras.",
    siFalta: "Las obras se cargan dentro de cada cliente: primero necesitás un cliente.",
    requiere: ["cliente"],
  },
  proveedores: {
    titulo: "Todavía no hay proveedores",
    texto: "A los proveedores se les hacen órdenes de compra, se les paga y con ellos se acopia mercadería a costo congelado.",
    accion: { label: "Nuevo proveedor" },
  },
  notasPedido: {
    titulo: "Todavía no hay notas de pedido",
    texto: "Acá se registra cada venta.",
    siFalta: "Para crear la primera necesitás al menos un cliente y un artículo con precio.",
    accion: { label: "Nueva nota de pedido", href: "/ventas/notas-pedido/nueva" },
    requiere: ["articuloConPrecio", "cliente"],
  },
  cotizaciones: {
    titulo: "Todavía no hay cotizaciones",
    texto: "Una cotización es un presupuesto con validez: si el cliente acepta, se convierte en nota de pedido sin volver a cargar nada.",
    siFalta: "Para cotizar necesitás un cliente y un artículo con precio.",
    accion: { label: "Nueva cotización", href: "/ventas/cotizaciones?nuevo=1" },
    requiere: ["articuloConPrecio", "cliente"],
  },
  comprobantes: {
    titulo: "Todavía no hay comprobantes",
    texto: "Las facturas y notas de crédito nacen de las notas de pedido y de los acopios: no se cargan sueltas.",
    siFalta: "Confirmá una venta o creá un acopio y su factura aparece acá.",
    accion: { label: "Nueva nota de pedido", href: "/ventas/notas-pedido/nueva" },
    requiere: ["ventaConfirmada"],
  },
  recibos: {
    titulo: "Todavía no hay recibos",
    texto: "Cada cobro es un recibo: baja la cuenta corriente del cliente y, si pagó con cheque, el cheque queda en cartera.",
    siFalta: "Para registrar un cobro necesitás un cliente.",
    accion: { label: "Registrar cobro", href: "/ventas/recibos?nuevo=1" },
    requiere: ["cliente"],
  },
  devoluciones: {
    titulo: "Todavía no hay devoluciones",
    texto: "Una devolución (DP) vuelve mercadería de una nota de pedido: suma stock y devuelve saldo al acopio o genera nota de crédito.",
    siFalta: "Las devoluciones se hacen desde una nota de pedido entregada.",
    accion: { label: "Ver notas de pedido", href: "/ventas/notas-pedido" },
    requiere: ["ventaConfirmada"],
  },
  acopios: {
    titulo: "Todavía no hay acopios",
    texto: "Un acopio es plata que el cliente deja para retirar materiales a precio congelado.",
    siFalta: "Necesitás un cliente con al menos una obra y una lista de precios con precios cargados.",
    accion: { label: "Nuevo acopio", href: "/acopios/nuevo" },
    requiere: ["clienteConObra", "listaConPrecios"],
  },
  desacopio: {
    titulo: "Todavía no hay acopios",
    texto: "Cuando exista un acopio con retiros, acá vas a ver cada retiro con su precio y vas a poder descargarlo en PDF o Excel.",
    accion: { label: "Nuevo acopio", href: "/acopios/nuevo" },
    requiere: ["clienteConObra", "listaConPrecios"],
  },
  cuentasClientes: {
    titulo: "Todavía no hay cuentas corrientes",
    texto: "Se arma sola con las facturas y los recibos. Si querés arrancar con los saldos que ya tienen, usá «Cargar saldo inicial».",
    siFalta: "Primero necesitás un cliente.",
    requiere: ["cliente"],
  },
  cuentasProveedores: {
    titulo: "Todavía no hay cuentas corrientes con proveedores",
    texto: "Se arma sola con las facturas de compra y las órdenes de pago. Si querés arrancar con lo que ya se les debe, usá «Cargar saldo inicial».",
    siFalta: "Primero necesitás un proveedor.",
    requiere: ["proveedor"],
  },
  cheques: {
    titulo: "No hay cheques en cartera",
    texto: "Los cheques entran solos cuando un cliente paga con cheque en un recibo y salen cuando se entregan en una orden de pago.",
    accion: { label: "Registrar cobro", href: "/ventas/recibos?nuevo=1" },
    requiere: ["cliente"],
  },
  ordenesCompra: {
    titulo: "Todavía no hay órdenes de compra",
    texto: "La orden de compra avisa que viene mercadería: al confirmarla sube el stock en tránsito.",
    siFalta: "Para crear una orden de compra necesitás un proveedor y artículos.",
    accion: { label: "Nueva orden de compra", href: "/compras/oc/nueva" },
    requiere: ["proveedor", "articulo"],
  },
  recepciones: {
    titulo: "Todavía no hay ingresos de mercadería",
    texto: "Al registrar el ingreso de una orden de compra, la mercadería existe en el depósito y nace la deuda con el proveedor.",
    siFalta: "Para recibir mercadería necesitás una orden de compra, y para eso un proveedor y artículos.",
    accion: { label: "Nueva orden de compra", href: "/compras/oc/nueva" },
    requiere: ["proveedor", "articulo"],
  },
  comprobantesCompra: {
    titulo: "Todavía no hay comprobantes de compra",
    texto: "La factura del proveedor se crea sola al registrar el ingreso de mercadería o un acopio con proveedor.",
    accion: { label: "Ingreso de mercadería", href: "/compras/recepciones" },
    requiere: ["proveedor", "articulo"],
  },
  ordenesPago: {
    titulo: "Todavía no hay órdenes de pago",
    texto: "Cada pago a un proveedor es una orden de pago: baja lo que le debemos y puede entregar cheques de cartera.",
    siFalta: "Para pagar necesitás un proveedor.",
    requiere: ["proveedor"],
  },
  acopiosProveedor: {
    titulo: "Todavía no hay acopios con proveedores",
    texto: "Plata adelantada (o en cuenta corriente) a cambio de costo congelado: después retirás con órdenes de compra sin pagar de nuevo.",
    siFalta: "Necesitás un proveedor y artículos.",
    accion: { label: "Nuevo acopio con proveedor", href: "/proveedores/acopios/nuevo" },
    requiere: ["proveedor", "articulo"],
  },
  pendientesRetirar: {
    titulo: "No hay nada pendiente de retirar",
    texto: "Acá aparece lo que nos falta retirar de los acopios con proveedores y lo que tienen pendiente de entregar las órdenes de compra.",
    accion: { label: "Nuevo acopio con proveedor", href: "/proveedores/acopios/nuevo" },
    requiere: ["proveedor", "articulo"],
  },
  stock: {
    titulo: "Todavía no hay stock",
    texto: "El stock se arma solo a partir de los ingresos de mercadería. No se carga a mano: creá una orden de compra y registrá su ingreso, o hacé un ajuste de inventario inicial.",
    siFalta: "Primero cargá los artículos.",
    accion: { label: "Cargar inventario inicial", href: "/stock/ajustes?nuevo=1&motivo=INVENTARIO_INICIAL" },
    requiere: ["articulo"],
  },
  movimientos: {
    titulo: "Todavía no hay movimientos de stock",
    texto: "Cada ingreso, remito, transferencia y ajuste deja una línea en el kardex con su referencia. No se editan ni se borran.",
    accion: { label: "Cargar inventario inicial", href: "/stock/ajustes?nuevo=1&motivo=INVENTARIO_INICIAL" },
    requiere: ["articulo"],
  },
  transferencias: {
    titulo: "Todavía no hay transferencias",
    texto: "Mové mercadería entre depósitos: sale del origen, viaja en tránsito y entra al destino al recibirla.",
    siFalta: "Para transferir necesitás stock en algún depósito.",
    accion: { label: "Nueva transferencia" },
    requiere: ["articuloConStock"],
  },
  ajustes: {
    titulo: "Todavía no hay ajustes de stock",
    texto: "Roturas, faltantes y sobrantes. Para arrancar, cargá lo que ya tienen en cada depósito con un ajuste de inventario inicial.",
    siFalta: "Primero cargá los artículos.",
    accion: { label: "Cargar inventario inicial", href: "/stock/ajustes?nuevo=1&motivo=INVENTARIO_INICIAL" },
    requiere: ["articulo"],
  },
  remitos: {
    titulo: "Todavía no hay remitos",
    texto: "Los remitos nacen de las notas de pedido. Confirmá una venta y generá su remito.",
    accion: { label: "Nuevo remito", href: "/remitos?nuevo=1" },
    requiere: ["ventaConfirmada"],
  },
  despachos: {
    titulo: "Todavía no hay despachos",
    texto: "Los despachos aparecen solos cuando una venta tiene entrega inmediata o cuando programás una entrega pendiente.",
    accion: { label: "Ver pendientes de entrega", href: "/pendientes-entrega" },
    requiere: ["ventaConfirmada"],
  },
  enVivo: {
    titulo: "No hay nada en el depósito ahora",
    texto: "Acá se ve en vivo lo que está esperando, en preparación y finalizado en cada posición de carga.",
    accion: { label: "Ver despachos", href: "/despachos" },
    requiere: ["ventaConfirmada"],
  },
  hojaRuta: {
    titulo: "Todavía no hay hojas de ruta",
    texto: "La hoja de ruta arma el recorrido de un camión con los despachos a domicilio del día.",
    siFalta: "Para armarla necesitás al menos un vehículo cargado.",
    requiere: ["vehiculo"],
  },
  vehiculos: {
    titulo: "Todavía no hay vehículos",
    texto: "Cargá la flota propia y sus choferes para armar las hojas de ruta de los envíos.",
    accion: { label: "Nuevo vehículo" },
  },
  pendientesEntrega: {
    titulo: "No hay entregas pendientes",
    texto: "Lo vendido que todavía no salió del depósito aparece acá y descuenta del disponible: así no se puede sobrevender.",
    accion: { label: "Nueva nota de pedido", href: "/ventas/notas-pedido/nueva" },
    requiere: ["articuloConPrecio", "cliente"],
  },
  alertas: {
    titulo: "Sin alertas",
    texto: "Acá aparecen el stock bajo mínimo, los acopios por vencer, las órdenes atrasadas y las facturas vencidas, a medida que haya movimientos.",
  },
  reportes: {
    titulo: "Sin datos para el reporte",
    texto: "Los reportes se arman solos con las operaciones que se van cargando.",
  },
} satisfies Record<string, TextoVacio>;

export type PaginaVacia = keyof typeof VACIOS;
