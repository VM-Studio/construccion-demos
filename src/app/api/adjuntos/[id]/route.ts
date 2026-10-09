/**
 * /api/adjuntos/[id]
 * - GET: sirve el archivo del blob privado (stream) si el actor puede ver la entidad.
 *   `?descargar=1` → `Content-Disposition: attachment`. Los enlaces web redirigen.
 * - DELETE: borra la fila (acción de negocio, auditada) y el blob. Devuelve el resultado del motor.
 */
import { NextResponse } from "next/server";
import { datosRequest, obtenerActor } from "@/server/auth/actor";
import { borrarAdjunto, ErrorAdjunto, servirAdjunto } from "@/server/servicios/adjuntos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const sinSesion = () => NextResponse.json({ ok: false, error: "Tu sesión terminó. Volvé a ingresar.", codigo: "SESION" }, { status: 401 });

function errorRespuesta(e: unknown, accion: string) {
  if (e instanceof ErrorAdjunto) return NextResponse.json({ ok: false, error: e.message, codigo: e.status === 403 ? "PERMISO" : undefined }, { status: e.status });
  console.error(`[adjuntos] ${accion}`, e);
  return NextResponse.json({ ok: false, error: "Ocurrió un error inesperado. Probá de nuevo.", codigo: "ERROR_SERVIDOR" }, { status: 500 });
}

export async function GET(request: Request, { params }: Params) {
  const actor = await obtenerActor();
  if (!actor) return sinSesion();
  const { id } = await params;
  const descargar = new URL(request.url).searchParams.get("descargar") === "1";
  try {
    return await servirAdjunto(actor, id, descargar);
  } catch (e) {
    return errorRespuesta(e, "get");
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const actor = await obtenerActor();
  if (!actor) return sinSesion();
  const { id } = await params;
  try {
    const r = await borrarAdjunto({ actor, ...(await datosRequest()) }, id);
    return NextResponse.json(r, { status: r.ok ? 200 : r.codigo === "PERMISO" ? 403 : 400 });
  } catch (e) {
    return errorRespuesta(e, "delete");
  }
}
