"use client";

import { useStore } from "@/store";
import { useUsuario } from "@/store/selectors";
import { puedeCambiarModo } from "./slice";

/**
 * Interruptor único del modo capacitación. Para apagarlo en todo el sistema basta con
 * cambiar el default en `CAPACITACION_INICIAL.modo` (slice.ts) a `false`.
 */
export function useModoCapacitacion(): boolean {
  return useStore((s) => s.capacitacion.modo && s.hidratado);
}

/** Lectura fuera de React (medir, toasts). */
export function modoCapacitacionActivo(): boolean {
  const s = useStore.getState();
  return s.capacitacion.modo && s.hidratado;
}

export function usePuedeCambiarModo(): boolean {
  return puedeCambiarModo(useUsuario());
}
