"use server";
/** Server actions del módulo acopios (validación zod → actor de la sesión → servicio → revalidación). */
import type { AccionesNegocio } from "@/store/negocio";
import { correr } from "./correr";

export async function crearAcopio(...args: Parameters<AccionesNegocio["crearAcopio"]>) {
  return correr("crearAcopio", args);
}

export async function traspasarSaldo(...args: Parameters<AccionesNegocio["traspasarSaldo"]>) {
  return correr("traspasarSaldo", args);
}

export async function ajustarSaldoAcopio(...args: Parameters<AccionesNegocio["ajustarSaldoAcopio"]>) {
  return correr("ajustarSaldoAcopio", args);
}

export async function extenderVencimientoAcopio(...args: Parameters<AccionesNegocio["extenderVencimientoAcopio"]>) {
  return correr("extenderVencimientoAcopio", args);
}

export async function cancelarAcopio(...args: Parameters<AccionesNegocio["cancelarAcopio"]>) {
  return correr("cancelarAcopio", args);
}
