/**
 * Diccionario del modo capacitación: ÚNICO lugar con los textos que explican qué cambia
 * en el resto del sistema con cada acción, cada valor de campo y cada pantalla.
 * Los textos admiten `{n}` (cantidad) que el componente reemplaza.
 */

export type Direccion = "crea" | "sube" | "baja" | "cambia" | "cierra";

export interface Efecto {
  modulo: string;
  pagina: string;
  href: string;
  que: string;
  direccion: Direccion;
}

export interface Impacto {
  titulo: string;
  resumen: string;
  efectos: Efecto[];
  porQue: string;
  /** Prerrequisitos (claves de `src/domain/prerequisitos.ts`). */
  requiere?: string[];
}

// ── Páginas de destino (módulo, página, href) ──
const P = {
  stock: ["Stock", "Listado de stock", "/stock"],
  movimientos: ["Stock", "Movimientos", "/stock/movimientos"],
  articulos: ["Stock", "Artículos", "/productos"],
  transferencias: ["Stock", "Transferencias", "/stock/transferencias"],
  ajustes: ["Stock", "Ajustes e inventarios", "/stock/ajustes"],
  listas: ["Ventas", "Listas de precios", "/ventas/listas-precios"],
  notas: ["Ventas", "Notas de pedido", "/ventas/notas-pedido"],
  comprobantes: ["Ventas", "Comprobantes", "/ventas/comprobantes"],
  recibos: ["Ventas", "Recibos", "/ventas/recibos"],
  cotizaciones: ["Ventas", "Cotizaciones", "/ventas/cotizaciones"],
  devoluciones: ["Ventas", "Devoluciones", "/ventas/devoluciones"],
  oc: ["Compras", "Órdenes de compra", "/compras/ordenes"],
  ingresos: ["Compras", "Ingreso de mercadería", "/compras/recepciones"],
  comprobantesCompra: ["Compras", "Comprobantes de compra", "/compras/comprobantes"],
  op: ["Compras", "Órdenes de pago", "/compras/ordenes-pago"],
  fichaCliente: ["Clientes", "Ficha", "/clientes"],
  fichaClienteAcopios: ["Clientes", "Ficha → Acopios", "/clientes"],
  fichaClienteVentas: ["Clientes", "Ficha → Ventas", "/clientes"],
  fichaClienteRemitos: ["Clientes", "Ficha → Remitos", "/clientes"],
  obras: ["Clientes", "Obras", "/clientes/obras"],
  acopios: ["Clientes", "Acopios", "/acopios"],
  acopiosSaldo: ["Acopios", "Saldo disponible", "/acopios"],
  acopiosPendiente: ["Acopios", "Pendiente de entrega", "/acopios"],
  desacopio: ["Clientes", "Estado de desacopio", "/acopios/desacopio"],
  ccClientes: ["Cuentas corrientes", "Clientes", "/cuentas-corrientes/clientes"],
  ccProveedores: ["Cuentas corrientes", "Proveedores", "/cuentas-corrientes/proveedores"],
  cheques: ["Cuentas corrientes", "Cartera de cheques", "/cuentas-corrientes/cheques"],
  fichaProveedor: ["Proveedores", "Ficha", "/proveedores"],
  fichaProveedorPendiente: ["Proveedores", "Ficha → Pendiente de entrega", "/proveedores"],
  acopiosProveedor: ["Proveedores", "Acopios con proveedores", "/proveedores/acopios"],
  pendientesRetirar: ["Proveedores", "Pendientes de retirar", "/proveedores/pendientes"],
  pendientesEntrega: ["General", "Pendientes de entrega", "/pendientes-entrega"],
  tablero: ["General", "Tablero", "/tablero"],
  alertas: ["General", "Alertas", "/alertas"],
  despachos: ["Logística", "Despachos", "/despachos"],
  hojaRuta: ["Logística", "Hoja de ruta", "/despachos/hoja-ruta"],
  vehiculos: ["Logística", "Vehículos y choferes", "/despachos/vehiculos"],
  remitos: ["Remitos", "Remitos", "/remitos"],
  firmados: ["Remitos", "Remitos firmados", "/remitos?firmados=1"],
  repVentas: ["Reportes", "Ventas", "/reportes/ventas"],
  repValorizacion: ["Reportes", "Valorización", "/reportes/valorizacion"],
  repAcopios: ["Reportes", "Acopios de clientes", "/reportes/deuda-mercaderia"],
  numeracion: ["Configuración", "Numeración", "/configuracion?tab=numeracion"],
  inicio: ["General", "Inicio", "/inicio"],
  usuarios: ["Configuración", "Usuarios y roles", "/configuracion?tab=usuarios"],
} as const satisfies Record<string, readonly [string, string, string]>;

type ClaveP = keyof typeof P;
const e = (p: ClaveP, que: string, direccion: Direccion): Efecto => ({ modulo: P[p][0], pagina: P[p][1], href: P[p][2], que, direccion });

