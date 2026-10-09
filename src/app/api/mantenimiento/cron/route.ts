/**
 * GET /api/mantenimiento/cron — cron diario de Vercel (06:00 UTC) con `Authorization: Bearer ${CRON_SECRET}`.
 * Purga las filas de Cambio de más de 7 días (la sincronización solo mira las recientes) y la
 * auditoría de ingresos fallidos de más de 90 días.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { purgarCambios } from "@/server/servicios/tipoCambio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ACCIONES_LOGIN_FALLIDO = ["Ingreso fallido", "Ingreso rechazado: usuario bloqueado", "Ingreso rechazado: usuario desactivado", "Usuario bloqueado por intentos fallidos"];

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const cambios = await purgarCambios(7);
    const { count: auditoria } = await prisma.auditoria.deleteMany({ where: { accion: { in: ACCIONES_LOGIN_FALLIDO }, fecha: { lt: new Date(Date.now() - 90 * 86_400_000) } } });
    console.info(`[mantenimiento] purgados: ${cambios} cambios, ${auditoria} ingresos fallidos`);
    return NextResponse.json({ ok: true, cambios, auditoria }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[mantenimiento]", e);
    return NextResponse.json({ ok: false, error: "Error en el mantenimiento" }, { status: 500 });
  }
}
