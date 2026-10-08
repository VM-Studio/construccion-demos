"use server";
/** Server actions del módulo clientes (validación zod → actor de la sesión → servicio → revalidación). */
import type { AccionesNegocio } from "@/store/negocio";
import { correr } from "./correr";

export async function guardarCliente(...args: Parameters<AccionesNegocio["guardarCliente"]>) {
  return correr("guardarCliente", args);
}

export async function guardarObra(...args: Parameters<AccionesNegocio["guardarObra"]>) {
  return correr("guardarObra", args);
}

export async function importarClientes(...args: Parameters<AccionesNegocio["importarClientes"]>) {
  return correr("importarClientes", args);
}
