/**
 * GET /api/tipo-cambio/cron — lo llama el cron de Vercel (10:35 y 16:05 hora Argentina, lunes a
 * viernes) con `Authorization: Bearer ${CRON_SECRET}`. Actualiza la cotización y purga Cambio > 7 días.
 */
import { NextResponse } from "next/server";
import { actualizarCotizacion, purgarCambios } from "@/server/servicios/tipoCambio";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const r = await actualizarCotizacion();
    const purgados = await purgarCambios(7).catch((e) => {
      console.warn("[cron] purga de Cambio", e);
      return 0;
    });
    return NextResponse.json({ ok: r.ok, fuente: r.fuente, cotizacion: r.cotizacion, errores: r.errores, purgados }, { status: r.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron tipo-cambio]", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}