export const IMPACTOS: Record<string, Impacto> = {
  // ───────── Maestros ─────────
  crearArticulo: {
    titulo: "Crear artículo",
    resumen: "Al guardar, el artículo queda disponible para comprar, vender y acopiar.",
    efectos: [
      e("stock", "aparece con stock 0 en los dos depósitos", "crea"),
      e("listas", "necesita precio en cada lista; si cargaste costo, podés calcularlo con el markup", "cambia"),
      e("oc", "se puede pedir al proveedor habitual", "crea"),
    ],
    porQue: "Todo lo que se mueve en el sistema es un artículo: sin artículo no hay stock ni venta.",
  },
  importarArticulos: {
    titulo: "Importar artículos",
    resumen: "Al importar, los {n} artículos quedan disponibles para comprar, vender y acopiar.",
    efectos: [
      e("stock", "aparecen con stock 0 en los dos depósitos", "crea"),
      e("listas", "toman precio en cada lista desde el costo + markup; revisalos o recalculalos", "cambia"),
      e("oc", "se pueden pedir a su proveedor habitual", "crea"),
    ],
    porQue: "Todo lo que se mueve en el sistema es un artículo: importarlos de una vez evita tipear el catálogo.",
  },
  editarArticulo: {
    titulo: "Editar artículo",
    resumen: "Los cambios se ven en todas las pantallas; las ventas ya hechas conservan su costo y precio.",
    efectos: [
      e("articulos", "nombre, rubro, unidad y stock mínimo actualizados", "cambia"),
      e("alertas", "si cambiaste el stock mínimo, se recalcula la alerta de reposición", "cambia"),
    ],
    porQue: "El costo snapshot de cada venta nunca se recalcula: la rentabilidad histórica no se toca.",
  },
  crearCliente: {
    titulo: "Crear cliente",
    resumen: "Al guardar, el cliente ya puede comprar, acopiar y tener cuenta corriente.",
    efectos: [
      e("fichaCliente", "se abre su ficha con acopios, ventas, cuenta corriente y pendientes en cero", "crea"),
      e("ccClientes", "aparece con saldo $0 y su límite de crédito", "crea"),
      e("notas", "ya se le puede vender; su lista y condición se precargan", "cambia"),
    ],
    porQue: "El cliente es el centro: todo lo que le pase (acopios, ventas, deudas, entregas) se ve desde su ficha.",
  },
  importarClientes: {
    titulo: "Importar clientes",
    resumen: "Al importar, los {n} clientes (con sus obras) ya pueden comprar, acopiar y tener cuenta corriente.",
    efectos: [
      e("fichaCliente", "cada uno con su ficha en cero", "crea"),
      e("ccClientes", "aparecen con saldo $0 y su límite de crédito", "crea"),
      e("obras", "las obras de la columna «obras» quedan asociadas a cada cliente", "crea"),
    ],
    porQue: "El cliente es el centro: todo lo que le pase se ve desde su ficha.",
  },
  editarCliente: {
    titulo: "Editar cliente",
    resumen: "Los cambios valen para las operaciones nuevas; lo ya vendido conserva sus condiciones.",
    efectos: [
      e("notas", "las ventas nuevas toman la lista y la condición de pago actualizadas", "cambia"),
      e("ccClientes", "si cambiaste el límite de crédito, se recalcula el disponible", "cambia"),
    ],
    porQue: "Cada documento guarda las condiciones del momento: cambiar el cliente no reescribe la historia.",
  },
  editarObra: {
    titulo: "Editar obra",
    resumen: "La obra se actualiza en todas las pantallas donde aparece.",
    efectos: [
      e("desacopio", "los retiros se muestran con el nombre nuevo", "cambia"),
      e("despachos", "la dirección de entrega de los despachos nuevos se actualiza", "cambia"),
    ],
    porQue: "La obra es una sola: cambiarla acá la cambia en todos lados.",
  },
  crearObra: {
    titulo: "Crear obra",
    resumen: "Al guardar, la obra queda asociada al cliente y disponible en sus operaciones.",
    efectos: [
      e("acopios", "se puede asociar al acopio", "cambia"),
      e("notas", "cada línea puede indicar esta obra", "cambia"),
      e("desacopio", "los retiros se muestran por obra", "cambia"),
    ],
    porQue: "La obra dice a dónde va cada bolsa: el cliente y el chofer saben qué entregar y dónde.",
  },
  crearProveedor: {
    titulo: "Crear proveedor",
    resumen: "Al guardar, ya se le pueden hacer órdenes de compra, pagos y acopios.",
    efectos: [
      e("oc", "se le puede hacer una orden de compra", "crea"),
      e("ccProveedores", "aparece con saldo $0", "crea"),
      e("pendientesRetirar", "si acopiás con él, acá vas a ver lo que falta retirar", "cambia"),
    ],
    porQue: "Sin proveedor no hay compra: es de donde entra la mercadería y a quien se le debe.",
  },
  editarProveedor: {
    titulo: "Editar proveedor",
    resumen: "Los cambios valen para las compras y pagos nuevos.",
    efectos: [e("oc", "las OC nuevas toman el circuito y el plazo de entrega actualizados", "cambia")],
    porQue: "Las órdenes ya emitidas conservan lo que se pactó en su momento.",
  },
  enviarOrdenCompra: {
    titulo: "Enviar orden de compra",
    resumen: "La orden queda enviada al proveedor; todavía no cuenta como mercadería en camino.",
    efectos: [
      e("oc", "pasa a Enviada", "cambia"),
      e("stock", "el stock en tránsito sube recién al confirmarla", "cierra"),
    ],
    porQue: "Hasta que el proveedor confirma, el pedido puede cambiar.",
  },
  eliminarOrdenCompra: {
    titulo: "Eliminar borrador de OC",
    resumen: "El borrador se borra: no había afectado stock ni deuda.",
    efectos: [e("oc", "desaparece del listado", "cierra")],
    porQue: "Un borrador nunca comprometió nada, por eso se puede borrar sin dejar rastro en stock ni cuentas.",
  },
  reclamarOC: {
    titulo: "Reclamar orden de compra",
    resumen: "El reclamo queda registrado en la orden y listo para mandar por mail.",
    efectos: [
      e("fichaProveedorPendiente", "la OC muestra el reclamo en su historial", "cambia"),
      e("alertas", "la OC sigue en «atrasadas» hasta que llegue", "cambia"),
    ],
    porQue: "Dejar el reclamo por escrito ayuda a negociar plazos con el proveedor.",
  },
  importarProveedores: {
    titulo: "Importar proveedores",
    resumen: "Al importar, los {n} proveedores quedan listos para órdenes de compra, pagos y acopios.",
    efectos: [
      e("oc", "se les pueden hacer órdenes de compra", "crea"),
      e("ccProveedores", "aparecen con saldo $0", "crea"),
    ],
    porQue: "Sin proveedor no hay compra: es de donde entra la mercadería y a quien se le debe.",
  },
  crearUsuario: {
    titulo: "Crear usuario",
    resumen: "Al crear el usuario se genera una contraseña temporal que se muestra una sola vez.",
    efectos: [
      e("usuarios", "aparece con estado “Contraseña temporal” hasta su primer ingreso", "crea"),
      e("inicio", "al ingresar ve solo los módulos que permite su rol", "cambia"),
    ],
    porQue: "Cada persona entra con su usuario: así el sistema sabe quién hizo cada cosa y qué puede ver.",
  },
  crearVehiculo: {
    titulo: "Crear vehículo",
    resumen: "Al guardar, el vehículo se puede asignar a los envíos y a las hojas de ruta.",
    efectos: [
      e("hojaRuta", "se puede armar el recorrido del día con este vehículo", "crea"),
      e("despachos", "los envíos se pueden asignar a este vehículo según su capacidad", "cambia"),
    ],
    porQue: "La capacidad del vehículo define cuántos despachos entran en un viaje.",
  },
  crearChofer: {
    titulo: "Crear chofer",
    resumen: "Al guardar, el chofer se puede asignar a un vehículo y a las hojas de ruta.",
    efectos: [
      e("vehiculos", "se puede elegir como chofer habitual de un vehículo", "cambia"),
      e("hojaRuta", "figura en la hoja de ruta impresa", "cambia"),
    ],
    porQue: "La hoja de ruta lleva el nombre de quien maneja y entrega.",
  },

  // ───────── Precios ─────────
  actualizarPreciosMasivo: {
    titulo: "Actualización masiva de precios",
    resumen: "Al aplicar, cambian {n} precios de las listas elegidas.",
    efectos: [
      e("listas", "cambian {n} precios", "cambia"),
      e("notas", "las ventas nuevas usan el precio nuevo", "cambia"),
      e("acopios", "los precios congelados NO cambian", "cierra"),
      e("repAcopios", "la exposición cambia", "cambia"),
    ],
    porQue: "El acopio protege al cliente de la suba: por eso su lista queda congelada aunque la general cambie.",
    requiere: ["articulo"],
  },
  actualizarPrecio: {
    titulo: "Cambiar un precio",
    resumen: "Al guardar, las ventas nuevas de este artículo en esta lista salen con el precio nuevo.",
    efectos: [
      e("notas", "las ventas nuevas usan el precio nuevo", "cambia"),
      e("acopios", "los precios congelados NO cambian", "cierra"),
    ],
    porQue: "Lo ya vendido conserva su precio: el cambio vale de acá en adelante.",
  },

  // ───────── Compras ─────────
  crearOrdenCompra: {
    titulo: "Guardar orden de compra",
    resumen: "Queda en borrador: no afecta stock ni deuda.",
    efectos: [e("oc", "queda en borrador, no afecta stock ni deuda", "crea")],
    porQue: "El borrador sirve para armar el pedido tranquilo; recién al confirmarla el sistema la tiene en cuenta.",
    requiere: ["proveedor", "articulo"],
  },
  confirmarOrdenCompra: {
    titulo: "Confirmar orden de compra",
    resumen: "Al confirmar, el sistema sabe que viene mercadería.",
    efectos: [
      e("stock", "En tránsito sube por las cantidades pedidas", "sube"),
      e("fichaProveedorPendiente", "aparece la OC", "crea"),
      e("tablero", "Compras pendientes de ingreso", "crea"),
      e("alertas", "si pasa la fecha estimada sin recibir, alerta de OC atrasada", "cambia"),
    ],
    porQue: "Confirmar no compra todavía: avisa a todos que el stock va a subir y evita que otro pida lo mismo.",
    requiere: ["proveedor", "articulo"],
  },
  confirmarOrdenCompraDeAcopio: {
    titulo: "Confirmar retiro de acopio con proveedor",
    resumen: "Al confirmar, el sistema sabe que viene mercadería ya pagada en el acopio.",
    efectos: [
      e("stock", "En tránsito sube por las cantidades pedidas", "sube"),
      e("acopiosProveedor", "Saldo disponible baja", "baja"),
      e("fichaProveedorPendiente", "aparece la OC", "crea"),
      e("ccProveedores", "al recibir NO va a generar deuda nueva", "cierra"),
    ],
    porQue: "El acopio ya se pagó (o se debe) por el total: retirar solo mueve mercadería, no plata.",
    requiere: ["proveedor", "articulo"],
  },
  cancelarOrdenCompra: {
    titulo: "Cancelar saldo de la orden",
    resumen: "Lo que no se recibió deja de esperarse.",
    efectos: [
      e("stock", "En tránsito baja por lo pendiente", "baja"),
      e("fichaProveedorPendiente", "la OC deja de figurar como pendiente", "cierra"),
    ],
    porQue: "Si el proveedor no va a entregar el resto, el sistema no puede seguir contando con esa mercadería.",
  },
  registrarRecepcion: {
    titulo: "Registrar ingreso de mercadería",
    resumen: "Al registrar el ingreso, la mercadería existe en el depósito y nace la deuda con el proveedor.",
    efectos: [
      e("stock", "Físico sube, En tránsito baja", "sube"),
      e("movimientos", "una línea INGRESO_COMPRA por artículo", "crea"),
      e("articulos", "costo último y costo promedio se actualizan", "cambia"),
      e("comprobantesCompra", "se crea la factura del proveedor", "crea"),
      e("ccProveedores", "Le debemos sube", "sube"),
      e("listas", "si el costo subió más del 3%, te avisa para actualizar precios", "cambia"),
    ],
    porQue: "Este es el momento en que el proveedor facturó y el galpón tiene la mercadería: las dos cosas se registran juntas.",
  },
  registrarRecepcionDeAcopio: {
    titulo: "Registrar ingreso de un retiro de acopio",
    resumen: "Al registrar el ingreso, la mercadería entra al depósito a costo congelado y no se genera deuda nueva.",
    efectos: [
      e("stock", "Físico sube, En tránsito baja", "sube"),
      e("movimientos", "una línea INGRESO_COMPRA por artículo", "crea"),
      e("pendientesRetirar", "Nos falta retirar baja", "baja"),
      e("ccProveedores", "NO genera deuda nueva: ya está en el acopio", "cierra"),
    ],
    porQue: "La mercadería del acopio ya estaba facturada: solo cambia de lugar, del proveedor a tu galpón.",
  },
  crearOrdenPago: {
    titulo: "Registrar orden de pago",
    resumen: "Al pagar, baja lo que le debemos al proveedor.",
    efectos: [
      e("ccProveedores", "Le debemos baja", "baja"),
      e("cheques", "si pagaste con un cheque de cartera, queda Entregado", "cambia"),
      e("tablero", "Pagado este mes", "sube"),
    ],
    porQue: "Cada pago se imputa a facturas concretas: así sabés qué está saldado y qué no.",
    requiere: ["proveedor"],
  },
  crearAcopioProveedor: {
    titulo: "Crear acopio con proveedor",
    resumen: "Al crear el acopio, el costo queda congelado y nace lo que te tienen que entregar.",
    efectos: [
      e("acopiosProveedor", "aparece el acopio con su saldo", "crea"),
      e("pendientesRetirar", "saldo a retirar sube", "sube"),
      e("comprobantesCompra", "factura por el importe", "crea"),
      e("op", "si es anticipo, se genera el pago ahora", "crea"),
      e("ccProveedores", "si es cuenta corriente, Le debemos sube", "sube"),
      e("tablero", "Acopios con proveedores", "sube"),
    ],
    porQue: "Es plata adelantada a cambio de costo congelado: después retirás con órdenes de compra sin pagar de nuevo.",
    requiere: ["proveedor", "articulo"],
  },
  extenderVencimientoAcopioProveedor: {
    titulo: "Extender vencimiento del acopio con proveedor",
    resumen: "El acopio sigue vigente hasta la nueva fecha.",
    efectos: [e("acopiosProveedor", "vencimiento nuevo; sale de la alerta de vencimiento", "cambia")],
    porQue: "Si el proveedor acepta esperar, el saldo sigue disponible para retirar.",
  },
  cancelarAcopioProveedor: {
    titulo: "Cancelar acopio con proveedor",
    resumen: "El saldo que quedaba sin retirar deja de estar disponible.",
    efectos: [
      e("pendientesRetirar", "Nos falta retirar baja a cero", "baja"),
      e("stock", "En tránsito baja por lo pactado sin pedir", "baja"),
      e("acopiosProveedor", "queda Cancelado", "cierra"),
    ],
    porQue: "Cancelar cierra el acuerdo: lo que no se retiró no se va a recibir.",
  },

  // ───────── Stock ─────────
  inventarioInicial: {
    titulo: "Cargar inventario inicial",
    resumen: "Al registrar, lo que ya tienen en el galpón entra al stock físico al costo que indicaste.",
    efectos: [
      e("stock", "Físico y Disponible suben en el depósito elegido", "sube"),
      e("movimientos", "una línea AJUSTE por artículo con motivo Inventario inicial", "crea"),
      e("articulos", "el costo promedio toma el costo indicado", "cambia"),
      e("repValorizacion", "el inventario valorizado sube", "sube"),
    ],
    porQue: "Es la forma correcta de arrancar: el stock sale del kardex, nunca de un número cargado a mano.",
    requiere: ["articulo"],
  },
  crearAjuste: {
    titulo: "Registrar ajuste de stock",
    resumen: "Al registrar, el stock físico cambia y queda la explicación en el kardex.",
    efectos: [
      e("stock", "Físico y Disponible cambian", "cambia"),
      e("movimientos", "una línea AJUSTE por artículo con su motivo", "crea"),
      e("repValorizacion", "cambia el inventario valorizado", "cambia"),
      e("alertas", "si queda bajo el mínimo, alerta de reposición", "cambia"),
    ],
    porQue: "Roturas y diferencias de conteo pasan: el ajuste las registra con motivo y responsable.",
    requiere: ["articulo"],
  },
  transferirStock: {
    titulo: "Transferir entre depósitos",
    resumen: "Al despachar, la mercadería sale del origen y viaja hasta que el destino la recibe.",
    efectos: [
      e("stock", "Físico baja en origen", "baja"),
      e("transferencias", "queda En tránsito entre depósitos", "crea"),
      e("movimientos", "TRANSFERENCIA_SALIDA en el origen", "crea"),
    ],
    porQue: "Mientras viaja no está en ningún depósito: así nadie la vende dos veces.",
    requiere: ["articuloConStock"],
  },
  recibirTransferencia: {
    titulo: "Recibir transferencia",
    resumen: "Al recibir, la mercadería entra al depósito de destino.",
    efectos: [
      e("stock", "Físico sube en destino", "sube"),
      e("transferencias", "En tránsito entre depósitos baja; queda Recibida", "cierra"),
      e("movimientos", "TRANSFERENCIA_ENTRADA en el destino", "crea"),
    ],
    porQue: "El destino confirma lo que llegó: recién ahí se puede vender desde ese depósito.",
  },

  cancelarTransferencia: {
    titulo: "Cancelar transferencia",
    resumen: "La transferencia pendiente se cancela: el stock no se movió.",
    efectos: [e("transferencias", "queda Cancelada", "cierra")],
    porQue: "Solo se cancela lo que todavía no salió del depósito de origen.",
  },

  // ───────── Ventas ─────────
  crearCotizacion: {
    titulo: "Guardar cotización",
    resumen: "La cotización no reserva stock ni genera deuda: es una propuesta con validez.",
    efectos: [
      e("cotizaciones", "queda con su validez en días", "crea"),
      e("fichaCliente", "aparece en el historial del cliente", "crea"),
    ],
    porQue: "Cotizar no compromete mercadería: si el cliente acepta, se convierte en nota de pedido sin volver a cargar.",
    requiere: ["cliente", "articuloConPrecio"],
  },
  rechazarCotizacion: {
    titulo: "Rechazar cotización",
    resumen: "La cotización queda cerrada como rechazada; no reservó nada, así que no libera nada.",
    efectos: [e("cotizaciones", "queda Rechazada en el historial del cliente", "cierra")],
    porQue: "Saber qué se cotizó y no se vendió ayuda a revisar precios.",
  },
  convertirCotizacion: {
    titulo: "Convertir en nota de pedido",
    resumen: "Se abre la nota de pedido con los mismos artículos y precios de la cotización.",
    efectos: [
      e("notas", "nace la nota de pedido; al confirmarla se reserva el stock", "crea"),
      e("cotizaciones", "queda Aceptada y vinculada a la NP", "cierra"),
    ],
    porQue: "Lo cotizado se respeta: no hace falta volver a cargar precios ni artículos.",
  },
  guardarBorradorNotaPedido: {
    titulo: "Guardar borrador",
    resumen: "El borrador no reserva stock ni descuenta saldo de acopios.",
    efectos: [e("notas", "queda en borrador para terminarla después", "crea")],
    porQue: "Recién al confirmar la venta compromete mercadería.",
  },
  confirmarNotaPedidoNueva: {
    titulo: "Confirmar venta",
    resumen: "Al confirmar la venta, el stock queda reservado para este cliente aunque todavía no salga del depósito.",
    efectos: [
      e("stock", "Pendiente de entrega sube y Disponible baja; el Físico no cambia", "cambia"),
      e("pendientesEntrega", "aparece una línea por artículo", "crea"),
      e("despachos", "si elegiste entrega inmediata, se crea un despacho En espera", "crea"),
      e("fichaClienteVentas", "aparece la venta", "crea"),
      e("comprobantes", "falta facturar", "cambia"),
    ],
    porQue: "Así nadie puede vender lo que ya es de este cliente, aunque la bolsa siga en el galpón.",
    requiere: ["cliente", "articuloConPrecio"],
  },
  confirmarNotaPedidoAcopio: {
    titulo: "Confirmar retiro de acopio",
    resumen: "Al confirmar el retiro, baja el saldo del acopio y el stock queda reservado para el cliente.",
    efectos: [
      e("stock", "Pendiente de entrega sube y Disponible baja; el Físico no cambia", "cambia"),
      e("pendientesEntrega", "aparece una línea por artículo", "crea"),
      e("acopiosSaldo", "baja por el monto a precios congelados", "baja"),
      e("desacopio", "aparece como un grupo NP con sus líneas", "crea"),
      e("tablero", "Deuda de mercadería", "baja"),
      e("comprobantes", "NO se factura ni se cobra: el acopio ya se facturó al crearse", "cierra"),
    ],
    porQue: "El cliente ya pagó: cada retiro descuenta del saldo a los precios del día del acopio.",
    requiere: ["acopio"],
  },
  facturarNotaPedido: {
    titulo: "Facturar nota de pedido",
    resumen: "Al facturar, la venta entra en las ventas del período y, si es en cuenta corriente, queda a cobrar.",
    efectos: [
      e("comprobantes", "se crea la factura F1/F2", "crea"),
      e("ccClientes", "si es cuenta corriente, saldo sube con vencimiento según condición", "sube"),
      e("tablero", "Por cobrar", "sube"),
      e("repVentas", "entra en el período", "cambia"),
    ],
    porQue: "La factura es lo que el cliente debe: con ella se calculan ventas, margen y cuenta corriente.",
  },
  anularNotaPedido: {
    titulo: "Anular nota de pedido",
    resumen: "Al anular, lo reservado vuelve a estar disponible para vender.",
    efectos: [
      e("stock", "libera Pendiente de entrega y Disponible vuelve a subir", "sube"),
      e("pendientesEntrega", "las líneas de la NP desaparecen", "cierra"),
      e("acopiosSaldo", "si era un retiro de acopio, el saldo vuelve", "sube"),
      e("despachos", "sus despachos en espera se cancelan", "cierra"),
    ],
    porQue: "Una venta anulada no puede seguir reteniendo mercadería ni saldo.",
  },
  anularComprobante: {
    titulo: "Anular comprobante",
    resumen: "Al anular, el comprobante deja de sumar en la cuenta corriente y en las ventas.",
    efectos: [
      e("ccClientes", "el saldo baja por el pendiente de la factura", "baja"),
      e("repVentas", "sale de las ventas del período", "baja"),
      e("tablero", "Por cobrar baja", "baja"),
    ],
    porQue: "Lo anulado queda visible pero no cuenta: la numeración no se reutiliza.",
  },
  crearDevolucion: {
    titulo: "Registrar devolución",
    resumen: "Al registrar la devolución (DP), lo devuelto vuelve al stock cuando su remito de devolución se marca Hecho.",
    efectos: [
      e("devoluciones", "se crea la DP", "crea"),
      e("remitos", "remito de devolución RD", "crea"),
      e("stock", "al marcar el RD Hecho, el Físico sube", "sube"),
      e("acopiosSaldo", "vuelve a subir al precio congelado si la venta era de acopio", "sube"),
      e("comprobantes", "nota de crédito si estaba facturada", "crea"),
    ],
    porQue: "La devolución deshace la venta en las dos puntas: la mercadería vuelve y la plata (o el saldo) también.",
  },

  // ───────── Acopios de clientes ─────────
  crearAcopio: {
    titulo: "Crear acopio",
    resumen: "Al crear el acopio se congela la lista de precios de hoy y nace la deuda de mercadería.",
    efectos: [
      e("fichaClienteAcopios", "aparece el acopio del cliente", "crea"),
      e("acopiosSaldo", "= importe", "sube"),
      e("comprobantes", "factura F1/F2 por el importe", "crea"),
      e("recibos", "si es anticipo, recibo por el importe", "crea"),
      e("ccClientes", "si es cuenta corriente, queda a cobrar", "sube"),
      e("tablero", "Deuda de mercadería", "sube"),
      e("desacopio", "ya se puede consultar y descargar", "crea"),
    ],
    porQue: "El cliente paga hoy y retira después: la plata entra ahora, la mercadería sale de a poco.",
    requiere: ["clienteConObra", "listaConPrecios"],
  },
  traspasarSaldoAcopio: {
    titulo: "Traspasar saldo entre acopios",
    resumen: "El importe pasa de un acopio al otro sin mover plata ni mercadería.",
    efectos: [
      e("acopiosSaldo", "Acopio origen: saldo disponible baja", "baja"),
      e("acopiosSaldo", "Acopio destino: saldo disponible sube", "sube"),
      e("desacopio", "aparece un ACD en los dos", "crea"),
    ],
    porQue: "El saldo es del cliente: lo puede usar en otra obra u otro acopio, y queda documentado.",
  },
  ajustarSaldoAcopio: {
    titulo: "Ajustar saldo del acopio",
    resumen: "El saldo disponible cambia por el monto del ajuste (ACD).",
    efectos: [
      e("acopiosSaldo", "sube o baja por el ajuste", "cambia"),
      e("desacopio", "aparece un ACD con su motivo", "crea"),
      e("tablero", "Deuda de mercadería cambia", "cambia"),
    ],
    porQue: "Cualquier diferencia acordada con el cliente queda escrita en el detalle del acopio.",
  },
  extenderVencimientoAcopio: {
    titulo: "Extender vencimiento",
    resumen: "El acopio sigue vigente hasta la nueva fecha.",
    efectos: [
      e("acopios", "vencimiento nuevo; si estaba Vencido, vuelve a Vigente", "cambia"),
      e("alertas", "sale de «Acopios por vencer o vencidos»", "baja"),
    ],
    porQue: "Extender respeta los precios congelados: el cliente sigue retirando a los mismos valores.",
  },
  cancelarAcopio: {
    titulo: "Cancelar acopio",
    resumen: "El saldo que quedaba deja de estar disponible para retirar.",
    efectos: [
      e("acopios", "queda Cancelado", "cierra"),
      e("tablero", "Deuda de mercadería baja por el saldo", "baja"),
    ],
    porQue: "Cancelar cierra el acuerdo con el cliente: el saldo restante se resuelve aparte.",
  },
  canjearProductoAcopio: {
    titulo: "Canjear artículo del acopio",
    resumen: "El cliente cambia un artículo por otro: el saldo se recalcula a precios congelados.",
    efectos: [
      e("acopiosSaldo", "cambia según la diferencia de precio congelado", "cambia"),
      e("desacopio", "el canje figura en el detalle", "crea"),
    ],
    porQue: "El acopio es por monto: lo que importa es la plata, no el artículo original.",
  },

  // ───────── Remitos y logística ─────────
  generarRemito: {
    titulo: "Generar remito",
    resumen: "Nace el remito de la nota de pedido; el stock todavía no cambia.",
    efectos: [
      e("remitos", "nace en estado Inicial, Firmado: No", "crea"),
      e("stock", "el stock todavía no cambia", "cierra"),
    ],
    porQue: "El remito es la orden de salida: primero se prepara, después sale.",
    requiere: ["ventaConfirmada"],
  },
  iniciarPicking: {
    titulo: "Iniciar picking",
    resumen: "Al pasar a Picking, el depósito empieza a preparar y la mercadería queda reservada.",
    efectos: [
      e("stock", "Reservado sube: nadie puede venderlo ni transferirlo", "sube"),
      e("despachos", "pasa a Preparación y empieza a contar el tiempo", "cambia"),
    ],
    porQue: "Lo que está en la playa armado para salir no puede ir a otro cliente.",
  },
  marcarRemitoHecho: {
    titulo: "Marcar remito Hecho",
    resumen: "Al marcar Hecho, la mercadería sale del depósito. Es el único momento en que baja el físico.",
    efectos: [
      e("stock", "Físico baja, Pendiente de entrega y Reservado bajan; Disponible queda igual porque ya se había descontado al vender", "baja"),
      e("movimientos", "EGRESO_VENTA o EGRESO_ACOPIO con este remito como referencia", "crea"),
      e("notas", "Entregados sube; si se entregó todo, la NP se cierra", "cambia"),
      e("acopiosPendiente", "baja", "baja"),
      e("despachos", "Finalizado, se cierra el tiempo total", "cierra"),
      e("firmados", "se abre la ventana para subir el remito firmado; hasta que lo subas figura Sin firmar", "cambia"),
    ],
    porQue: "El remito es la prueba de que salió: por eso recién acá baja el físico y por eso se guarda firmado.",
  },
  anularRemito: {
    titulo: "Anular remito",
    resumen: "El remito se anula y lo que tenía vuelve a quedar pendiente de entrega.",
    efectos: [
      e("stock", "si estaba en Picking, Reservado baja", "baja"),
      e("pendientesEntrega", "las cantidades vuelven a estar pendientes", "sube"),
    ],
    porQue: "Un remito que no salió no puede quedar como entregado.",
  },
  subirRemitoFirmado: {
    titulo: "Subir remito firmado",
    resumen: "El remito queda cerrado en papel: la firma del cliente queda guardada.",
    efectos: [
      e("remitos", "Firmado: Sí, clip en verde", "cambia"),
      e("tablero", "Remitos sin firmar", "baja"),
      e("fichaClienteRemitos", "el remito figura firmado", "cambia"),
    ],
    porQue: "Ante un reclamo, la foto del remito firmado es la prueba de entrega.",
  },
  retiroEnMostrador: {
    titulo: "Retiro en mostrador",
    resumen: "El cliente se lleva la mercadería ahora: se genera el remito ya Hecho.",
    efectos: [
      e("stock", "Físico baja y Pendiente de entrega baja", "baja"),
      e("remitos", "remito Hecho, listo para subir firmado", "crea"),
      e("notas", "Entregados sube", "cambia"),
    ],
    porQue: "Si el cliente retira en el momento, preparación y salida son una sola cosa.",
  },
  programarEntrega: {
    titulo: "Programar entrega",
    resumen: "La entrega pendiente queda con fecha y entra a la cola del depósito.",
    efectos: [
      e("despachos", "se crea En espera", "crea"),
      e("pendientesEntrega", "pasa de Sin programar a programado con fecha", "cambia"),
    ],
    porQue: "Lo que tiene fecha se prepara a tiempo; lo que no, aparece en la alerta de entregas sin programar.",
  },
  iniciarPreparacion: {
    titulo: "Iniciar preparación",
    resumen: "El depósito empieza a armar el pedido en la posición elegida.",
    efectos: [
      e("despachos", "Preparación: empieza a contar el tiempo de armado", "cambia"),
      e("stock", "si genera remito en picking, Reservado sube", "sube"),
    ],
    porQue: "Medir espera y preparación muestra dónde se pierde tiempo en el depósito.",
  },
  finalizarDespacho: {
    titulo: "Finalizar despacho",
    resumen: "El pedido quedó armado y sale: se cierra el tiempo total.",
    efectos: [
      e("despachos", "Finalizado, se cierra el tiempo total", "cierra"),
      e("remitos", "el remito pasa a Hecho y baja el físico", "cambia"),
    ],
    porQue: "El tiempo total de cada despacho alimenta el reporte de tiempos.",
  },
  iniciarRecorrido: {
    titulo: "Iniciar recorrido",
    resumen: "El camión sale con todos los despachos de la hoja de ruta.",
    efectos: [
      e("stock", "Físico baja ahora, porque la mercadería sale en el camión", "baja"),
      e("remitos", "pasan a Hecho", "cambia"),
      e("despachos", "En viaje", "cambia"),
    ],
    porQue: "Lo que va arriba del camión ya no está en el galpón.",
  },
  marcarEntregado: {
    titulo: "Marcar entregado",
    resumen: "El cliente recibió: el despacho se cierra.",
    efectos: [
      e("despachos", "Entregado", "cierra"),
      e("remitos", "se sube el remito firmado", "cambia"),
    ],
    porQue: "Cerrar la entrega deja el registro de cuándo llegó cada pedido.",
  },

  comentarRemito: {
    titulo: "Comentar remito",
    resumen: "El comentario queda guardado en el remito.",
    efectos: [e("remitos", "se ve en el detalle del remito", "cambia")],
    porQue: "Cualquier novedad de la entrega (faltó algo, llegó tarde) queda junto al documento.",
  },
  cancelarDespacho: {
    titulo: "Cancelar despacho",
    resumen: "El despacho se cancela y la mercadería vuelve a quedar pendiente de entrega.",
    efectos: [
      e("despachos", "queda Cancelado", "cierra"),
      e("pendientesEntrega", "las líneas vuelven a Sin programar", "cambia"),
    ],
    porQue: "La venta sigue vigente: solo se deshace la programación de la entrega.",
  },
  reprogramarDespacho: {
    titulo: "Reprogramar despacho",
    resumen: "La entrega cambia de fecha.",
    efectos: [
      e("despachos", "nueva fecha programada; suma una reprogramación", "cambia"),
      e("pendientesEntrega", "la línea muestra la fecha nueva", "cambia"),
    ],
    porQue: "Las reprogramaciones quedan contadas para ver qué entregas se demoran.",
  },
  asignarPosicion: {
    titulo: "Asignar posición de carga",
    resumen: "El pedido se arma en la posición elegida.",
    efectos: [e("despachos", "Depósito en vivo lo muestra en esa posición", "cambia")],
    porQue: "Ordenar las posiciones evita que dos pedidos se mezclen en la playa.",
  },
  armarHojaRuta: {
    titulo: "Armar hoja de ruta",
    resumen: "El recorrido del vehículo cambia (despachos, orden o chofer).",
    efectos: [
      e("hojaRuta", "cambia el recorrido y la carga del vehículo", "cambia"),
      e("despachos", "el despacho queda asignado al vehículo", "cambia"),
    ],
    porQue: "La hoja de ruta ordena las entregas del día y controla la capacidad del camión.",
  },
  cerrarHojaRuta: {
    titulo: "Cerrar hoja de ruta",
    resumen: "El recorrido terminó: se cierran los despachos entregados.",
    efectos: [
      e("hojaRuta", "queda Cerrada", "cierra"),
      e("despachos", "los despachos del recorrido pasan a Entregado", "cierra"),
    ],
    porQue: "Cerrar la hoja deja registrado cuándo terminó cada viaje.",
  },

  // ───────── Cobranzas ─────────
  registrarCobro: {
    titulo: "Registrar cobro",
    resumen: "Al cobrar, baja lo que el cliente debe y, si pagó con cheque, el cheque queda en cartera.",
    efectos: [
      e("ccClientes", "saldo baja; las facturas imputadas pasan a Pagado o Parcial", "baja"),
      e("cheques", "si pagó con cheque, entra a la cartera", "crea"),
      e("acopios", "si imputaste a un acopio en cuenta corriente, Pagado sube y habilita retiros", "cambia"),
      e("tablero", "Por cobrar baja y Cobrado este mes sube", "baja"),
    ],
    porQue: "Cada peso cobrado se imputa a una factura: así se sabe exactamente qué está pago.",
    requiere: ["cliente"],
  },
  cambiarEstadoCheque: {
    titulo: "Cambiar estado del cheque",
    resumen: "El cheque deja la cartera (depositado o rechazado).",
    efectos: [
      e("cheques", "sale de En cartera y ya no se puede entregar a un proveedor", "cambia"),
      e("ccClientes", "si fue rechazado, hay que volver a cobrarle al cliente", "cambia"),
    ],
    porQue: "La cartera muestra solo los cheques que todavía se pueden usar.",
  },
  cargarSaldoInicial: {
    titulo: "Cargar saldo inicial",
    resumen: "El saldo que traía la cuenta del sistema anterior entra como un comprobante de saldo inicial.",
    efectos: [
      e("ccClientes", "el saldo del cliente cambia por el importe", "cambia"),
      e("ccProveedores", "o, si es un proveedor, Le debemos cambia", "cambia"),
      e("tablero", "Por cobrar cambia", "cambia"),
      e("alertas", "si ya está vencido, entra en Comprobantes vencidos", "cambia"),
    ],
    porQue: "Arrancar con los saldos reales permite cobrar y pagar desde el primer día sin cargar facturas viejas.",
  },

  // ───────── Configuración y datos del demo ─────────
  establecerNumeroInicial: {
    titulo: "Establecer número inicial",
    resumen: "El próximo documento de este tipo sale con el número que indicaste.",
    efectos: [e("numeracion", "el contador continúa desde el número del sistema actual", "cambia")],
    porQue: "Así la numeración sigue la del sistema actual y no se pisan números.",
  },
  cargarDatosEjemplo: {
    titulo: "Cargar datos de ejemplo",
    resumen: "Se cargan meses de operación de ejemplo en todas las pantallas.",
    efectos: [
      e("tablero", "KPIs y gráficos con volumen", "cambia"),
      e("stock", "artículos con stock, pendientes y reservas", "crea"),
      e("acopios", "acopios con retiros, devoluciones y traspasos", "crea"),
      e("ccClientes", "clientes con deuda, vencidos y cheques", "crea"),
    ],
    porQue: "Sirve para ver el sistema con volumen; lo cargado en vivo se reemplaza.",
  },
  vaciarDatos: {
    titulo: "Vaciar todo",
    resumen: "Se borra todo lo cargado y queda solo la estructura de la empresa.",
    efectos: [
      e("inicio", "vuelve a aparecer la guía de carga inicial", "crea"),
      e("tablero", "KPIs en «—»", "cierra"),
      e("numeracion", "vuelve a 0", "cierra"),
    ],
    porQue: "Deja el sistema como el primer día, listo para cargar de cero.",
  },
};

