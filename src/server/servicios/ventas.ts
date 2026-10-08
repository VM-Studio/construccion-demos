/** Servicios del módulo ventas: cada función recibe el actor y corre la acción en el motor transaccional. */
import { servicio } from "./base";

export const guardarNotaPedido = servicio("guardarNotaPedido");
export const confirmarNotaPedido = servicio("confirmarNotaPedido");
export const crearNotaPedido = servicio("crearNotaPedido");
export const eliminarBorradorNP = servicio("eliminarBorradorNP");
export const anularNotaPedido = servicio("anularNotaPedido");
export const facturarNotaPedido = servicio("facturarNotaPedido");
export const registrarDevolucion = servicio("registrarDevolucion");
export const guardarCotizacion = servicio("guardarCotizacion");
export const cambiarEstadoCotizacion = servicio("cambiarEstadoCotizacion");
