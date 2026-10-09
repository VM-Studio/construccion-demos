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
import { z } from "zod";

export const dynamic = "force-dynamic";

const esquema = z.object({
  entidadId: z.string().max(20_000).optional(),
  usuarioId: z.string().max(100).optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}/).max(30).optional(),
  conEfectos: z.enum(["0", "1"]).optional(),
  pagina: z.coerce.number().int().min(0).max(100_000).optional(),
  tamano: z.coerce.number().int().min(1).max(2000).optional(),
});

export async function GET(req: Request) {
  const actor = await obtenerActor();
  if (!actor) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const e = esquema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!e.success) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  const q = e.data;
  const where: Prisma.AuditoriaWhereInput = {};
  if (q.entidadId) where.entidadId = { in: q.entidadId.split(",").slice(0, 200) };
  if (q.usuarioId) where.usuarioId = q.usuarioId;
  if (q.desde) where.fecha = { gte: new Date(q.desde) };
  if (q.conEfectos === "1") where.efectos = { not: Prisma.DbNull };
  // La auditoría completa es para quien tiene el permiso; el resto ve solo la de una entidad o lo
  // suyo, y nunca la de usuarios y accesos (ingresos, bloqueos, contraseñas).
  if (!puede(actor, "auditoria.ver")) {
    if (!where.entidadId && q.conEfectos !== "1") where.usuarioId = actor.id;
    where.entidad = { not: "Usuario" };
  }
  const tamano = q.tamano ?? 500;
  const pagina = q.pagina ?? 0;
  const [filas, total] = await Promise.all([leerColeccion(prisma, "auditoria", { where, orderBy: [{ fecha: "desc" }, { id: "desc" }], skip: pagina * tamano, take: tamano }), contarColeccion(prisma, "auditoria", where)]);
  return NextResponse.json({ total, pagina, tamano, filas: filas.map((a) => ({ ...a, ip: undefined, userAgent: undefined })) }, { headers: { "Cache-Control": "no-store" } });
}
