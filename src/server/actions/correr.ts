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
import { after } from "next/server";
import { autorizarComprobantesArca } from "../servicios/facturacionArca";
import { deltaPara } from "../lectura";
import type { Delta } from "@/lib/sincronizacion/delta";

/** `delta`: las filas que cambió la acción, ya filtradas por rol (el navegador no vuelve a pedirlas). */
export type RespuestaAccion<T = unknown> = { ok: true; data: T; efectos: Diferencia[]; tipos: string[]; delta?: Delta } | { ok: false; error: string; codigo?: string };

/** Acciones que pueden emitir facturas o notas de crédito fiscales (las demás no disparan ARCA). */
const EMITEN_COMPROBANTES = new Set<string>(["crearVenta", "aceptarCotizacion", "facturarNotaPedido", "anularVenta", "anularFactura", "crearAcopio", "registrarDevolucion"]);

const servicios = new Map<string, ReturnType<typeof servicio>>();

export async function correr<N extends NombreExpuesto>(nombre: N, args: unknown[]): Promise<RespuestaAccion<ReturnType<AccionesNegocio[N]> extends { ok: true; data: infer D } | { ok: false } ? D : unknown>> {
  try {
    const entrada = ESQUEMAS[nombre].safeParse(args);
    if (!entrada.success) {
      console.warn(`[accion] ${nombre}: entrada inválida`, entrada.error.issues.slice(0, 3));
      return { ok: false, error: "Los datos enviados no son válidos.", codigo: "ENTRADA" };
    }
    const tActor = Date.now();
    const actor = await exigirActor();
    const msActor = Date.now() - tActor;
    usuarioEnSentry(actor.id);
    const req = await datosRequest();
    let fn = servicios.get(nombre);
    if (!fn) servicios.set(nombre, (fn = servicio(nombre) as ReturnType<typeof servicio>));
    const t0 = Date.now();
    const r = await (fn as (...a: unknown[]) => ReturnType<ReturnType<typeof servicio>>)({ actor, ...req }, ...(entrada.data as unknown[]));
    registrarDuracion(nombre, Date.now() - t0, msActor);
    // Sin revalidatePath: la respuesta trae solo las filas que cambiaron (delta) y el navegador las
    // aplica sin un segundo viaje al servidor; así tampoco se re-renderiza la página entera.
    // Factura electrónica: los comprobantes fiscales nuevos se mandan a ARCA sin hacer esperar al usuario.
    const comprobantes = r.ok && EMITEN_COMPROBANTES.has(nombre) ? r.cambiados?.comprobantes : undefined;
    if (comprobantes?.length) after(() => autorizarComprobantesArca({ actor, ...req }, comprobantes));
    if (r.ok && r.cambiados) {
      const { cambiados, ...resto } = r;
      const ids = new Map(Object.entries(cambiados).map(([c, xs]) => [c, new Set(xs)] as const));
      const delta = await deltaPara(actor, ids, r.tipos.includes("Configuracion"), r.tipos.includes("Contador")).catch((e) => {
        console.warn(`[accion] ${nombre}: no se pudo armar el delta`, e);
        return undefined;
      });
      return { ...resto, delta } as never;
    }
    return r as never;
  } catch (e) {
    if (e instanceof ErrorPermiso || e instanceof ErrorSesion) return { ok: false, error: e.message, codigo: e.codigo };
    console.error(`[accion] ${nombre}`, e);
    return { ok: false, error: "Ocurrió un error inesperado. Probá de nuevo.", codigo: "ERROR_SERVIDOR" };
  }
}
