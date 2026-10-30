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

export async function crearVenta(...args: Parameters<AccionesNegocio["crearVenta"]>) {
  return correr("crearVenta", args);
}

export async function anularVenta(...args: Parameters<AccionesNegocio["anularVenta"]>) {
  return correr("anularVenta", args);
}

export async function recuperarVenta(...args: Parameters<AccionesNegocio["recuperarVenta"]>) {
  return correr("recuperarVenta", args);
}

export async function anularFactura(...args: Parameters<AccionesNegocio["anularFactura"]>) {
  return correr("anularFactura", args);
}

export async function aceptarCotizacion(...args: Parameters<AccionesNegocio["aceptarCotizacion"]>) {
  return correr("aceptarCotizacion", args);
}

export async function rechazarCotizacion(...args: Parameters<AccionesNegocio["rechazarCotizacion"]>) {
  return correr("rechazarCotizacion", args);
}

export async function recuperarCotizacion(...args: Parameters<AccionesNegocio["recuperarCotizacion"]>) {
  return correr("recuperarCotizacion", args);
}

export async function eliminarCotizacion(...args: Parameters<AccionesNegocio["eliminarCotizacion"]>) {
  return correr("eliminarCotizacion", args);
}
