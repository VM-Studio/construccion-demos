"use server";
/** Server actions del módulo catalogo (validación zod → actor de la sesión → servicio → revalidación). */
import type { AccionesNegocio } from "@/store/negocio";
import { correr } from "./correr";

export async function guardarProducto(...args: Parameters<AccionesNegocio["guardarProducto"]>) {
  return correr("guardarProducto", args);
}

export async function actualizarPrecio(...args: Parameters<AccionesNegocio["actualizarPrecio"]>) {
  return correr("actualizarPrecio", args);
}

export async function aplicarCambiosPrecios(...args: Parameters<AccionesNegocio["aplicarCambiosPrecios"]>) {
  return correr("aplicarCambiosPrecios", args);
}

export async function guardarLista(...args: Parameters<AccionesNegocio["guardarLista"]>) {
  return correr("guardarLista", args);
}

export async function guardarRubro(...args: Parameters<AccionesNegocio["guardarRubro"]>) {
  return correr("guardarRubro", args);
}

export async function importarArticulos(...args: Parameters<AccionesNegocio["importarArticulos"]>) {
  return correr("importarArticulos", args);
}
