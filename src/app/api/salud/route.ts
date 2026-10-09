/**
 * GET /api/salud — chequeo público de funcionamiento (lo consulta UptimeRobot cada 5 min):
 * base de datos, último cambio publicado, almacenamiento de archivos (Vercel Blob) y última
 * cotización del dólar. No devuelve datos del negocio ni de usuarios.
 */
import { NextResponse } from "next/server";
import { BlobNotFoundError, head, put } from "@vercel/blob";
import { prisma } from "@/server/db";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";

const OBJETO_PRUEBA = "aceros-rnf/_salud/ping.txt";

const conLimite = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("tiempo agotado")), ms))]);

async function blobOk(): Promise<boolean> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  try {
    await conLimite(head(OBJETO_PRUEBA), 4000);
    return true;
  } catch (e) {
    if (!(e instanceof BlobNotFoundError)) throw e;
    // Primera vez: se crea el objeto de prueba (privado, sin datos).
    await conLimite(put(OBJETO_PRUEBA, "ok", { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "text/plain" }), 6000);
    return true;
  }
}

export async function GET() {
  const [base, blob] = await Promise.allSettled([
    conLimite(Promise.all([prisma.$queryRaw<{ m: bigint | null }[]>`SELECT MAX("id") AS m FROM "Cambio"`, prisma.cotizacionUSD.findFirst({ orderBy: { fecha: "desc" }, select: { fecha: true } })]), 5000),
    blobOk(),
  ]);
  if (base.status === "rejected") console.error("[salud] base", base.reason);
  if (blob.status === "rejected") console.error("[salud] blob", blob.reason);
  const db = base.status === "fulfilled";
  const [filas, ultima] = db ? base.value : [null, null];
  const blobBien = blob.status === "fulfilled" && blob.value;
  const version = `${pkg.version}${process.env.VERCEL_GIT_COMMIT_SHA ? `+${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : ""}`;
  const ok = db && blobBien;
  return NextResponse.json(
    { ok, db, blob: blobBien, cambiosUltimoId: filas?.[0]?.m != null ? String(filas[0].m) : db ? "0" : null, ultimaCotizacion: ultima?.fecha ? ultima.fecha.toISOString().slice(0, 10) : null, version },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
