/** POST /api/tipo-cambio/actualizar — fuerza la actualización (Dueño / Administración). */
import { NextResponse } from "next/server";
import { obtenerActor } from "@/server/auth/actor";
import { actualizarCotizacion, historial, obtenerVigente } from "@/server/servicios/tipoCambio";

export const dynamic = "force-dynamic";

export async function POST() {
  const actor = await obtenerActor();
  if (!actor) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  if (actor.rol !== "DUENO" && actor.rol !== "ADMINISTRACION") return NextResponse.json({ error: "Solo Dueño o Administración pueden actualizar el tipo de cambio." }, { status: 403 });
  try {
    const r = await actualizarCotizacion();
    const [vigente, hist] = await Promise.all([obtenerVigente(), historial(30)]);
    return NextResponse.json({ ...vigente, ok: r.ok, fuenteIntento: r.fuente, errores: r.errores, historial: hist }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[api/tipo-cambio/actualizar]", e);
    return NextResponse.json({ error: "No se pudo actualizar el tipo de cambio" }, { status: 500 });
  }
}
