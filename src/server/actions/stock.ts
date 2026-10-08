"use server";
/** Server actions del módulo stock (validación zod → actor de la sesión → servicio → revalidación). */
import type { AccionesNegocio } from "@/store/negocio";
import { correr } from "./correr";

export async function crearTransferencia(...args: Parameters<AccionesNegocio["crearTransferencia"]>) {
  return correr("crearTransferencia", args);
}

export async function despacharTransferencia(...args: Parameters<AccionesNegocio["despacharTransferencia"]>) {
  return correr("despacharTransferencia", args);
}

export async function recibirTransferencia(...args: Parameters<AccionesNegocio["recibirTransferencia"]>) {
  return correr("recibirTransferencia", args);
}

export async function cancelarTransferencia(...args: Parameters<AccionesNegocio["cancelarTransferencia"]>) {
  return correr("cancelarTransferencia", args);
}

export async function crearAjuste(...args: Parameters<AccionesNegocio["crearAjuste"]>) {
  return correr("crearAjuste", args);
}
