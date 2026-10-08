"use client";

/**
 * Cliente del modo capacitación: los cambios reales los mide el servidor dentro de la
 * transacción (`efectos` en el resultado de cada acción); acá solo se registran y se muestran.
 */
import { newId } from "@/lib/utils";
import { useStore } from "@/store";
import { modoCapacitacionActivo } from "./flag";
import type { Diferencia, Medicion } from "./slice";
import { mostrarAvisoCambios } from "./AvisoCambios";
import type { Contexto } from "./efectos";

export type { Contexto } from "./efectos";

const esResultadoFallido = (r: unknown) => !!r && typeof r === "object" && "ok" in (r as object) && (r as { ok: boolean }).ok === false;

/**
 * Envuelve una acción que escribe en el servidor: con el modo capacitación activo muestra los
 * cambios reales que devolvió el servidor ("Esto cambió"); con el modo apagado solo ejecuta `fn()`.
 */
export async function medir<T>(accionId: string, _contexto: Contexto, fn: () => T | Promise<T>): Promise<T> {
  const r = await fn();
  if (!modoCapacitacionActivo() || esResultadoFallido(r)) return r;
  const diferencias = ((r as { efectos?: Diferencia[] } | undefined)?.efectos ?? []) as Diferencia[];
  const st = useStore.getState();
  const m: Medicion = { id: newId("med"), fecha: new Date().toISOString(), usuarioId: st.ui.usuarioId ?? "", accionId, diferencias };
  st.registrarMedicion(m);
  mostrarAvisoCambios(m);
  return r;
}