/** Una línea por valor de campo: se muestra debajo del control cuando ese valor está elegido. */
export const CAMPOS: Record<string, string> = {
  "parametros.tipoCambio": "Dólar divisa vendedor del Banco Nación, actualizado solo de lunes a viernes. Lo usan los costos en USD de los artículos, las OC y acopios con proveedores en dólares, y los clientes con precios en USD. Cada documento guarda el tipo de cambio con el que se confirmó: cambiarlo acá no modifica documentos ya confirmados.",
  "producto.monedaCosto": "Con costo en USD, el costo en pesos se recalcula con el dólar vigente al guardar y desde Actualización masiva → Recalcular desde costo USD.",
  "moneda.USD": "En dólares: se carga en USD y el sistema lo pasa a pesos con el dólar vigente. Al confirmar, el documento guarda su propio tipo de cambio (los cambios posteriores del dólar no lo afectan).",
  "moneda.ARS": "En pesos: no usa el tipo de cambio.",
  "cliente.facturaEnUSD": "Habilita Precios en USD en cotizaciones y notas de pedido de este cliente. Los importes quedan en pesos para la cuenta corriente; el documento se muestra en dólares al tipo de cambio aplicado.",
  "origen.NUEVA": "Venta a precio de lista. Se cobra contado o en cuenta corriente y se factura.",
  "origen.ACOPIO": "Retiro de un acopio: precios congelados, descuenta del saldo del acopio, no se factura ni se cobra.",
  "formaPago.CONTADO": "Se registra el cobro al facturar. No queda deuda.",
  "formaPago.CUENTA_CORRIENTE": "La factura queda a cobrar en Cuentas corrientes → Clientes. Valida el límite de crédito.",
  "formaPago.ACOPIO": "Lo paga el saldo del acopio.",
  "entrega.INMEDIATA": "Se crea un despacho En espera ahora. El físico baja cuando el remito se marca Hecho.",
  "entrega.PENDIENTE": "Queda en Pendientes de entrega con el stock reservado hasta que se programe o retire.",
  "circuito.1": "Fiscal: factura A/B, numeración F1.",
  "circuito.2": "Interno: documentos con numeración 2.",
  "acopio.formaPago.ANTICIPO": "Paga ahora: se genera el recibo al crear.",
  "acopio.formaPago.CUENTA_CORRIENTE": "Lo va pagando: no puede retirar más proporción que la pagada.",
  deposito: "El stock se reserva y se descuenta de este depósito.",
  "oc.deposito": "La mercadería entra a este depósito: ahí sube el en tránsito y, al recibir, el físico.",
  "ajuste.deposito": "El ajuste suma o resta el stock físico de este depósito.",
  "transferencia.destino": "Sale del depósito de origen al despachar y entra a este cuando se recibe.",
  "oc.origen.NUEVA": "Compra nueva: al recibirla nace la factura del proveedor y la deuda.",
  "oc.origen.ACOPIO": "Retira de un acopio con el proveedor: costos congelados, no genera deuda al recibir.",
  "acopioProveedor.modalidad.MONTO": "Por monto: retirás lo que quieras hasta agotar el importe, a costo congelado.",
  "acopioProveedor.modalidad.CANTIDAD": "Por cantidad: el proveedor te debe esas unidades; En tránsito sube por lo pactado.",
  "remito.estado.INICIAL": "Inicial: el remito existe pero el depósito todavía no empezó a prepararlo.",
  "remito.estado.PICKING": "Picking: la mercadería se está preparando y queda reservada; nadie más la puede vender.",
  "remito.estado.HECHO": "Hecho: la mercadería salió. Baja el físico y se habilita subir el remito firmado.",
  "despacho.posicion": "La posición de carga indica dónde se arma el pedido (playa, galpón, mostrador) y ordena el depósito en vivo.",
  "cotizacion.validez": "Pasados estos días la cotización vence y hay que volver a cotizar con precios del día.",
  "acopio.vencimiento": "Después de esta fecha, si queda saldo, el acopio pasa a Vencido y aparece en alertas.",
  "cliente.limiteCredito": "Las ventas en cuenta corriente que superen este límite piden autorización del dueño.",
  "producto.stockMinimo": "Dispara la alerta de reposición y la sugerencia en OC.",
  "producto.costo": "Con el costo, cada lista calcula su precio con su markup.",
  "ajuste.motivo.INVENTARIO_INICIAL": "Inventario inicial: suma lo que ya está en el galpón al costo que indiques.",
  "cobro.medio.CHEQUE": "El cheque entra a la cartera; después se deposita o se entrega a un proveedor.",
};

