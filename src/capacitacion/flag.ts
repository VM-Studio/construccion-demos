"use client";

import { useUsuario } from "@/store/selectors";
import { puedeCambiarModo } from "./slice";

/**
 * Modo capacitación: retirado a pedido de los dueños (2026-10-28, ya conocen el sistema).
 * Los componentes de `@/capacitacion` quedan como no-op; los efectos se siguen midiendo en el
 * servidor para la auditoría (Reportes → Últimas modificaciones).
 */
export function useModoCapacitacion(): boolean {
  return false;
}

/** Lectura fuera de React (medir, toasts). */
export function modoCapacitacionActivo(): boolean {
  return false;
}

export function usePuedeCambiarModo(): boolean {
  return puedeCambiarModo(useUsuario());
}
