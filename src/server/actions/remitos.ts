"use server";
/** Server actions del módulo remitos (validación zod → actor de la sesión → servicio → revalidación). */
import type { AccionesNegocio } from "@/store/negocio";
import { correr } from "./correr";

export async function generarRemito(...args: Parameters<AccionesNegocio["generarRemito"]>) {
  return correr("generarRemito", args);
}

export async function retiroEnMostrador(...args: Parameters<AccionesNegocio["retiroEnMostrador"]>) {
  return correr("retiroEnMostrador", args);
}

export async function iniciarPicking(...args: Parameters<AccionesNegocio["iniciarPicking"]>) {
  return correr("iniciarPicking", args);
}

export async function marcarRemitoHecho(...args: Parameters<AccionesNegocio["marcarRemitoHecho"]>) {
  return correr("marcarRemitoHecho", args);
}

export async function anularRemito(...args: Parameters<AccionesNegocio["anularRemito"]>) {
  return correr("anularRemito", args);
}

export async function comentarRemito(...args: Parameters<AccionesNegocio["comentarRemito"]>) {
  return correr("comentarRemito", args);
}

export async function registrarAdjunto(...args: Parameters<AccionesNegocio["registrarAdjunto"]>) {
  return correr("registrarAdjunto", args);
}

export async function eliminarAdjuntoMeta(...args: Parameters<AccionesNegocio["eliminarAdjuntoMeta"]>) {
  return correr("eliminarAdjuntoMeta", args);
}
