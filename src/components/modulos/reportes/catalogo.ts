import { BarChart3, Boxes, Factory, FileWarning, PackageCheck, Timer, ClipboardList, History, Landmark, PackageX, Percent, ShieldCheck, ShoppingCart, Truck, Users, Warehouse, type LucideIcon } from "lucide-react";
import type { Permiso } from "@/domain/permisos";

export const REPORTES: { slug: string; titulo: string; descripcion: string; icono: LucideIcon; permiso: Permiso; destacado?: boolean }[] = [
  { slug: "ventas", titulo: "Ventas", descripcion: "Por día, semana, mes, sucursal, vendedor, rubro, cliente o lista, con margen y Δ vs período anterior.", icono: BarChart3, permiso: "reportes.ver" },
  { slug: "rentabilidad-pedidos", titulo: "Rentabilidad por pedido", descripcion: "Margen con costo al vender y “si vendieras hoy”: el efecto de la inflación.", icono: Percent, permiso: "margenes.ver", destacado: true },
  { slug: "rentabilidad-productos", titulo: "Rentabilidad por producto", descripcion: "Margen, rotación y días de stock: qué conviene empujar.", icono: ClipboardList, permiso: "margenes.ver" },
  { slug: "rentabilidad-clientes", titulo: "Rentabilidad por cliente", descripcion: "Facturación, margen, ticket y Pareto de concentración.", icono: Users, permiso: "margenes.ver" },
  { slug: "valorizacion", titulo: "Valorización de inventario", descripcion: "Stock por depósito y rubro a costo promedio, último y precio de venta.", icono: Warehouse, permiso: "margenes.ver", destacado: true },
  { slug: "deuda-mercaderia", titulo: "Acopios de clientes", descripcion: "Saldo disponible, pendiente de entrega y exposición por suba de precios, por cliente y obra.", icono: Boxes, permiso: "acopios.ver", destacado: true },
  { slug: "pendientes-entrega", titulo: "Pendientes de entrega", descripcion: "Por cliente, artículo o antigüedad, con el $ comprometido.", icono: PackageCheck, permiso: "ventas.ver", destacado: true },
  { slug: "acopios-proveedores", titulo: "Acopios con proveedores", descripcion: "Saldo, pendiente de retirar, deuda y ahorro por costo congelado.", icono: Factory, permiso: "proveedores.ver" },
  { slug: "tiempos-despacho", titulo: "Tiempos de despacho", descripcion: "Espera, preparación y total por día, depósito, posición y operario.", icono: Timer, permiso: "despachos.ver" },
  { slug: "remitos-pendientes", titulo: "Remitos sin firmar y sin facturar", descripcion: "Entregas que falta cerrar en papel o facturar.", icono: FileWarning, permiso: "remitos.ver" },
  { slug: "compras", titulo: "Compras", descripcion: "Por proveedor: emitido, recibido, cumplimiento de plazo y evolución de costos.", icono: ShoppingCart, permiso: "compras.editar" },
  { slug: "stock-critico", titulo: "Stock crítico y reposición", descripcion: "Bajo mínimo, cobertura en días y OC borrador sugerida por proveedor.", icono: PackageX, permiso: "stock.ver" },
  { slug: "cobranzas", titulo: "Cobranzas y antigüedad", descripcion: "Cobrado por medio y por día, antigüedad por cliente y días de cobro.", icono: Landmark, permiso: "ctacte.ver" },
  { slug: "despachos", titulo: "Despachos", descripcion: "Entregas por día y vehículo, puntualidad, reprogramaciones y kilos.", icono: Truck, permiso: "despachos.ver" },
  { slug: "movimientos", titulo: "Movimientos de stock", descripcion: "Kardex exportable con todos los filtros y totales por tipo.", icono: History, permiso: "stock.ver" },
  { slug: "auditoria", titulo: "Auditoría", descripcion: "Quién hizo qué y cuándo, filtrable por usuario, entidad y acción.", icono: ShieldCheck, permiso: "auditoria.ver" },
];

