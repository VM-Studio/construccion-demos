import { BarChart3, Boxes, Factory, FileText, LayoutDashboard, PackagePlus, Settings, ShoppingCart, Truck, Users, type LucideIcon } from "lucide-react";
import type { Permiso } from "@/domain/permisos";
import { REPORTES } from "@/components/modulos/reportes/catalogo";

export interface PaginaModulo {
  id: string;
  nombre: string;
  href: string;
  permiso: Permiso;
}

export interface Modulo {
  id: string;
  nombre: string;
  icono: LucideIcon;
  descripcion: string;
  paginas: PaginaModulo[];
}

const p = (id: string, nombre: string, href: string, permiso: Permiso): PaginaModulo => ({ id, nombre, href, permiso });

/** Definición única de módulos y sus páginas (launcher de /inicio, barra lateral, buscador y breadcrumb). */
export const MODULOS: Modulo[] = [
  {
    id: "general",
    nombre: "General",
    icono: LayoutDashboard,
    descripcion: "Resumen del negocio y lo que requiere atención",
    paginas: [p("tablero", "Tablero", "/tablero", "tablero.ver"), p("alertas", "Alertas", "/alertas", "tablero.ver"), p("pendientes-entrega", "Pendientes de entrega", "/pendientes-entrega", "ventas.ver")],
  },
  {
    id: "clientes",
    nombre: "Clientes",
    icono: Users,
    descripcion: "Clientes, obras, acopios y cuentas corrientes",
    paginas: [
      p("clientes", "Clientes", "/clientes", "clientes.ver"),
      p("obras", "Obras", "/clientes/obras", "clientes.ver"),
      p("acopios", "Acopios de clientes", "/acopios", "acopios.ver"),
      p("desacopio", "Estado de desacopio", "/acopios/desacopio", "acopios.ver"),
      p("cc-clientes", "Cuentas corrientes", "/cuentas-corrientes/clientes", "ctacte.ver"),
      p("pend-clientes", "Pendientes de entrega", "/pendientes-entrega?tipo=clientes", "ventas.ver"),
    ],
  },
  {
    id: "ventas",
    nombre: "Ventas",
    icono: ShoppingCart,
    descripcion: "Cotizaciones, notas de pedido, comprobantes y cobros",
    paginas: [
      p("cotizaciones", "Cotizaciones de venta", "/ventas/cotizaciones", "ventas.ver"),
      p("notas-pedido", "Notas de pedido", "/ventas/notas-pedido", "ventas.ver"),
      p("comprobantes", "Comprobantes de venta", "/ventas/comprobantes", "ventas.ver"),
      p("remitos-venta", "Remitos de venta", "/remitos?tipo=venta", "remitos.ver"),
      p("recibos", "Recibos (entrada de fondos)", "/ventas/recibos", "ctacte.ver"),
      p("listas-precios", "Listas de precios", "/ventas/listas-precios", "productos.ver"),
      p("devoluciones", "Devoluciones", "/ventas/devoluciones", "ventas.ver"),
      p("cheques", "Cartera de cheques", "/cuentas-corrientes/cheques", "ctacte.ver"),
    ],
  },
  {
    id: "proveedores",
    nombre: "Proveedores",
    icono: Factory,
    descripcion: "Lo que les debemos y lo que nos falta retirar",
    paginas: [
      p("proveedores", "Proveedores", "/proveedores", "proveedores.ver"),
      p("acopios-proveedores", "Acopios con proveedores", "/proveedores/acopios", "proveedores.ver"),
      p("cc-proveedores", "Cuentas corrientes", "/cuentas-corrientes/proveedores", "ctacte.pagar"),
      p("pendientes-retirar", "Pendientes de retirar", "/proveedores/pendientes", "proveedores.ver"),
    ],
  },
  {
    id: "compras",
    nombre: "Compras",
    icono: PackagePlus,
    descripcion: "Órdenes de compra, ingresos y pagos",
    paginas: [
      p("ordenes", "Órdenes de compra", "/compras/ordenes", "compras.ver"),
      p("recepciones", "Ingreso de mercadería", "/compras/recepciones", "compras.ver"),
      p("comprobantes-compra", "Comprobantes de compra", "/compras/comprobantes", "compras.editar"),
      p("ordenes-pago", "Órdenes de pago (salida de fondos)", "/compras/ordenes-pago", "ctacte.pagar"),
    ],
  },
  {
    id: "stock",
    nombre: "Stock",
    icono: Boxes,
    descripcion: "Artículos, disponibilidad y movimientos",
    paginas: [
      p("articulos", "Artículos", "/productos", "productos.ver"),
      p("listado-stock", "Listado de stock", "/stock", "stock.ver"),
      p("movimientos", "Movimientos de stock", "/stock/movimientos", "stock.ver"),
      p("transferencias", "Transferencias", "/stock/transferencias", "stock.ver"),
      p("ajustes", "Ajustes e inventarios", "/stock/ajustes", "stock.ver"),
    ],
  },
  {
    id: "remitos",
    nombre: "Remitos",
    icono: FileText,
    descripcion: "Picking, entregas y remitos firmados",
    paginas: [
      p("todos", "Todos los remitos", "/remitos", "remitos.ver"),
      p("venta", "Remitos de venta", "/remitos?tipo=venta", "remitos.ver"),
      p("desacopio", "Remitos de desacopio", "/remitos?tipo=desacopio", "remitos.ver"),
      p("devolucion", "Remitos de devolución", "/remitos?tipo=devolucion", "remitos.ver"),
      p("firmados", "Remitos firmados", "/remitos?firmados=1", "remitos.ver"),
    ],
  },
  {
    id: "logistica",
    nombre: "Logística",
    icono: Truck,
    descripcion: "Despachos con tiempos, hoja de ruta y flota",
    paginas: [
      p("despachos", "Despachos", "/despachos", "despachos.ver"),
      p("en-vivo", "Depósito en vivo", "/despachos/en-vivo", "despachos.ver"),
      p("hoja-ruta", "Hoja de ruta", "/despachos/hoja-ruta", "despachos.ver"),
      p("vehiculos", "Vehículos y choferes", "/despachos/vehiculos", "despachos.ver"),
    ],
  },
  {
    id: "reportes",
    nombre: "Reportes",
    icono: BarChart3,
    descripcion: "Ventas, rentabilidad, acopios, stock y más",
    paginas: [p("todos-reportes", "Todos los reportes", "/reportes", "reportes.ver"), ...REPORTES.map((r) => p(`rep-${r.slug}`, r.titulo, `/reportes/${r.slug}`, r.permiso))],
  },
  {
    id: "configuracion",
    nombre: "Configuración",
    icono: Settings,
    descripcion: "Empresa, sucursales, usuarios y datos del demo",
    paginas: [
      p("empresa", "Empresa", "/configuracion?tab=empresa", "config.ver"),
      p("sucursales", "Sucursales y depósitos", "/configuracion?tab=sucursales", "config.ver"),
      p("unidades", "Unidades de negocio", "/configuracion?tab=unidades", "config.ver"),
      p("usuarios", "Usuarios y roles", "/configuracion?tab=usuarios", "config.ver"),
      p("parametros", "Parámetros", "/configuracion?tab=parametros", "config.ver"),
      p("numeracion", "Numeración", "/configuracion?tab=numeracion", "config.ver"),
      p("demo", "Datos del demo", "/configuracion?tab=demo", "config.ver"),
    ],
  },
];

