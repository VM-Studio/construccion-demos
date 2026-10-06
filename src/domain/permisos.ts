import type { Rol, Usuario } from "./types";

export const PERMISOS = {
  "tablero.ver": "Ver tablero",
  "productos.ver": "Ver productos",
  "productos.editar": "Crear y editar productos",
  "precios.editar": "Editar precios y actualización masiva",
  "stock.ver": "Ver stock",
  "stock.transferir": "Transferir entre depósitos",
  "stock.ajustar": "Registrar ajustes de stock",
  "compras.ver": "Ver compras",
  "compras.editar": "Crear y editar órdenes de compra",
  "compras.confirmar": "Enviar y confirmar órdenes de compra",
  "compras.recibir": "Registrar ingreso de mercadería",
  "proveedores.editar": "Crear y editar proveedores",
  "clientes.ver": "Ver clientes",
  "proveedores.ver": "Ver proveedores",
  "ventas.ver": "Ver ventas",
  "ventas.editar": "Crear presupuestos y pedidos",
  "ventas.confirmar": "Confirmar pedidos",
  "ventas.facturar": "Facturar",
  "ventas.anular": "Anular comprobantes",
  "clientes.editar": "Crear y editar clientes",
  "acopios.ver": "Ver acopios",
  "acopios.editar": "Crear acopios y registrar retiros",
  "acopios.autorizar": "Autorizar retiro con saldo impago, extender y cancelar acopios",
  "acopios.traspasar": "Traspasar saldo de acopio",
  "acopios.preciosCongelados": "Ver precios congelados",
  "acopiosProveedor.editar": "Crear acopios con proveedores",
  "stock.forzarVenta": "Forzar venta sin disponible",
  "remitos.ver": "Ver remitos",
  "remitos.operar": "Picking, entrega y remito firmado",
  "despachos.ver": "Ver despachos",
  "despachos.operar": "Preparar, despachar y entregar",
  "vehiculos.editar": "Administrar vehículos y choferes",
  "ctacte.ver": "Ver cuentas corrientes",
  "ctacte.cobrar": "Registrar cobranzas",
  "ctacte.pagar": "Registrar pagos a proveedores",
  "reportes.ver": "Ver reportes",
  "auditoria.ver": "Ver auditoría",
  "config.ver": "Ver configuración",
  "config.usuarios": "Administrar usuarios y roles",
  "margenes.ver": "Ver costos y márgenes",
  "credito.autorizar": "Autorizar excepciones de crédito",
  "circuito2.ver": "Ver circuito 2 (AC2 · Interno)",
} as const;

export type Permiso = keyof typeof PERMISOS;

const TODOS = Object.keys(PERMISOS) as Permiso[];

export const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  DUENO: TODOS,
  ADMINISTRACION: TODOS.filter((p) => p !== "config.usuarios"),
  VENTAS: [
    "tablero.ver",
    "productos.ver",
    "clientes.ver",
    "acopios.preciosCongelados",
    "remitos.ver",
    "circuito2.ver",
    "ventas.ver",
    "ventas.editar",
    "ventas.confirmar",
    "clientes.editar",
    "acopios.ver",
    "acopios.editar",
    "despachos.ver",
    "ctacte.ver",
  ],
  DEPOSITO: [
    "tablero.ver",
    "productos.ver",
    "remitos.ver",
    "remitos.operar",
    "stock.ver",
    "stock.transferir",
    "stock.ajustar",
    "compras.ver",
    "compras.recibir",
    "despachos.ver",
    "despachos.operar",
  ],
};

/** ¿El usuario tiene el permiso? Usuarios inactivos no pueden nada. */
export function puede(usuario: Pick<Usuario, "rol" | "activo"> | null | undefined, permiso: Permiso): boolean {
  if (!usuario || !usuario.activo) return false;
  return PERMISOS_POR_ROL[usuario.rol].includes(permiso);
}

export const ROL_LABEL: Record<Rol, string> = {
  DUENO: "Dueño",
  ADMINISTRACION: "Administración",
  VENTAS: "Ventas",
  DEPOSITO: "Depósito",
};

/** Matriz informativa módulo × acción para Configuración. */
export const MATRIZ_PERMISOS: { modulo: string; acciones: Partial<Record<"ver" | "crear" | "editar" | "confirmar" | "anular" | "margenes", Permiso>> }[] = [
  { modulo: "Tablero", acciones: { ver: "tablero.ver", margenes: "margenes.ver" } },
  { modulo: "Productos y precios", acciones: { ver: "productos.ver", crear: "productos.editar", editar: "precios.editar" } },
  { modulo: "Stock", acciones: { ver: "stock.ver", crear: "stock.transferir", editar: "stock.ajustar", confirmar: "stock.forzarVenta", margenes: "margenes.ver" } },
  { modulo: "Compras", acciones: { ver: "compras.ver", crear: "compras.editar", editar: "proveedores.editar", confirmar: "compras.confirmar", anular: "compras.confirmar" } },
  { modulo: "Ingreso de mercadería", acciones: { ver: "compras.ver", crear: "compras.recibir", confirmar: "compras.recibir" } },
  { modulo: "Ventas", acciones: { ver: "ventas.ver", crear: "ventas.editar", editar: "clientes.editar", confirmar: "ventas.confirmar", anular: "ventas.anular", margenes: "margenes.ver" } },
  { modulo: "Facturación", acciones: { ver: "ventas.ver", crear: "ventas.facturar", anular: "ventas.anular" } },
  { modulo: "Clientes", acciones: { ver: "clientes.ver", crear: "clientes.editar", editar: "clientes.editar" } },
  { modulo: "Acopios de clientes", acciones: { ver: "acopios.ver", crear: "acopios.editar", editar: "acopios.traspasar", confirmar: "acopios.autorizar", anular: "acopios.autorizar", margenes: "acopios.preciosCongelados" } },
  { modulo: "Proveedores y acopios con proveedores", acciones: { ver: "proveedores.ver", crear: "acopiosProveedor.editar", editar: "proveedores.editar", confirmar: "ctacte.pagar" } },
  { modulo: "Remitos", acciones: { ver: "remitos.ver", crear: "remitos.operar", confirmar: "remitos.operar", anular: "ventas.anular" } },
  { modulo: "Logística", acciones: { ver: "despachos.ver", crear: "despachos.operar", editar: "vehiculos.editar", confirmar: "despachos.operar", anular: "despachos.operar" } },
  { modulo: "Cuentas corrientes", acciones: { ver: "ctacte.ver", crear: "ctacte.cobrar", confirmar: "ctacte.pagar" } },
  { modulo: "Reportes", acciones: { ver: "reportes.ver", margenes: "margenes.ver" } },
  { modulo: "Configuración", acciones: { ver: "config.ver", editar: "config.ver", crear: "config.usuarios" } },
];
