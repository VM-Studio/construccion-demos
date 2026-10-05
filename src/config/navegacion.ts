import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Landmark,
  LayoutDashboard,
  Package,
  PackageCheck,
  Settings,
  ShoppingCart,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { Permiso } from "@/domain/permisos";

export interface ItemNav {
  href: string;
  label: string;
  icono: LucideIcon;
  permiso: Permiso;
}

export const NAVEGACION: { grupo: string; items: ItemNav[] }[] = [
  { grupo: "General", items: [{ href: "/tablero", label: "Tablero", icono: LayoutDashboard, permiso: "tablero.ver" }] },
  {
    grupo: "Operación",
    items: [
      { href: "/productos", label: "Productos", icono: Package, permiso: "productos.ver" },
      { href: "/stock", label: "Stock", icono: Warehouse, permiso: "stock.ver" },
      { href: "/compras", label: "Compras", icono: ShoppingCart, permiso: "compras.ver" },
      { href: "/ventas", label: "Ventas", icono: ArrowLeftRight, permiso: "ventas.ver" },
      { href: "/acopios", label: "Acopios", icono: Boxes, permiso: "acopios.ver" },
      { href: "/despachos", label: "Despachos", icono: Truck, permiso: "despachos.ver" },
    ],
  },
  {
    grupo: "Administración",
    items: [
      { href: "/cuentas-corrientes", label: "Cuentas corrientes", icono: Landmark, permiso: "ctacte.ver" },
      { href: "/reportes", label: "Reportes", icono: BarChart3, permiso: "reportes.ver" },
    ],
  },
  { grupo: "Sistema", items: [{ href: "/configuracion", label: "Configuración", icono: Settings, permiso: "config.ver" }] },
];

/** Etiquetas de segmentos de URL para el breadcrumb. */
export const SEGMENTOS: Record<string, string> = {
  tablero: "Tablero",
  productos: "Productos",
  stock: "Stock",
  compras: "Compras",
  oc: "Órdenes de compra",
  ventas: "Ventas",
  pedidos: "Pedidos",
  presupuestos: "Presupuestos",
  acopios: "Acopios",
  despachos: "Despachos",
  "cuentas-corrientes": "Cuentas corrientes",
  clientes: "Clientes",
  proveedores: "Proveedores",
  reportes: "Reportes",
  configuracion: "Configuración",
  nuevo: "Nuevo",
  nueva: "Nueva",
};

export const ICONO_RECEPCION = PackageCheck;
