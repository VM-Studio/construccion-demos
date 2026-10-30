"use server";
/** Reintento manual de la factura electrónica (comprobantes que quedaron pendientes de ARCA). */
import { puede } from "@/domain/permisos";
import { exigirActor, datosRequest } from "../auth/actor";
import { obtenerEstado } from "../estado";
import { autorizarComprobantesArca } from "../servicios/facturacionArca";

export async function reintentarArca(id: string): Promise<{ ok: true; estado?: string; error?: string } | { ok: false; error: string }> {
  try {
    const actor = await exigirActor();
    if (!puede(actor, "ventas.facturar")) return { ok: false, error: "No tenés permiso para facturar." };
    if (typeof id !== "string" || !id || id.length > 100) return { ok: false, error: "Comprobante inválido." };
    await autorizarComprobantesArca({ actor, ...(await datosRequest()) }, [id]);
    const c = (await obtenerEstado()).db.comprobantes.find((x) => x.id === id);
    return { ok: true, estado: c?.arcaEstado, error: c?.arcaError };
  } catch {
    return { ok: false, error: "No se pudo contactar a ARCA. Probá de nuevo." };
  }
}
