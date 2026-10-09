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
import { z } from "zod";

export const dynamic = "force-dynamic";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}/).max(30);
const esquema = z.object({
  productoId: z.string().max(100).optional(),
  depositoId: z.string().max(100).optional(),
  tipo: z.string().regex(/^[A-Z_,]*$/).max(300).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
  pagina: z.coerce.number().int().min(0).max(100_000).optional(),
  tamano: z.coerce.number().int().min(1).max(5000).optional(),
});

export async function GET(req: Request) {
  const actor = await obtenerActor();
  if (!actor) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (!puede(actor, "stock.ver") && !puede(actor, "productos.ver")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const e = esquema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!e.success) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  const q = e.data;
  const where: Prisma.MovimientoStockWhereInput = {};
  if (q.productoId) where.productoId = q.productoId;
  if (q.depositoId) where.depositoId = q.depositoId;
  if (q.tipo) where.tipo = { in: q.tipo.split(",") as Prisma.EnumTipoMovimientoStockFilter["in"] };
  if (q.desde || q.hasta) where.fecha = { ...(q.desde ? { gte: new Date(q.desde) } : {}), ...(q.hasta ? { lte: new Date(q.hasta) } : {}) };
  const tamano = q.tamano ?? 5000;
  const pagina = q.pagina ?? 0;
  const [filas, total] = await Promise.all([leerColeccion(prisma, "movimientos", { where, orderBy: [{ fecha: "desc" }, { id: "desc" }], skip: pagina * tamano, take: tamano }), contarColeccion(prisma, "movimientos", where)]);
  const verCostos = puede(actor, "margenes.ver");
  return NextResponse.json({ total, pagina, tamano, filas: verCostos ? filas : filas.map(({ costoUnitario: _c, ...m }) => (void _c, m)) }, { headers: { "Cache-Control": "no-store" } });
}