/** Una entrada por ruta: de dónde se alimenta la pantalla y a qué alimenta. */
export const PAGINAS: Record<string, { seAlimentaDe: string; alimentaA: string }> = {
  "/inicio": { seAlimentaDe: "todos los módulos", alimentaA: "los accesos a cada página y la guía de carga inicial" },
  "/tablero": { seAlimentaDe: "las facturas, las notas de pedido, los acopios, los acopios con proveedores y el stock", alimentaA: "las decisiones del día: qué cobrar, qué reponer y qué despachar" },
  "/alertas": { seAlimentaDe: "el stock mínimo, los vencimientos de acopios y facturas, las OC atrasadas y las entregas sin programar", alimentaA: "la campana del encabezado y el tablero" },
  "/pendientes-entrega": { seAlimentaDe: "las notas de pedido confirmadas menos los remitos hechos", alimentaA: "el disponible de stock, los despachos y la ficha de cada cliente" },
  "/clientes": { seAlimentaDe: "el alta de clientes y obras", alimentaA: "las notas de pedido, los acopios, las cuentas corrientes y los remitos" },
  "/clientes/obras": { seAlimentaDe: "las obras de cada cliente", alimentaA: "las líneas de las notas de pedido, los acopios y el estado de desacopio" },
  "/acopios": { seAlimentaDe: "los acopios, sus retiros (NP), devoluciones (DP) y ajustes (ACD)", alimentaA: "la deuda de mercadería del tablero, el estado de desacopio y la cuenta corriente" },
  "/acopios/nuevo": { seAlimentaDe: "el cliente, sus obras y la lista de precios del día", alimentaA: "el saldo del acopio, su factura, su recibo y la deuda de mercadería" },
  "/acopios/desacopio": { seAlimentaDe: "los retiros, devoluciones y traspasos de cada acopio", alimentaA: "el PDF y el Excel que se le entregan al cliente" },
  "/cuentas-corrientes/clientes": { seAlimentaDe: "las facturas, notas de crédito, recibos y saldos iniciales", alimentaA: "el por cobrar del tablero, el límite de crédito y las alertas de vencidos" },
  "/cuentas-corrientes/proveedores": { seAlimentaDe: "las facturas de compra, los acopios con proveedores y las órdenes de pago", alimentaA: "el «le debemos» de cada proveedor y del tablero" },
  "/cuentas-corrientes/cheques": { seAlimentaDe: "los cheques recibidos en recibos", alimentaA: "las órdenes de pago a proveedores y los depósitos" },
  "/ventas/cotizaciones": { seAlimentaDe: "los precios de lista y los clientes", alimentaA: "las notas de pedido cuando el cliente acepta" },
  "/ventas/notas-pedido": { seAlimentaDe: "los clientes, los precios de lista y los acopios", alimentaA: "el pendiente de entrega, los despachos, los remitos, las facturas y el saldo de los acopios" },
  "/ventas/notas-pedido/nueva": { seAlimentaDe: "el cliente, su lista de precios, sus acopios y el disponible de cada depósito", alimentaA: "el stock reservado, los pendientes de entrega, los despachos y el saldo del acopio" },
  "/ventas/comprobantes": { seAlimentaDe: "las notas de pedido facturadas y los acopios", alimentaA: "la cuenta corriente, las ventas del tablero y los reportes" },
  "/ventas/recibos": { seAlimentaDe: "los cobros de cada cliente", alimentaA: "la cuenta corriente, la cartera de cheques y los acopios en cuenta corriente" },
  "/ventas/listas-precios": { seAlimentaDe: "el costo de cada artículo y el markup de cada lista", alimentaA: "el precio de cada venta nueva y la lista que congela cada acopio" },
  "/ventas/devoluciones": { seAlimentaDe: "las notas de pedido entregadas", alimentaA: "el stock, el saldo de los acopios y las notas de crédito" },
  "/proveedores": { seAlimentaDe: "el alta de proveedores, sus OC, recepciones y acopios", alimentaA: "las compras, la cuenta corriente con proveedores y los pendientes de retirar" },
  "/proveedores/acopios": { seAlimentaDe: "los acopios con proveedores y las OC que retiran de ellos", alimentaA: "el en tránsito del stock, la cuenta corriente con proveedores y el tablero" },
  "/proveedores/pendientes": { seAlimentaDe: "los acopios con proveedores y las OC sin recibir", alimentaA: "la planificación de compras y el en tránsito del stock" },
  "/compras/ordenes": { seAlimentaDe: "los proveedores, los artículos y el stock mínimo", alimentaA: "el stock en tránsito, las recepciones y el pendiente de cada proveedor" },
  "/compras/oc/nueva": { seAlimentaDe: "el proveedor, sus artículos y la sugerencia de reposición", alimentaA: "el stock en tránsito y, al recibir, el stock físico y la deuda" },
  "/compras/recepciones": { seAlimentaDe: "las órdenes de compra confirmadas", alimentaA: "el stock físico, el kardex, el costo de los artículos y la deuda con el proveedor" },
  "/compras/comprobantes": { seAlimentaDe: "las recepciones y los acopios con proveedores", alimentaA: "la cuenta corriente con proveedores y las órdenes de pago" },
  "/compras/ordenes-pago": { seAlimentaDe: "las facturas de compra pendientes y la cartera de cheques", alimentaA: "la cuenta corriente con proveedores y el pagado del mes" },
  "/productos": { seAlimentaDe: "el alta o la importación de artículos y los costos de cada ingreso", alimentaA: "el stock, las listas de precios, las compras, las ventas y los acopios" },
  "/stock": { seAlimentaDe: "ingresos de mercadería, remitos, transferencias y ajustes", alimentaA: "el disponible que valida cada venta, la valorización y las alertas de reposición" },
  "/stock/movimientos": { seAlimentaDe: "cada ingreso, remito hecho, transferencia y ajuste", alimentaA: "el stock físico de cada depósito y la trazabilidad de cada bolsa" },
  "/stock/transferencias": { seAlimentaDe: "el stock físico de cada depósito", alimentaA: "el stock de origen y destino y el kardex" },
  "/stock/ajustes": { seAlimentaDe: "los conteos, roturas y el inventario inicial", alimentaA: "el stock físico, el kardex y la valorización" },
  "/remitos": { seAlimentaDe: "las notas de pedido confirmadas y las devoluciones", alimentaA: "el stock físico, los entregados de cada NP, los despachos y el remito firmado" },
  "/despachos": { seAlimentaDe: "las ventas con entrega inmediata y las entregas programadas", alimentaA: "los remitos, el depósito en vivo, las hojas de ruta y los tiempos de despacho" },
  "/despachos/en-vivo": { seAlimentaDe: "los despachos del día y sus posiciones de carga", alimentaA: "el trabajo del depósito y los tiempos de preparación" },
  "/despachos/hoja-ruta": { seAlimentaDe: "los despachos a domicilio, los vehículos y los choferes", alimentaA: "la salida del camión: el stock baja y los remitos pasan a Hecho" },
  "/despachos/vehiculos": { seAlimentaDe: "el alta de vehículos y choferes", alimentaA: "las hojas de ruta y la asignación de envíos" },
  "/reportes": { seAlimentaDe: "todas las operaciones cargadas", alimentaA: "el análisis de ventas, rentabilidad, stock, acopios y cobranzas" },
  "/configuracion": { seAlimentaDe: "los datos de la empresa, sucursales, usuarios y parámetros", alimentaA: "todas las impresiones, la numeración de los documentos y los permisos" },
};

