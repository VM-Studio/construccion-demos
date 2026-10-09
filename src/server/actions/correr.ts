import "server-only";
/**
 * Ejecutor común de las server actions: valida la entrada con zod, obtiene el actor de la
 * sesión y llama al servicio. Nunca devuelve mensajes internos.
 */
import type { AccionesNegocio } from "@/store/negocio";
import { ESQUEMAS } from "../esquemas";
import type { NombreExpuesto } from "../servicios/registro";
import { ErrorPermiso, servicio } from "../servicios/base";
import { datosRequest, ErrorSesion, exigirActor } from "../auth/actor";
import type { Diferencia } from "@/capacitacion/slice";
import { registrarDuracion, usuarioEnSentry } from "../monitoreo";

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
    usuarioEnSentry(actor.id);
    const req = await datosRequest();
    let fn = servicios.get(nombre);
    if (!fn) servicios.set(nombre, (fn = servicio(nombre) as ReturnType<typeof servicio>));
    const t0 = Date.now();
    const r = await (fn as (...a: unknown[]) => ReturnType<ReturnType<typeof servicio>>)({ actor, ...req }, ...(entrada.data as unknown[]));
    registrarDuracion(nombre, Date.now() - t0);
    // Sin revalidatePath: el navegador refresca solo lo que cambió (resultado propio + sincronización)
    // y así la respuesta de la acción no re-renderiza toda la página con el estado completo.
    return r as never;
  } catch (e) {
    if (e instanceof ErrorPermiso || e instanceof ErrorSesion) return { ok: false, error: e.message, codigo: e.codigo };
    console.error(`[accion] ${nombre}`, e);
    return { ok: false, error: "Ocurrió un error inesperado. Probá de nuevo.", codigo: "ERROR_SERVIDOR" };
  }
}
