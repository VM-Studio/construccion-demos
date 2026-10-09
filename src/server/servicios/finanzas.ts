/** Servicios del módulo finanzas: cada función recibe el actor y corre la acción en el motor transaccional. */
import { servicio } from "./base";

export const registrarCobranza = servicio("registrarCobranza");
export const registrarPagoProveedor = servicio("registrarPagoProveedor");
export const cargarSaldoInicial = servicio("cargarSaldoInicial");
export const cambiarEstadoCheque = servicio("cambiarEstadoCheque");