/** Busca la entrada de PAGINAS que corresponde a una ruta (la más específica). */
export function paginaDe(ruta: string): { seAlimentaDe: string; alimentaA: string } | undefined {
  const limpia = ruta.split("?")[0];
  if (PAGINAS[limpia]) return PAGINAS[limpia];
  const candidatos = Object.keys(PAGINAS).filter((k) => limpia.startsWith(k + "/") || limpia === k).sort((a, b) => b.length - a.length);
  return candidatos[0] ? PAGINAS[candidatos[0]] : undefined;
}

/** Nombres de módulos que se muestran como links dentro de los banners de página. */
export const LINKS_MODULOS: { texto: string; href: string }[] = [
  { texto: "ingresos de mercadería", href: "/compras/recepciones" },
  { texto: "remitos", href: "/remitos" },
  { texto: "transferencias", href: "/stock/transferencias" },
  { texto: "ajustes", href: "/stock/ajustes" },
  { texto: "notas de pedido", href: "/ventas/notas-pedido" },
  { texto: "acopios con proveedores", href: "/proveedores/acopios" },
  { texto: "acopios", href: "/acopios" },
  { texto: "facturas", href: "/ventas/comprobantes" },
  { texto: "recibos", href: "/ventas/recibos" },
  { texto: "despachos", href: "/despachos" },
  { texto: "stock", href: "/stock" },
  { texto: "kardex", href: "/stock/movimientos" },
  { texto: "valorización", href: "/reportes/valorizacion" },
  { texto: "alertas", href: "/alertas" },
  { texto: "tablero", href: "/tablero" },
  { texto: "cuenta corriente", href: "/cuentas-corrientes/clientes" },
  { texto: "cartera de cheques", href: "/cuentas-corrientes/cheques" },
  { texto: "órdenes de compra", href: "/compras/ordenes" },
  { texto: "órdenes de pago", href: "/compras/ordenes-pago" },
  { texto: "listas de precios", href: "/ventas/listas-precios" },
  { texto: "estado de desacopio", href: "/acopios/desacopio" },
  { texto: "hojas de ruta", href: "/despachos/hoja-ruta" },
  { texto: "pendientes de entrega", href: "/pendientes-entrega" },
];

