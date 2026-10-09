"use server";
/** Server actions del módulo finanzas (validación zod → actor de la sesión → servicio → revalidación). */
import type { AccionesNegocio } from "@/store/negocio";
import { correr } from "./correr";

export async function registrarCobranza(...args: Parameters<AccionesNegocio["registrarCobranza"]>) {
  return correr("registrarCobranza", args);
}

export async function registrarPagoProveedor(...args: Parameters<AccionesNegocio["registrarPagoProveedor"]>) {
  return correr("registrarPagoProveedor", args);
}

export async function cargarSaldoInicial(...args: Parameters<AccionesNegocio["cargarSaldoInicial"]>) {
  return correr("cargarSaldoInicial", args);
}

export async function cambiarEstadoCheque(...args: Parameters<AccionesNegocio["cambiarEstadoCheque"]>) {
  return correr("cambiarEstadoCheque", args);
}
