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

export async function anularCobranza(...args: Parameters<AccionesNegocio["anularCobranza"]>) {
  return correr("anularCobranza", args);
}

export async function anularPagoProveedor(...args: Parameters<AccionesNegocio["anularPagoProveedor"]>) {
  return correr("anularPagoProveedor", args);
}

export async function aplicarSaldoAFavor(...args: Parameters<AccionesNegocio["aplicarSaldoAFavor"]>) {
  return correr("aplicarSaldoAFavor", args);
}

export async function guardarCaja(...args: Parameters<AccionesNegocio["guardarCaja"]>) {
  return correr("guardarCaja", args);
}

export async function registrarMovimientoCaja(...args: Parameters<AccionesNegocio["registrarMovimientoCaja"]>) {
  return correr("registrarMovimientoCaja", args);
}

export async function transferirEntreCajas(...args: Parameters<AccionesNegocio["transferirEntreCajas"]>) {
  return correr("transferirEntreCajas", args);
}

export async function anularMovimientoCaja(...args: Parameters<AccionesNegocio["anularMovimientoCaja"]>) {
  return correr("anularMovimientoCaja", args);
}

export async function registrarArqueo(...args: Parameters<AccionesNegocio["registrarArqueo"]>) {
  return correr("registrarArqueo", args);
}
