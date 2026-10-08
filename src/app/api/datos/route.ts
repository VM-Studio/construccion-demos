/**
 * GET /api/datos?c=productos,stock — colecciones de negocio visibles para el actor (filtradas por
 * rol en el servidor). Es lo que mantiene sincronizado el cliente; la versión permite detectar cambios.
 */
import { NextResponse } from "next/server";
import { obtenerActor } from "@/server/auth/actor";
import { COLECCIONES_CLIENTE, estadoPara, seleccionar, type ColeccionCliente } from "@/server/lectura";

export const dynamic = "force-dynamic";

const VALIDAS = new Set<string>([...COLECCIONES_CLIENTE, "config", "numeradores"]);

export async function GET(req: Request) {
  const actor = await obtenerActor();
  if (!actor) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const pedidas = (new URL(req.url).searchParams.get("c") ?? "").split(",").filter((c) => VALIDAS.has(c)) as ColeccionCliente[];
  const { version, db } = await estadoPara(actor);
  return NextResponse.json({ version: String(version), datos: seleccionar(db, pedidas.length ? pedidas : [...COLECCIONES_CLIENTE, "config", "numeradores"]) }, { headers: { "Cache-Control": "no-store" } });
}
