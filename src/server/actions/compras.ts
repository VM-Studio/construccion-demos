"use server";
/** Server actions del módulo compras (validación zod → actor de la sesión → servicio → revalidación). */
import type { AccionesNegocio } from "@/store/negocio";
import { correr } from "./correr";

export async function guardarOC(...args: Parameters<AccionesNegocio["guardarOC"]>) {
  return correr("guardarOC", args);
}

export async function cambiarEstadoOC(...args: Parameters<AccionesNegocio["cambiarEstadoOC"]>) {
  return correr("cambiarEstadoOC", args);
}

export async function cancelarSaldoOC(...args: Parameters<AccionesNegocio["cancelarSaldoOC"]>) {
  return correr("cancelarSaldoOC", args);
}

export async function eliminarOC(...args: Parameters<AccionesNegocio["eliminarOC"]>) {
  return correr("eliminarOC", args);
}

export async function recibirMercaderia(...args: Parameters<AccionesNegocio["recibirMercaderia"]>) {
  return correr("recibirMercaderia", args);
}

export async function reclamarOC(...args: Parameters<AccionesNegocio["reclamarOC"]>) {
  return correr("reclamarOC", args);
}
