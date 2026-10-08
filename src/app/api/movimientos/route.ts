/**
 * GET /api/movimientos — kardex paginado y filtrado en el servidor
 * (?productoId, depositoId, tipo, desde, hasta, pagina, tamano). Insert-only: no hay escritura acá.
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { obtenerActor } from "@/server/auth/actor";
import { leerColeccion, contarColeccion } from "@/server/datos/mapeo";
import { puede } from "@/domain/permisos";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await obtenerActor();
  if (!actor) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!puede(actor, "stock.ver") && !puede(actor, "productos.ver")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const q = new URL(req.url).searchParams;
  const where: Prisma.MovimientoStockWhereInput = {};
  if (q.get("productoId")) where.productoId = q.get("productoId")!;
  if (q.get("depositoId")) where.depositoId = q.get("depositoId")!;
  if (q.get("tipo")) where.tipo = { in: q.get("tipo")!.split(",") as Prisma.EnumTipoMovimientoStockFilter["in"] };
  if (q.get("desde") || q.get("hasta")) where.fecha = { ...(q.get("desde") ? { gte: new Date(q.get("desde")!) } : {}), ...(q.get("hasta") ? { lte: new Date(q.get("hasta")!) } : {}) };
  const tamano = Math.min(5000, Math.max(1, Number(q.get("tamano")) || 5000));
  const pagina = Math.max(0, Number(q.get("pagina")) || 0);
  const [filas, total] = await Promise.all([leerColeccion(prisma, "movimientos", { where, orderBy: [{ fecha: "desc" }, { id: "desc" }], skip: pagina * tamano, take: tamano }), contarColeccion(prisma, "movimientos", where)]);
  const verCostos = puede(actor, "margenes.ver");
  return NextResponse.json({ total, pagina, tamano, filas: verCostos ? filas : filas.map((m) => ({ ...m, costoUnitario: 0 })) }, { headers: { "Cache-Control": "no-store" } });
}