/** Textos generales del modo (interruptor, avisos, panel). */
export const TEXTOS = {
  nombre: "Modo capacitación",
  explicacion: "Debajo de cada acción vas a ver qué cambia en el resto del sistema y, después de hacerla, los cambios reales con números.",
  activado: "Modo capacitación activado: debajo de cada acción vas a ver qué cambia en el resto del sistema",
  desactivado: "Modo capacitación desactivado",
  sinPermiso: "Solo el Dueño y Administración pueden cambiar el modo capacitación.",
  verQuePaso: "¿Qué pasó?",
  avisoTitulo: "Listo · Esto cambió:",
  avisoSinCambios: "Listo. Esta acción no cambió números en otras pantallas.",
  verDetalle: "Ver detalle",
  fijar: "Dejar fijo",
  cerrar: "Cerrar",
  porQue: "Por qué:",
  antesNecesitas: "Antes necesitás:",
  bannerAlimenta: (de: string, a: string) => {
    // Contracciones: "de el" → "del", "a el" → "al".
    const deEl = de.startsWith("el ");
    const aEl = a.startsWith("el ");
    return { antes: deEl ? "Esta pantalla se alimenta del " : "Esta pantalla se alimenta de ", de: deEl ? de.slice(3) : de, medio: aEl ? " y alimenta al " : " y alimenta a ", a: aEl ? a.slice(3) : a };
  },
  panelTitulo: "¿Qué pasó?",
  panelSubtitulo: "Todo lo que se hizo en esta sesión, con los cambios reales que produjo.",
  panelVacio: "Todavía no hiciste ninguna acción en esta sesión. Cada vez que guardes algo, acá queda qué cambió.",
  limpiar: "Limpiar",
  resumenSesion: "Hoy cargaste:",
  sinCambiosMedidos: "Sin cambios en otras pantallas.",
};

/** Cómo se nombra cada tipo creado en el resumen de la sesión (singular, plural). */
export const NOMBRES_CREADOS: Record<string, [string, string]> = {
  articulo: ["artículo", "artículos"],
  cliente: ["cliente", "clientes"],
  obra: ["obra", "obras"],
  proveedor: ["proveedor", "proveedores"],
  oc: ["OC", "OC"],
  ingreso: ["ingreso", "ingresos"],
  acopio: ["acopio", "acopios"],
  acopioProveedor: ["acopio con proveedor", "acopios con proveedores"],
  venta: ["venta", "ventas"],
  cotizacion: ["cotización", "cotizaciones"],
  remito: ["remito", "remitos"],
  factura: ["factura", "facturas"],
  cobro: ["cobro", "cobros"],
  pago: ["pago", "pagos"],
  devolucion: ["devolución", "devoluciones"],
  despacho: ["despacho", "despachos"],
  transferencia: ["transferencia", "transferencias"],
  ajuste: ["ajuste", "ajustes"],
  vehiculo: ["vehículo", "vehículos"],
  chofer: ["chofer", "choferes"],
};
