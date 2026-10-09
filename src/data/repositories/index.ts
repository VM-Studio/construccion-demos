/** Repositorios de lectura sobre Prisma (solo en el servidor). */
import "server-only";
import type {
  Acopio,
  Cliente,
  Comprobante,
  Despacho,
  MovimientoStock,
  OrdenCompra,
  NotaPedido,
  Cotizacion,
  Producto,
  Proveedor,
  Usuario,
  Vehiculo,
} from "@/domain/types";
import { RepositorioPrisma, type ConsultaRepo } from "./repositorio";

export type { Repositorio, ConsultaRepo } from "./repositorio";
export { RepositorioPrisma } from "./repositorio";

export const productosRepo = new RepositorioPrisma<Producto>("productos");
export const proveedoresRepo = new RepositorioPrisma<Proveedor>("proveedores");
export const clientesRepo = new RepositorioPrisma<Cliente>("clientes");
export const ordenesCompraRepo = new RepositorioPrisma<OrdenCompra>("ordenesCompra");
export const cotizacionesRepo = new RepositorioPrisma<Cotizacion>("cotizaciones");
export const notasPedidoRepo = new RepositorioPrisma<NotaPedido>("notasPedido");
export const comprobantesRepo = new RepositorioPrisma<Comprobante>("comprobantes");
export const acopiosRepo = new RepositorioPrisma<Acopio>("acopios");
export const despachosRepo = new RepositorioPrisma<Despacho>("despachos");
export const vehiculosRepo = new RepositorioPrisma<Vehiculo>("vehiculos");
export const usuariosRepo = new RepositorioPrisma<Usuario>("usuarios");
/** Movimientos: sólo lectura (inmutables). */
export const movimientosRepo = {
  listar: (consulta?: ConsultaRepo) => new RepositorioPrisma<MovimientoStock>("movimientos").listar(consulta),
};
