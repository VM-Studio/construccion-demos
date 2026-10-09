/**
 * GET /api/respaldo — respaldo completo para descargar (solo DUEÑO): ZIP con un CSV por tabla y
 * un JSON con todo, generado con streaming. Queda en la auditoría.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { datosRequest, obtenerActor } from "@/server/auth/actor";
import { puede } from "@/domain/permisos";
import { streamRespaldo } from "@/server/respaldo/exportar";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const actor = await obtenerActor();
  if (!actor || !puede(actor, "config.usuarios")) return NextResponse.json({ error: "Solo el dueño exporta respaldos" }, { status: 403 });
  const req = await datosRequest();
  const fecha = new Date().toISOString().slice(0, 10);
  const stream = streamRespaldo(async (conteo) => {
    const total = Object.values(conteo).reduce((s, n) => s + n, 0);
    await prisma.auditoria.create({ data: { fecha: new Date(), usuarioId: actor.id, accion: "Exportó respaldo", entidad: "Sistema", entidadId: "respaldo", detalle: `ZIP con ${Object.keys(conteo).length} tablas · ${total} filas`, ip: req.ip ?? null, userAgent: req.userAgent?.slice(0, 300) ?? null } });
  });
  return new NextResponse(stream, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="respaldo-aceros-rnf-${fecha}.zip"`, "Cache-Control": "no-store" } });
}
