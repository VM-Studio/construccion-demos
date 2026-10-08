"use server";
/** Server actions del módulo configuracion (validación zod → actor de la sesión → servicio → revalidación). */
import type { AccionesNegocio } from "@/store/negocio";
import { correr } from "./correr";

export async function actualizarConfig(...args: Parameters<AccionesNegocio["actualizarConfig"]>) {
  return correr("actualizarConfig", args);
}

export async function actualizarEmpresa(...args: Parameters<AccionesNegocio["actualizarEmpresa"]>) {
  return correr("actualizarEmpresa", args);
}

export async function guardarSucursal(...args: Parameters<AccionesNegocio["guardarSucursal"]>) {
  return correr("guardarSucursal", args);
}

export async function guardarUsuario(...args: Parameters<AccionesNegocio["guardarUsuario"]>) {
  return correr("guardarUsuario", args);
}

export async function guardarUnidadNegocio(...args: Parameters<AccionesNegocio["guardarUnidadNegocio"]>) {
  return correr("guardarUnidadNegocio", args);
}

export async function establecerNumeroInicial(...args: Parameters<AccionesNegocio["establecerNumeroInicial"]>) {
  return correr("establecerNumeroInicial", args);
}

export async function guardarMotivosAjuste(...args: Parameters<AccionesNegocio["guardarMotivosAjuste"]>) {
  return correr("guardarMotivosAjuste", args);
}

export async function registrarEvento(...args: Parameters<AccionesNegocio["registrarEvento"]>) {
  return correr("registrarEvento", args);
}
