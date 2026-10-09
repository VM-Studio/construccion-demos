/**
 * GET /api/cambios?desde=<id> — cambios publicados después de `desde` (una consulta indexada por PK).
 * Lo consulta cada navegador cada 3 s para enterarse de lo que cargaron los demás usuarios.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { obtenerActorLigero } from "@/server/auth/actor";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t0 = performance.now();
  const actor = await obtenerActorLigero();
  if (!actor) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const desdeTxt = new URL(req.url).searchParams.get("desde") ?? "0";
  const desde = /^\d+$/.test(desdeTxt) ? BigInt(desdeTxt) : BigInt(0);
  // Una sola consulta: los cambios nuevos (por PK) y el último id.
  const filas = await prisma.$queryRaw<{ id: bigint | null; tipos: string[] | null; entidadIds: string[] | null; usuarioId: string | null; resumen: string | null; href: string | null; m: bigint | null }[]>`
    SELECT c."id", c."tipos", c."entidadIds", c."usuarioId", c."resumen", c."href", u.m
    FROM (SELECT MAX("id") AS m FROM "Cambio") u
    LEFT JOIN LATERAL (SELECT * FROM "Cambio" WHERE "id" > ${desde} ORDER BY "id" LIMIT 200) c ON true`;
  const ultimo = String(filas[0]?.m ?? 0);
  return NextResponse.json(
    { ultimo, cambios: filas.filter((f) => f.id !== null).map((f) => ({ id: String(f.id), tipos: f.tipos ?? [], entidadIds: f.entidadIds ?? [], usuarioId: f.usuarioId, resumen: f.resumen, href: f.href })) },
    { headers: { "Cache-Control": "no-store", "Server-Timing": `db;dur=${(performance.now() - t0).toFixed(1)}` } },
  );
}
