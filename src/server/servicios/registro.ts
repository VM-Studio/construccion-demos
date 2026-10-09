/**
 * Registro de las acciones de negocio expuestas: módulo, permiso que exige el servicio
 * (además de los que verifica cada regla del dominio), id del diccionario de impactos
 * (modo capacitación), rutas a revalidar y filas a bloquear con FOR UPDATE.
 */
import type { Permiso } from "@/domain/permisos";
import type { EstadoInicial } from "@/domain/types";
import type { AccionesNegocio, NombreAccion } from "@/store/negocio";
import type { Bloqueos } from "../motor";

export type Modulo = "catalogo" | "stock" | "compras" | "proveedores" | "clientes" | "ventas" | "acopios" | "remitos" | "despachos" | "finanzas" | "configuracion";

export interface DefinicionAccion<N extends NombreAccion> {
  modulo: Modulo;
  /** Alcanza con tener alguno. */
  permiso: Permiso | Permiso[];
  accionId?: string;
  rutas: string[];
  bloqueos?: (args: Parameters<AccionesNegocio[N]>, db: EstadoInicial) => Bloqueos;
}

type Registro = { [N in Exclude<NombreAccion, NoExpuestas>]: DefinicionAccion<N> };

/** Acciones del demo que no existen en el sistema real. */
export type NoExpuestas = "refrescarEstadosAcopios";

const npDeposito = (db: EstadoInicial, npId: string) => db.notasPedido.find((n) => n.id === npId);
const remitoDe = (db: EstadoInicial, id: string) => db.remitos.find((r) => r.id === id);
const stockDe = (productoIds: string[], depositoIds: (string | undefined)[]): Bloqueos => ({ stock: { productoIds: [...new Set(productoIds)], depositoIds: [...new Set(depositoIds.filter(Boolean) as string[])] } });

const R = {
  ventas: ["/ventas", "/pendientes-entrega", "/stock", "/tablero", "/inicio"],
  stock: ["/stock", "/productos", "/tablero"],
  compras: ["/compras", "/proveedores", "/stock", "/tablero"],
  acopios: ["/acopios", "/clientes", "/tablero"],
  remitos: ["/remitos", "/ventas", "/stock", "/despachos"],
  despachos: ["/despachos", "/remitos", "/pendientes-entrega"],
  finanzas: ["/cuentas-corrientes", "/ventas", "/compras", "/tablero"],
  catalogo: ["/productos", "/ventas/listas-precios", "/stock"],
  clientes: ["/clientes", "/cuentas-corrientes"],
  proveedores: ["/proveedores", "/cuentas-corrientes"],
  config: ["/configuracion"],
};

