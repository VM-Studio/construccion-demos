/** Servicios del módulo acopios: cada función recibe el actor y corre la acción en el motor transaccional. */
import { servicio } from "./base";

export const crearAcopio = servicio("crearAcopio");
export const traspasarSaldo = servicio("traspasarSaldo");
export const ajustarSaldoAcopio = servicio("ajustarSaldoAcopio");
export const extenderVencimientoAcopio = servicio("extenderVencimientoAcopio");
export const cancelarAcopio = servicio("cancelarAcopio");
