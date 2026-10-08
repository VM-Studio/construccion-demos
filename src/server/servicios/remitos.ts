/** Servicios del módulo remitos: cada función recibe el actor y corre la acción en el motor transaccional. */
import { servicio } from "./base";

export const generarRemito = servicio("generarRemito");
export const retiroEnMostrador = servicio("retiroEnMostrador");
export const iniciarPicking = servicio("iniciarPicking");
export const marcarRemitoHecho = servicio("marcarRemitoHecho");
export const anularRemito = servicio("anularRemito");
export const comentarRemito = servicio("comentarRemito");
export const registrarAdjunto = servicio("registrarAdjunto");
export const eliminarAdjuntoMeta = servicio("eliminarAdjuntoMeta");
