"use server";
/** Server actions del módulo proveedores (validación zod → actor de la sesión → servicio → revalidación). */
import type { AccionesNegocio } from "@/store/negocio";
import { correr } from "./correr";

export async function guardarProveedor(...args: Parameters<AccionesNegocio["guardarProveedor"]>) {
  return correr("guardarProveedor", args);
}

export async function importarProveedores(...args: Parameters<AccionesNegocio["importarProveedores"]>) {
  return correr("importarProveedores", args);
}

export async function crearAcopioProveedor(...args: Parameters<AccionesNegocio["crearAcopioProveedor"]>) {
  return correr("crearAcopioProveedor", args);
}

export async function extenderVencimientoACP(...args: Parameters<AccionesNegocio["extenderVencimientoACP"]>) {
  return correr("extenderVencimientoACP", args);
}

export async function cancelarACP(...args: Parameters<AccionesNegocio["cancelarACP"]>) {
  return correr("cancelarACP", args);
}
