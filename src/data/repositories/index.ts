// Reemplazar por implementación Prisma en producción.
import type {
  Acopio,
  Cliente,
  Comprobante,
  Despacho,
  MovimientoStock,
  OrdenCompra,
  Pedido,
  Presupuesto,
  Producto,
  Proveedor,
  Usuario,
  Vehiculo,
} from "@/domain/types";
import { RepositorioMemoria } from "./repositorio";

export type { Repositorio, Filtro } from "./repositorio";
export { RepositorioMemoria } from "./repositorio";

export const productosRepo = new RepositorioMemoria<Producto>("productos", "prod");
export const proveedoresRepo = new RepositorioMemoria<Proveedor>("proveedores", "prov");
export const clientesRepo = new RepositorioMemoria<Cliente>("clientes", "cli");
export const ordenesCompraRepo = new RepositorioMemoria<OrdenCompra>("ordenesCompra", "oc");
export const presupuestosRepo = new RepositorioMemoria<Presupuesto>("presupuestos", "pre");
export const pedidosRepo = new RepositorioMemoria<Pedido>("pedidos", "ped");
export const comprobantesRepo = new RepositorioMemoria<Comprobante>("comprobantes", "cmp");
export const acopiosRepo = new RepositorioMemoria<Acopio>("acopios", "aco");
export const despachosRepo = new RepositorioMemoria<Despacho>("despachos", "des");
export const vehiculosRepo = new RepositorioMemoria<Vehiculo>("vehiculos", "veh");
export const usuariosRepo = new RepositorioMemoria<Usuario>("usuarios", "usr");
/** Movimientos: sólo lectura (inmutables). */
export const movimientosRepo = {
  listar: (filtro?: (m: MovimientoStock) => boolean) => new RepositorioMemoria<MovimientoStock>("movimientos", "mov").listar(filtro),
};
