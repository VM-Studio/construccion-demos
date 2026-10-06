import { BarChart3, Boxes, ClipboardList, History, Landmark, PackageX, Percent, ShieldCheck, ShoppingCart, Truck, Users, Warehouse, type LucideIcon } from "lucide-react";
import type { Permiso } from "@/domain/permisos";

export const REPORTES: { slug: string; titulo: string; descripcion: string; icono: LucideIcon; permiso: Permiso; destacado?: boolean }[] = [
  { slug: "ventas", titulo: "Ventas", descripcion: "Por día, semana, mes, sucursal, vendedor, rubro, cliente o lista, con margen y Δ vs período anterior.", icono: BarChart3, permiso: "reportes.ver" },
  { slug: "rentabilidad-pedidos", titulo: "Rentabilidad por pedido", descripcion: "Margen con costo al vender y “si vendieras hoy”: el efecto de la inflación.", icono: Percent, permiso: "margenes.ver", destacado: true },
  { slug: "rentabilidad-productos", titulo: "Rentabilidad por producto", descripcion: "Margen, rotación y días de stock: qué conviene empujar.", icono: ClipboardList, permiso: "margenes.ver" },
  { slug: "rentabilidad-clientes", titulo: "Rentabilidad por cliente", descripcion: "Facturación, margen, ticket y Pareto de concentración.", icono: Users, permiso: "margenes.ver" },
  { slug: "valorizacion", titulo: "Valorización de inventario", descripcion: "Stock por depósito y rubro a costo promedio, último y precio de venta.", icono: Warehouse, permiso: "margenes.ver", destacado: true },
  { slug: "deuda-mercaderia", titulo: "Deuda de mercadería", descripcion: "Saldos de acopio a precio pactado, a costo actual y exposición.", icono: Boxes, permiso: "acopios.ver", destacado: true },
  { slug: "compras", titulo: "Compras", descripcion: "Por proveedor: emitido, recibido, cumplimiento de plazo y evolución de costos.", icono: ShoppingCart, permiso: "compras.editar" },
  { slug: "stock-critico", titulo: "Stock crítico y reposición", descripcion: "Bajo mínimo, cobertura en días y OC borrador sugerida por proveedor.", icono: PackageX, permiso: "stock.ver" },
  { slug: "cobranzas", titulo: "Cobranzas y antigüedad", descripcion: "Cobrado por medio y por día, antigüedad por cliente y días de cobro.", icono: Landmark, permiso: "ctacte.ver" },
  { slug: "despachos", titulo: "Despachos", descripcion: "Entregas por día y vehículo, puntualidad, reprogramaciones y kilos.", icono: Truck, permiso: "despachos.ver" },
  { slug: "movimientos", titulo: "Movimientos de stock", descripcion: "Kardex exportable con todos los filtros y totales por tipo.", icono: History, permiso: "stock.ver" },
  { slug: "auditoria", titulo: "Auditoría", descripcion: "Quién hizo qué y cuándo, filtrable por usuario, entidad y acción.", icono: ShieldCheck, permiso: "auditoria.ver" },
];

