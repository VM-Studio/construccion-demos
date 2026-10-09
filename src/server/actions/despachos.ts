"use server";
/** Server actions del módulo despachos (validación zod → actor de la sesión → servicio → revalidación). */
import type { AccionesNegocio } from "@/store/negocio";
import { correr } from "./correr";

export async function crearDespacho(...args: Parameters<AccionesNegocio["crearDespacho"]>) {
  return correr("crearDespacho", args);
}

export async function programarEntregas(...args: Parameters<AccionesNegocio["programarEntregas"]>) {
  return correr("programarEntregas", args);
}

export async function iniciarPreparacion(...args: Parameters<AccionesNegocio["iniciarPreparacion"]>) {
  return correr("iniciarPreparacion", args);
}

export async function finalizarDespacho(...args: Parameters<AccionesNegocio["finalizarDespacho"]>) {
  return correr("finalizarDespacho", args);
}

export async function asignarPosicion(...args: Parameters<AccionesNegocio["asignarPosicion"]>) {
  return correr("asignarPosicion", args);
}

export async function reprogramarDespacho(...args: Parameters<AccionesNegocio["reprogramarDespacho"]>) {
  return correr("reprogramarDespacho", args);
}

export async function cancelarDespacho(...args: Parameters<AccionesNegocio["cancelarDespacho"]>) {
  return correr("cancelarDespacho", args);
}

export async function marcarEntregado(...args: Parameters<AccionesNegocio["marcarEntregado"]>) {
  return correr("marcarEntregado", args);
}

export async function asignarAHojaRuta(...args: Parameters<AccionesNegocio["asignarAHojaRuta"]>) {
  return correr("asignarAHojaRuta", args);
}

export async function quitarDeHojaRuta(...args: Parameters<AccionesNegocio["quitarDeHojaRuta"]>) {
  return correr("quitarDeHojaRuta", args);
}

export async function moverEnHojaRuta(...args: Parameters<AccionesNegocio["moverEnHojaRuta"]>) {
  return correr("moverEnHojaRuta", args);
}

export async function cambiarChoferHoja(...args: Parameters<AccionesNegocio["cambiarChoferHoja"]>) {
  return correr("cambiarChoferHoja", args);
}

export async function iniciarRecorrido(...args: Parameters<AccionesNegocio["iniciarRecorrido"]>) {
  return correr("iniciarRecorrido", args);
}

export async function cerrarHojaRuta(...args: Parameters<AccionesNegocio["cerrarHojaRuta"]>) {
  return correr("cerrarHojaRuta", args);
}

export async function guardarVehiculo(...args: Parameters<AccionesNegocio["guardarVehiculo"]>) {
  return correr("guardarVehiculo", args);
}

export async function guardarChofer(...args: Parameters<AccionesNegocio["guardarChofer"]>) {
  return correr("guardarChofer", args);
}
