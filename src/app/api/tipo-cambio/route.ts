/**
 * GET /api/tipo-cambio — tipo de cambio vigente + historial de 30 días (público).
 * GET /api/tipo-cambio?fecha=YYYY-MM-DD — cotización aplicable a esa fecha (reportes de períodos pasados).
 */
import { NextResponse } from "next/server";
import { historial, obtenerParaFecha, obtenerVigente } from "@/server/servicios/tipoCambio";

export const dynamic = "force-dynamic";

const CACHE = { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" };

export async function GET(req: Request) {
  try {
    const fecha = new URL(req.url).searchParams.get("fecha");
    if (fecha) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return NextResponse.json({ error: "Fecha inválida (YYYY-MM-DD)" }, { status: 400 });
      return NextResponse.json({ fecha, cotizacion: await obtenerParaFecha(fecha) }, { headers: CACHE });
    }
    const [vigente, hist] = await Promise.all([obtenerVigente(), historial(30)]);
    return NextResponse.json({ ...vigente, historial: hist }, { headers: CACHE });
  } catch (e) {
    console.error("[api/tipo-cambio]", e);
    return NextResponse.json({ error: "No se pudo leer el tipo de cambio" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