export const REGISTRO: Registro = {
  // ── Catálogo ──
  guardarProducto: { modulo: "catalogo", permiso: "productos.editar", accionId: "crearArticulo", rutas: R.catalogo },
  actualizarPrecio: { modulo: "catalogo", permiso: "precios.editar", accionId: "actualizarPrecio", rutas: R.catalogo },
  aplicarCambiosPrecios: { modulo: "catalogo", permiso: "precios.editar", accionId: "actualizarPreciosMasivo", rutas: R.catalogo },
  guardarLista: { modulo: "catalogo", permiso: "precios.editar", rutas: R.catalogo },
  guardarRubro: { modulo: "catalogo", permiso: "productos.editar", rutas: R.catalogo },
  importarArticulos: { modulo: "catalogo", permiso: "productos.editar", accionId: "importarArticulos", rutas: R.catalogo },
  // ── Clientes y proveedores ──
  guardarCliente: { modulo: "clientes", permiso: "clientes.editar", accionId: "crearCliente", rutas: R.clientes },
  guardarObra: { modulo: "clientes", permiso: ["ventas.editar", "clientes.editar"], accionId: "crearObra", rutas: R.clientes },
  importarClientes: { modulo: "clientes", permiso: "clientes.editar", accionId: "importarClientes", rutas: R.clientes },
  guardarProveedor: { modulo: "proveedores", permiso: "proveedores.editar", accionId: "crearProveedor", rutas: R.proveedores },
  importarProveedores: { modulo: "proveedores", permiso: "proveedores.editar", accionId: "importarProveedores", rutas: R.proveedores },
  // ── Compras ──
  guardarOC: { modulo: "compras", permiso: "compras.editar", accionId: "crearOrdenCompra", rutas: R.compras },
  cambiarEstadoOC: { modulo: "compras", permiso: ["compras.editar", "compras.confirmar"], accionId: "confirmarOrdenCompra", rutas: R.compras },
  cancelarSaldoOC: { modulo: "compras", permiso: "compras.editar", accionId: "cancelarOrdenCompra", rutas: R.compras },
  eliminarOC: { modulo: "compras", permiso: "compras.editar", accionId: "eliminarOrdenCompra", rutas: R.compras },
  recibirMercaderia: {
    modulo: "compras",
    permiso: "compras.recibir",
    accionId: "registrarRecepcion",
    rutas: R.compras,
    bloqueos: ([data], db) => stockDe((db.ordenesCompra.find((o) => o.id === data.ordenCompraId)?.items ?? []).map((i) => i.productoId), [data.depositoId]),
  },
  reclamarOC: { modulo: "compras", permiso: "compras.editar", accionId: "reclamarOC", rutas: R.compras },
  crearAcopioProveedor: { modulo: "proveedores", permiso: "acopiosProveedor.editar", accionId: "crearAcopioProveedor", rutas: R.compras },
  extenderVencimientoACP: { modulo: "proveedores", permiso: "acopiosProveedor.editar", accionId: "extenderVencimientoAcopioProveedor", rutas: R.compras },
  cancelarACP: { modulo: "proveedores", permiso: "acopiosProveedor.editar", accionId: "cancelarAcopioProveedor", rutas: R.compras },
  // ── Stock ──
  crearTransferencia: { modulo: "stock", permiso: "stock.transferir", accionId: "transferirStock", rutas: R.stock, bloqueos: ([d]) => stockDe(d.items.map((i) => i.productoId), [d.depositoOrigenId, d.depositoDestinoId]) },
  despacharTransferencia: {
    modulo: "stock",
    permiso: "stock.transferir",
    accionId: "transferirStock",
    rutas: R.stock,
    bloqueos: ([id], db) => {
      const t = db.transferencias.find((x) => x.id === id);
      return stockDe(t?.items.map((i) => i.productoId) ?? [], [t?.depositoOrigenId]);
    },
  },
  recibirTransferencia: {
    modulo: "stock",
    permiso: "stock.transferir",
    accionId: "recibirTransferencia",
    rutas: R.stock,
    bloqueos: ([id], db) => {
      const t = db.transferencias.find((x) => x.id === id);
      return stockDe(t?.items.map((i) => i.productoId) ?? [], [t?.depositoDestinoId]);
    },
  },
  cancelarTransferencia: { modulo: "stock", permiso: "stock.transferir", accionId: "cancelarTransferencia", rutas: R.stock },
  crearAjuste: { modulo: "stock", permiso: "stock.ajustar", accionId: "crearAjuste", rutas: R.stock, bloqueos: ([d]) => stockDe(d.items.map((i) => i.productoId), [d.depositoId]) },
  // ── Ventas ──
  guardarNotaPedido: { modulo: "ventas", permiso: "ventas.editar", accionId: "guardarBorradorNotaPedido", rutas: R.ventas },
  confirmarNotaPedido: {
    modulo: "ventas",
    permiso: ["ventas.editar", "ventas.confirmar"],
    accionId: "confirmarNotaPedidoNueva",
    rutas: [...R.ventas, ...R.acopios],
    bloqueos: ([id], db) => {
      const np = npDeposito(db, id);
      return { ...stockDe(np?.items.map((i) => i.productoId) ?? [], [np?.depositoId]), acopioIds: np?.acopioId ? [np.acopioId] : [] };
    },
  },
  crearNotaPedido: {
    modulo: "ventas",
    permiso: ["ventas.editar", "ventas.confirmar"],
    accionId: "confirmarNotaPedidoNueva",
    rutas: [...R.ventas, ...R.acopios],
    bloqueos: ([d]) => ({ ...stockDe(d.items.map((i) => i.productoId), [d.depositoId]), acopioIds: d.acopioId ? [d.acopioId] : [] }),
  },
  eliminarBorradorNP: { modulo: "ventas", permiso: "ventas.editar", rutas: R.ventas },
  anularNotaPedido: { modulo: "ventas", permiso: "ventas.anular", accionId: "anularNotaPedido", rutas: [...R.ventas, ...R.acopios], bloqueos: ([id], db) => ({ acopioIds: npDeposito(db, id)?.acopioId ? [npDeposito(db, id)!.acopioId!] : [] }) },
  generarRemito: { modulo: "remitos", permiso: "ventas.editar", accionId: "generarRemito", rutas: R.remitos, bloqueos: ([id], db) => stockDe(npDeposito(db, id)?.items.map((i) => i.productoId) ?? [], [npDeposito(db, id)?.depositoId]) },
  retiroEnMostrador: { modulo: "remitos", permiso: "ventas.editar", accionId: "retiroEnMostrador", rutas: R.remitos, bloqueos: ([id], db) => stockDe(npDeposito(db, id)?.items.map((i) => i.productoId) ?? [], [npDeposito(db, id)?.depositoId]) },
  facturarNotaPedido: { modulo: "ventas", permiso: "ventas.facturar", accionId: "facturarNotaPedido", rutas: [...R.ventas, ...R.finanzas] },
  registrarDevolucion: {
    modulo: "ventas",
    permiso: "ventas.editar",
    accionId: "crearDevolucion",
    rutas: [...R.ventas, ...R.acopios, ...R.remitos],
    bloqueos: ([d], db) => {
      const np = npDeposito(db, d.notaPedidoId);
      return { ...stockDe(np?.items.map((i) => i.productoId) ?? [], [np?.depositoId]), acopioIds: np?.acopioId ? [np.acopioId] : [] };
    },
  },
  guardarCotizacion: { modulo: "ventas", permiso: "ventas.editar", accionId: "crearCotizacion", rutas: R.ventas },
  cambiarEstadoCotizacion: { modulo: "ventas", permiso: "ventas.editar", accionId: "crearCotizacion", rutas: R.ventas },
  // ── Acopios ──
  crearAcopio: { modulo: "acopios", permiso: "acopios.editar", accionId: "crearAcopio", rutas: [...R.acopios, ...R.finanzas] },
  traspasarSaldo: { modulo: "acopios", permiso: "acopios.traspasar", accionId: "traspasarSaldoAcopio", rutas: R.acopios, bloqueos: ([o, d]) => ({ acopioIds: [o, d] }) },
  ajustarSaldoAcopio: { modulo: "acopios", permiso: "acopios.autorizar", accionId: "ajustarSaldoAcopio", rutas: R.acopios, bloqueos: ([id]) => ({ acopioIds: [id] }) },
  extenderVencimientoAcopio: { modulo: "acopios", permiso: "acopios.autorizar", accionId: "extenderVencimientoAcopio", rutas: R.acopios, bloqueos: ([id]) => ({ acopioIds: [id] }) },
  cancelarAcopio: { modulo: "acopios", permiso: "acopios.autorizar", accionId: "cancelarAcopio", rutas: R.acopios, bloqueos: ([id]) => ({ acopioIds: [id] }) },
  // ── Remitos y adjuntos ──
  iniciarPicking: { modulo: "remitos", permiso: "remitos.operar", accionId: "iniciarPicking", rutas: R.remitos, bloqueos: ([id], db) => stockDe(remitoDe(db, id)?.items.map((i) => i.productoId) ?? [], [remitoDe(db, id)?.depositoId]) },
  marcarRemitoHecho: { modulo: "remitos", permiso: "remitos.operar", accionId: "marcarRemitoHecho", rutas: [...R.remitos, ...R.acopios], bloqueos: ([id], db) => stockDe(remitoDe(db, id)?.items.map((i) => i.productoId) ?? [], [remitoDe(db, id)?.depositoId]) },
  anularRemito: { modulo: "remitos", permiso: "ventas.anular", accionId: "anularRemito", rutas: R.remitos },
  comentarRemito: { modulo: "remitos", permiso: "remitos.ver", accionId: "comentarRemito", rutas: R.remitos },
  registrarAdjunto: { modulo: "remitos", permiso: "remitos.ver", accionId: "subirRemitoFirmado", rutas: R.remitos },
  eliminarAdjuntoMeta: { modulo: "remitos", permiso: "remitos.ver", rutas: R.remitos },
  // ── Despachos ──
  crearDespacho: { modulo: "despachos", permiso: "ventas.editar", accionId: "programarEntrega", rutas: R.despachos },
  programarEntregas: { modulo: "despachos", permiso: "ventas.editar", accionId: "programarEntrega", rutas: R.despachos },
  iniciarPreparacion: { modulo: "despachos", permiso: "despachos.operar", accionId: "iniciarPreparacion", rutas: R.despachos },
  finalizarDespacho: { modulo: "despachos", permiso: "despachos.operar", accionId: "finalizarDespacho", rutas: [...R.despachos, ...R.stock] },
  asignarPosicion: { modulo: "despachos", permiso: "despachos.operar", accionId: "asignarPosicion", rutas: R.despachos },
  reprogramarDespacho: { modulo: "despachos", permiso: "ventas.editar", accionId: "reprogramarDespacho", rutas: R.despachos },
  cancelarDespacho: { modulo: "despachos", permiso: "despachos.operar", accionId: "cancelarDespacho", rutas: R.despachos },
  marcarEntregado: { modulo: "despachos", permiso: "despachos.operar", accionId: "marcarEntregado", rutas: R.despachos },
  asignarAHojaRuta: { modulo: "despachos", permiso: "despachos.operar", accionId: "armarHojaRuta", rutas: R.despachos },
  quitarDeHojaRuta: { modulo: "despachos", permiso: "despachos.operar", accionId: "armarHojaRuta", rutas: R.despachos },
  moverEnHojaRuta: { modulo: "despachos", permiso: "despachos.operar", accionId: "armarHojaRuta", rutas: R.despachos },
  cambiarChoferHoja: { modulo: "despachos", permiso: "despachos.operar", accionId: "armarHojaRuta", rutas: R.despachos },
  iniciarRecorrido: { modulo: "despachos", permiso: "despachos.operar", accionId: "iniciarRecorrido", rutas: [...R.despachos, ...R.stock] },
  cerrarHojaRuta: { modulo: "despachos", permiso: "despachos.operar", accionId: "cerrarHojaRuta", rutas: R.despachos },
  guardarVehiculo: { modulo: "despachos", permiso: "vehiculos.editar", accionId: "crearVehiculo", rutas: R.despachos },
  guardarChofer: { modulo: "despachos", permiso: "vehiculos.editar", accionId: "crearChofer", rutas: R.despachos },
  // ── Finanzas ──
  registrarCobranza: { modulo: "finanzas", permiso: "ctacte.cobrar", accionId: "registrarCobro", rutas: [...R.finanzas, ...R.acopios] },
  registrarPagoProveedor: { modulo: "finanzas", permiso: "ctacte.pagar", accionId: "crearOrdenPago", rutas: R.finanzas },
  cargarSaldoInicial: { modulo: "finanzas", permiso: ["ctacte.cobrar", "ctacte.pagar"], accionId: "cargarSaldoInicial", rutas: R.finanzas },
  cambiarEstadoCheque: { modulo: "finanzas", permiso: "ctacte.cobrar", accionId: "cambiarEstadoCheque", rutas: R.finanzas },
  // ── Configuración ──
  actualizarConfig: { modulo: "configuracion", permiso: "config.ver", rutas: R.config },
  actualizarEmpresa: { modulo: "configuracion", permiso: "config.ver", rutas: R.config },
  guardarSucursal: { modulo: "configuracion", permiso: "config.ver", rutas: R.config },
  guardarUsuario: { modulo: "configuracion", permiso: "config.usuarios", rutas: R.config },
  guardarUnidadNegocio: { modulo: "configuracion", permiso: "config.ver", rutas: R.config },
  establecerNumeroInicial: { modulo: "configuracion", permiso: "config.usuarios", accionId: "establecerNumeroInicial", rutas: R.config },
  guardarMotivosAjuste: { modulo: "configuracion", permiso: "config.ver", rutas: R.config },
  registrarEvento: { modulo: "configuracion", permiso: "tablero.ver", rutas: [] },
};

export type NombreExpuesto = keyof typeof REGISTRO;
export const NOMBRES_EXPUESTOS = Object.keys(REGISTRO) as NombreExpuesto[];
