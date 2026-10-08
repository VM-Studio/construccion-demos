/** GET /api/integridad — verificación de integridad sobre la base completa (incluye el kardex). */
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { obtenerActor } from "@/server/auth/actor";
import { leerEstado } from "@/server/datos/mapeo";
import { verificarIntegridad } from "@/domain/integridad";
import { puede } from "@/domain/permisos";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await obtenerActor();
  if (!actor || !puede(actor, "config.ver")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const db = await leerEstado(prisma, { excluir: ["auditoria"], paralelo: true });
  return NextResponse.json(verificarIntegridad(db), { headers: { "Cache-Control": "no-store" } });
}
