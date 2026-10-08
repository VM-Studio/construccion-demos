/**
 * GET /api/auditoria — auditoría paginada (?entidadId, usuarioId, desde, conEfectos=1, pagina, tamano).
 * El panel "¿Qué pasó?" la lee con efectos para mostrar lo que hicieron todos los usuarios.
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { obtenerActor } from "@/server/auth/actor";
import { leerColeccion, contarColeccion } from "@/server/datos/mapeo";
import { puede } from "@/domain/permisos";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await obtenerActor();
  if (!actor) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const where: Prisma.AuditoriaWhereInput = {};
  if (q.get("entidadId")) where.entidadId = { in: q.get("entidadId")!.split(",").slice(0, 200) };
  if (q.get("usuarioId")) where.usuarioId = q.get("usuarioId")!;
  if (q.get("desde")) where.fecha = { gte: new Date(q.get("desde")!) };
  if (q.get("conEfectos") === "1") where.efectos = { not: Prisma.DbNull };
  // La auditoría completa es para quien tiene el permiso; el resto ve solo la de una entidad o lo suyo.
  if (!puede(actor, "auditoria.ver") && !where.entidadId && q.get("conEfectos") !== "1") where.usuarioId = actor.id;
  const tamano = Math.min(2000, Math.max(1, Number(q.get("tamano")) || 500));
  const pagina = Math.max(0, Number(q.get("pagina")) || 0);
  const [filas, total] = await Promise.all([leerColeccion(prisma, "auditoria", { where, orderBy: [{ fecha: "desc" }, { id: "desc" }], skip: pagina * tamano, take: tamano }), contarColeccion(prisma, "auditoria", where)]);
  return NextResponse.json({ total, pagina, tamano, filas: filas.map((a) => ({ ...a, ip: undefined, userAgent: undefined })) }, { headers: { "Cache-Control": "no-store" } });
}
