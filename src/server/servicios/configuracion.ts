/** Servicios del módulo configuracion: cada función recibe el actor y corre la acción en el motor transaccional. */
import { servicio } from "./base";

export const actualizarConfig = servicio("actualizarConfig");
export const actualizarEmpresa = servicio("actualizarEmpresa");
export const guardarSucursal = servicio("guardarSucursal");
export const guardarUsuario = servicio("guardarUsuario");
export const guardarUnidadNegocio = servicio("guardarUnidadNegocio");
export const establecerNumeroInicial = servicio("establecerNumeroInicial");
export const guardarMotivosAjuste = servicio("guardarMotivosAjuste");
export const registrarEvento = servicio("registrarEvento");

