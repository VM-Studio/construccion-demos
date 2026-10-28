/**
 * GET /api/cambios?desde=<id> — cambios publicados después de `desde` (una consulta indexada por PK).
 * Lo consulta cada navegador cada 3 s para enterarse de lo que cargaron los demás usuarios.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { obtenerActorLigero } from "@/server/auth/actor";
import { COLECCIONES_CLIENTE, deltaPara, estadoPara, seleccionar, type ColeccionCliente } from "@/server/lectura";
import type { Delta } from "@/lib/sincronizacion/delta";
import { coleccionesDe } from "@/lib/sincronizacion/dependencias";
import type { Usuario } from "@/domain/types";

const DEL_CLIENTE = new Set<string>([...COLECCIONES_CLIENTE, "config", "numeradores"]);

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
  const cambios = filas.filter((f) => f.id !== null).map((f) => ({ id: String(f.id), tipos: f.tipos ?? [], entidadIds: f.entidadIds ?? [], usuarioId: f.usuarioId, resumen: f.resumen, href: f.href }));
  const params = new URL(req.url).searchParams;
  // Con ?delta=1 y cambios nuevos, en la misma respuesta van SOLO las filas que cambiaron (ya
  // filtradas por rol). Si un cambio no trae la lista completa de ids (más de 100 filas), esa
  // colección viaja entera. ?datos=1 (navegadores con la versión anterior) manda colecciones enteras.
  let datos: Record<string, unknown> | undefined;
  let delta: Delta | undefined;
  if (desde > BigInt(0) && cambios.length && params.get("delta") === "1") {
    const ids = new Map<string, Set<string> | "todas">();
    for (const c of cambios) {
      const sinIds = !c.entidadIds.length || c.entidadIds.length >= 100;
      for (const col of coleccionesDe(c.tipos)) {
        if (!DEL_CLIENTE.has(col) || col === "config" || col === "numeradores") continue;
        const previo = ids.get(col);
        if (previo === "todas") continue;
        if (sinIds) ids.set(col, "todas");
        else {
          const set = previo ?? new Set<string>();
          for (const id of c.entidadIds) set.add(id);
          ids.set(col, set);
        }
      }
    }
    const tipos = new Set(cambios.flatMap((c) => c.tipos));
    delta = await deltaPara(actor as Usuario, ids, tipos.has("Configuracion"), tipos.has("Contador"));
  } else if (desde > BigInt(0) && cambios.length && params.get("datos") === "1") {
    const cols = coleccionesDe(cambios.flatMap((c) => c.tipos)).filter((c) => DEL_CLIENTE.has(c)) as ColeccionCliente[];
    if (cols.length) datos = seleccionar((await estadoPara(actor as Usuario)).db, cols);
  }
  return NextResponse.json(
    { ultimo, cambios: cambios.map((c) => ({ id: c.id, tipos: c.tipos, usuarioId: c.usuarioId, resumen: c.resumen, href: c.href })), ...(datos ? { datos } : {}), ...(delta ? { delta } : {}) },
    { headers: { "Cache-Control": "no-store", "Server-Timing": `db;dur=${(performance.now() - t0).toFixed(1)}` } },
  );
}
