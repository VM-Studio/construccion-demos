/**
 * POST /api/adjuntos/upload — `handleUpload` de Vercel Blob:
 * - `blob.generate-client-token` (desde el navegador): verifica sesión, permiso sobre la entidad,
 *   tipo (fotos o PDF), tamaño máximo de Configuración y el pathname; firma el token (store privado).
 * - `blob.upload-completed` (webhook firmado de Vercel, solo en despliegues): registra la fila
 *   Adjunto si el navegador no la registró.
 */
import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { obtenerActor } from "@/server/auth/actor";
import { completarSubida, ErrorAdjunto, prepararSubida } from "@/server/servicios/adjuntos";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  try {
    const r = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const actor = await obtenerActor();
        if (!actor) throw new ErrorAdjunto(401, "Tu sesión terminó. Volvé a ingresar.");
        return prepararSubida(actor, pathname, clientPayload);
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        await completarSubida(blob, tokenPayload);
      },
    });
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof ErrorAdjunto) return NextResponse.json({ error: e.message }, { status: e.status });
    console.warn("[adjuntos] upload", e);
    return NextResponse.json({ error: "No se pudo preparar la subida." }, { status: 400 });
  }
}
