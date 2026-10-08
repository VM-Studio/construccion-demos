/** GET /api/respaldo — exporta todos los datos de negocio en JSON (solo DUEÑO), auditado. */
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { obtenerActor } from "@/server/auth/actor";
import { leerEstado } from "@/server/datos/mapeo";
import { puede } from "@/domain/permisos";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await obtenerActor();
  if (!actor || !puede(actor, "config.usuarios")) return NextResponse.json({ error: "Solo el dueño exporta respaldos" }, { status: 403 });
  const db = await leerEstado(prisma, { paralelo: true });
  await prisma.auditoria.create({ data: { fecha: new Date(), usuarioId: actor.id, accion: "Exportó respaldo", entidad: "Sistema", entidadId: "respaldo", detalle: `${db.productos.length} artículos · ${db.clientes.length} clientes · ${db.movimientos.length} movimientos` } });
  const nombre = `respaldo-aceros-rnf-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(db), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${nombre}"`, "Cache-Control": "no-store" } });
}
