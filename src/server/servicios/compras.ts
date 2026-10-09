/** Servicios del módulo compras: cada función recibe el actor y corre la acción en el motor transaccional. */
import { servicio } from "./base";

export const guardarOC = servicio("guardarOC");
export const cambiarEstadoOC = servicio("cambiarEstadoOC");
export const cancelarSaldoOC = servicio("cancelarSaldoOC");
export const eliminarOC = servicio("eliminarOC");
export const recibirMercaderia = servicio("recibirMercaderia");
export const reclamarOC = servicio("reclamarOC");
