"use server";
/** Server actions del módulo ventas (validación zod → actor de la sesión → servicio → revalidación). */
import type { AccionesNegocio } from "@/store/negocio";
import { correr } from "./correr";

export async function guardarNotaPedido(...args: Parameters<AccionesNegocio["guardarNotaPedido"]>) {
  return correr("guardarNotaPedido", args);
}

export async function confirmarNotaPedido(...args: Parameters<AccionesNegocio["confirmarNotaPedido"]>) {
  return correr("confirmarNotaPedido", args);
}

export async function crearNotaPedido(...args: Parameters<AccionesNegocio["crearNotaPedido"]>) {
  return correr("crearNotaPedido", args);
}

export async function eliminarBorradorNP(...args: Parameters<AccionesNegocio["eliminarBorradorNP"]>) {
  return correr("eliminarBorradorNP", args);
}

export async function anularNotaPedido(...args: Parameters<AccionesNegocio["anularNotaPedido"]>) {
  return correr("anularNotaPedido", args);
}

export async function facturarNotaPedido(...args: Parameters<AccionesNegocio["facturarNotaPedido"]>) {
  return correr("facturarNotaPedido", args);
}

export async function registrarDevolucion(...args: Parameters<AccionesNegocio["registrarDevolucion"]>) {
  return correr("registrarDevolucion", args);
}

export async function guardarCotizacion(...args: Parameters<AccionesNegocio["guardarCotizacion"]>) {
  return correr("guardarCotizacion", args);
}

export async function cambiarEstadoCotizacion(...args: Parameters<AccionesNegocio["cambiarEstadoCotizacion"]>) {
  return correr("cambiarEstadoCotizacion", args);
}