const separar = (href: string) => {
  const [path, q = ""] = href.split("?");
  return { path, params: new URLSearchParams(q) };
};

/** ¿La página coincide con la ruta actual? 2 = exacta (path + query), 1 = por prefijo de path, 0 = no. */
export function coincidencia(pag: PaginaModulo, pathname: string, search: URLSearchParams): number {
  const { path, params } = separar(pag.href);
  const queryOk = [...params.entries()].every(([k, v]) => search.get(k) === v);
  if (pathname === path) {
    if (!params.size) return search.size ? 1.5 : 2;
    return queryOk ? 3 : 0;
  }
  if (path !== "/" && pathname.startsWith(path + "/") && !params.size) return 1 + path.length / 1000;
  return 0;
}

/** Página activa dentro de un módulo. */
export function paginaActiva(modulo: Modulo, pathname: string, search: URLSearchParams): PaginaModulo | undefined {
  let mejor: PaginaModulo | undefined;
  let puntaje = 0;
  for (const pag of modulo.paginas) {
    const c = coincidencia(pag, pathname, search);
    if (c > puntaje) {
      puntaje = c;
      mejor = pag;
    }
  }
  return mejor;
}

/** Módulo activo para la ruta. Si varias coinciden, se prefiere el último módulo elegido por el usuario. */
export function moduloDeRuta(pathname: string, search: URLSearchParams = new URLSearchParams(), preferido?: string | null): Modulo | undefined {
  const candidatos = MODULOS.map((m) => ({ m, c: Math.max(0, ...m.paginas.map((pg) => coincidencia(pg, pathname, search))) })).filter((x) => x.c > 0);
  if (!candidatos.length) return undefined;
  const pref = candidatos.find((x) => x.m.id === preferido);
  if (pref) return pref.m;
  return candidatos.sort((a, b) => b.c - a.c)[0].m;
}

export function moduloPorId(id: string) {
  return MODULOS.find((m) => m.id === id);
}
