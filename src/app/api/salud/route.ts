/**
 * GET /api/salud — chequeo público de funcionamiento: base de datos y última cotización del dólar.
 * No devuelve datos del negocio ni de usuarios.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  let ultimaCotizacion: string | null = null;
  try {
    const [, ultima] = await Promise.all([prisma.$queryRaw`SELECT 1`, prisma.cotizacionUSD.findFirst({ orderBy: { fecha: "desc" }, select: { fecha: true } })]);
    db = true;
    ultimaCotizacion = ultima?.fecha ? ultima.fecha.toISOString().slice(0, 10) : null;
  } catch (e) {
    console.error("[salud]", e);
  }
  const version = `${pkg.version}${process.env.VERCEL_GIT_COMMIT_SHA ? `+${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : ""}`;
  return NextResponse.json({ ok: db, db, ultimaCotizacion, version }, { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
