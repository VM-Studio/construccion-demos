import { upload } from "@vercel/blob/client";
import { nanoid } from "nanoid";
import { armarPathname, idAdjuntoDe, LARGO_CLAVE } from "../src/app/api/adjuntos/ruta-blob";
import { ejecutarAccion } from "../src/server/motor";
import { obtenerEstado } from "../src/server/estado";

const BASE = "http://localhost:3300";
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const file = new Blob([pdf], { type: "application/pdf" });
const datos = (o: object = {}) => ({ entidadTipo: "REMITO", entidadId: "rem_0001", categoria: "REMITO_FIRMADO", nombre: "Remito firmado RM2_00016-00012980.pdf", tamanoBytes: pdf.length, tipoMime: "application/pdf", ...o });

async function token(pathname: string, payload: object, cookie?: string) {
  const r = await fetch(`${BASE}/api/adjuntos/upload`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname, clientPayload: JSON.stringify(payload), multipart: false } }) });
  return `${r.status} ${(await r.text()).slice(0, 120)}`;
}

(async () => {
  const clave = nanoid(LARGO_CLAVE);
  const pathname = armarPathname("REMITO", "rem_0001", clave, datos().nombre);
  console.log("pathname", pathname);
  console.log("sin cookie:", await token(pathname, datos()));
  console.log("pathname trucho:", await token("otra/cosa.pdf", datos(), "actor-demo=usr_felipe"));
  console.log("svg:", await token(pathname, datos({ tipoMime: "image/svg+xml" }), "actor-demo=usr_felipe"));
  console.log("muy grande:", await token(pathname, datos({ tamanoBytes: 50 * 1024 * 1024 }), "actor-demo=usr_felipe"));
  console.log("entidad inexistente:", await token(armarPathname("REMITO", "rem_nada", clave, "x.pdf"), datos({ entidadId: "rem_nada" }), "actor-demo=usr_felipe"));
  const blob = await upload(pathname, file, { access: "private", handleUploadUrl: `${BASE}/api/adjuntos/upload`, clientPayload: JSON.stringify(datos()), contentType: "application/pdf", headers: { cookie: "actor-demo=usr_felipe" } });
  console.log("subido", blob.pathname, blob.url);
  const { db } = await obtenerEstado();
  const actor = db.usuarios.find((u) => u.id === "usr_felipe")!;
  const r = await ejecutarAccion({ actor }, "registrarAdjunto", [{ id: idAdjuntoDe(clave), ...(datos() as never as Record<string, never>), blobKey: blob.pathname, url: blob.url }], { accionId: "subirRemitoFirmado" });
  console.log("registrar", JSON.stringify({ ok: r.ok, data: r.ok ? r.data : r.error, tipos: r.ok ? r.tipos : undefined }));
  console.log("ID", idAdjuntoDe(clave));
})().catch((e) => { console.error(e); process.exit(1); });
