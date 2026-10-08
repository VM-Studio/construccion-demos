/**
 * GET /api/cambios?desde=<id> — cambios publicados después de `desde` (una consulta indexada por PK).
 * Lo consulta cada navegador cada 3 s para enterarse de lo que cargaron los demás usuarios.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { obtenerActor } from "@/server/auth/actor";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t0 = performance.now();
  const actor = await obtenerActor();
  if (!actor) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const desdeTxt = new URL(req.url).searchParams.get("desde") ?? "0";
  const desde = /^\d+$/.test(desdeTxt) ? BigInt(desdeTxt) : BigInt(0);
  const [filas, max] = await Promise.all([
    prisma.$queryRaw<{ id: bigint; tipos: string[]; entidadIds: string[]; usuarioId: string | null; resumen: string | null; href: string | null }[]>`SELECT "id", "tipos", "entidadIds", "usuarioId", "resumen", "href" FROM "Cambio" WHERE "id" > ${desde} ORDER BY "id" LIMIT 200`,
    prisma.$queryRaw<{ m: bigint | null }[]>`SELECT MAX("id") AS m FROM "Cambio"`,
  ]);
  const ultimo = String(max[0]?.m ?? 0);
  return NextResponse.json(
    { ultimo, cambios: filas.map((f) => ({ id: String(f.id), tipos: f.tipos, entidadIds: f.entidadIds, usuarioId: f.usuarioId, resumen: f.resumen, href: f.href })) },
    { headers: { "Cache-Control": "no-store", "Server-Timing": `db;dur=${(performance.now() - t0).toFixed(1)}` } },
  );
}
