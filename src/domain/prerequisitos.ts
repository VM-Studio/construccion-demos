import type { EstadoInicial } from "./types";

/**
 * Prerrequisitos de cada pantalla: qué tiene que existir en el sistema para poder hacer
 * la primera operación. Con el sistema vacío, los estados vacíos y la guía de carga
 * inicial los usan para decir qué falta y dónde se carga.
 */

export type ClavePrerequisito =
  | "articulo"
  | "articuloConPrecio"
  | "articuloConStock"
  | "cliente"
  | "clienteConObra"
  | "proveedor"
  | "listaConPrecios"
  | "ventaConfirmada"
  | "acopio"
  | "vehiculo";

export interface Prerequisito {
  clave: ClavePrerequisito;
  /** Cómo se nombra en una frase: "un cliente", "un artículo con precio". */
  nombre: string;
  /** Texto del botón que lo resuelve. */
  accion: string;
  href: string;
}

interface Definicion extends Omit<Prerequisito, "clave"> {
  cumple: (db: EstadoInicial) => boolean;
}

const conPrecio = (db: EstadoInicial) => {
  const activos = new Set(db.productos.filter((p) => p.activo).map((p) => p.id));
  return db.precios.some((p) => p.precio > 0 && activos.has(p.productoId));
};

export const PRERREQUISITOS: Record<ClavePrerequisito, Definicion> = {
  articulo: { nombre: "un artículo", accion: "Crear artículo", href: "/productos?nuevo=1", cumple: (db) => db.productos.some((p) => p.activo) },
  articuloConPrecio: { nombre: "un artículo con precio", accion: "Crear artículo", href: "/productos?nuevo=1", cumple: conPrecio },
  articuloConStock: { nombre: "stock en algún depósito", accion: "Cargar inventario inicial", href: "/stock/ajustes?nuevo=1&motivo=INVENTARIO_INICIAL", cumple: (db) => db.stock.some((s) => s.cantidadFisica > 0) },
  cliente: { nombre: "un cliente", accion: "Crear cliente", href: "/clientes?nuevo=1", cumple: (db) => db.clientes.some((c) => c.activo) },
  clienteConObra: {
    nombre: "un cliente con al menos una obra",
    accion: "Crear cliente y obra",
    href: "/clientes?nuevo=1",
    cumple: (db) => db.obras.some((o) => o.activa && db.clientes.some((c) => c.id === o.clienteId && c.activo)),
  },
  proveedor: { nombre: "un proveedor", accion: "Crear proveedor", href: "/proveedores?nuevo=1", cumple: (db) => db.proveedores.some((p) => p.activo) },
  listaConPrecios: { nombre: "una lista de precios con precios cargados", accion: "Cargar precios", href: "/ventas/listas-precios", cumple: conPrecio },
  ventaConfirmada: {
    nombre: "una venta confirmada",
    accion: "Nueva nota de pedido",
    href: "/ventas/notas-pedido/nueva",
    cumple: (db) => db.notasPedido.some((n) => n.estado !== "BORRADOR" && n.estado !== "ANULADA"),
  },
  acopio: { nombre: "un acopio", accion: "Nuevo acopio", href: "/acopios/nuevo", cumple: (db) => db.acopios.length > 0 },
  vehiculo: { nombre: "un vehículo", accion: "Cargar vehículo", href: "/despachos/vehiculos", cumple: (db) => db.vehiculos.some((v) => v.activo) },
};

/** Prerrequisitos que necesita la acción principal de cada pantalla. */
export const REQUISITOS_PAGINA = {
  notasPedido: ["articuloConPrecio", "cliente"],
  cotizaciones: ["articuloConPrecio", "cliente"],
  ordenesCompra: ["proveedor", "articulo"],
  recepciones: ["proveedor", "articulo"],
  acopios: ["clienteConObra", "listaConPrecios"],
  acopiosProveedor: ["proveedor", "articulo"],
  desacopio: ["acopio"],
  stock: ["articulo"],
  transferencias: ["articuloConStock"],
  ajustes: ["articulo"],
  remitos: ["ventaConfirmada"],
  despachos: ["ventaConfirmada"],
  pendientesEntrega: ["ventaConfirmada"],
  hojaRuta: ["vehiculo"],
  cuentasClientes: ["cliente"],
  cuentasProveedores: ["proveedor"],
  recibos: ["cliente"],
  comprobantes: ["ventaConfirmada"],
  devoluciones: ["ventaConfirmada"],
  obras: ["cliente"],
  listasPrecios: ["articulo"],
  productos: [],
  clientes: [],
  proveedores: [],
} satisfies Record<string, ClavePrerequisito[]>;

export type PaginaConRequisitos = keyof typeof REQUISITOS_PAGINA;

/** Prerrequisitos (de la lista) que todavía no se cumplen. */
export function faltantes(claves: readonly ClavePrerequisito[], db: EstadoInicial): Prerequisito[] {
  return claves.filter((c) => !PRERREQUISITOS[c].cumple(db)).map((clave) => ({ clave, nombre: PRERREQUISITOS[clave].nombre, accion: PRERREQUISITOS[clave].accion, href: PRERREQUISITOS[clave].href }));
}

/** Qué falta cargar para poder operar en una pantalla (vacío = está todo). */
export function prerequisitos(pagina: PaginaConRequisitos, db: EstadoInicial): Prerequisito[] {
  return faltantes(REQUISITOS_PAGINA[pagina], db);
}

/** "un cliente, un artículo con precio y un proveedor" */
export function enumerarFaltantes(lista: Prerequisito[]): string {
  const n = lista.map((p) => p.nombre);
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} y ${n.at(-1)}`;
}

/** true si el estado no tiene datos maestros ni operativos (solo la estructura de la empresa). */
export function estaVacio(db: EstadoInicial): boolean {
  return (
    !db.productos.length &&
    !db.clientes.length &&
    !db.proveedores.length &&
    !db.movimientos.length &&
    !db.notasPedido.length &&
    !db.acopios.length &&
    !db.comprobantes.length &&
    !db.ordenesCompra.length &&
    !db.cobranzas.length
  );
}
