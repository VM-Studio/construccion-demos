/** Servicios del módulo proveedores: cada función recibe el actor y corre la acción en el motor transaccional. */
import { servicio } from "./base";

export const guardarProveedor = servicio("guardarProveedor");
export const importarProveedores = servicio("importarProveedores");
export const crearAcopioProveedor = servicio("crearAcopioProveedor");
export const extenderVencimientoACP = servicio("extenderVencimientoACP");
export const cancelarACP = servicio("cancelarACP");
