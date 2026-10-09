import "server-only";
/**
 * Ejecutor común de las server actions: valida la entrada con zod, obtiene el actor de la
 * sesión, llama al servicio y revalida las rutas afectadas. Nunca devuelve mensajes internos.
 */
import { revalidatePath } from "next/cache";
import type { AccionesNegocio } from "@/store/negocio";
import { ESQUEMAS } from "../esquemas";
import { REGISTRO, type NombreExpuesto } from "../servicios/registro";
import { ErrorPermiso, servicio } from "../servicios/base";
import { datosRequest, ErrorSesion, exigirActor } from "../auth/actor";
import type { Diferencia } from "@/capacitacion/slice";

export type RespuestaAccion<T = unknown> = { ok: true; data: T; efectos: Diferencia[]; tipos: string[] } | { ok: false; error: string; codigo?: string };

const servicios = new Map<string, ReturnType<typeof servicio>>();

export async function correr<N extends NombreExpuesto>(nombre: N, args: unknown[]): Promise<RespuestaAccion<ReturnType<AccionesNegocio[N]> extends { ok: true; data: infer D } | { ok: false } ? D : unknown>> {
  try {
    const entrada = ESQUEMAS[nombre].safeParse(args);
    if (!entrada.success) {
      console.warn(`[accion] ${nombre}: entrada inválida`, entrada.error.issues.slice(0, 3));
      return { ok: false, error: "Los datos enviados no son válidos.", codigo: "ENTRADA" };
    }
    const actor = await exigirActor();
    const req = await datosRequest();
    let fn = servicios.get(nombre);
    if (!fn) servicios.set(nombre, (fn = servicio(nombre) as ReturnType<typeof servicio>));
    const t0 = Date.now();
    const r = await (fn as (...a: unknown[]) => ReturnType<ReturnType<typeof servicio>>)({ actor, ...req }, ...(entrada.data as unknown[]));
    const ms = Date.now() - t0;
    if (ms > 2000) console.warn(`[accion] ${nombre} tardó ${ms} ms`);
    if (r.ok) for (const ruta of REGISTRO[nombre].rutas) revalidatePath(ruta, "layout");
    return r as never;
  } catch (e) {
    if (e instanceof ErrorPermiso || e instanceof ErrorSesion) return { ok: false, error: e.message, codigo: e.codigo };
    console.error(`[accion] ${nombre}`, e);
    return { ok: false, error: "Ocurrió un error inesperado. Probá de nuevo.", codigo: "ERROR_SERVIDOR" };
  }
}
