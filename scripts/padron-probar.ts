/**
 * Prueba manual de la consulta del padrón (la misma que usa el formulario).
 *   pnpm padron:probar -- 30500010912 20123456786 [--forzar]
 * Usa ARCA si ARCA_CERT/ARCA_KEY están en el entorno; si no, la fuente pública. Caché en la base de `.env.local`.
 */
import fs from "node:fs";
import path from "node:path";

const env = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(env)) for (const l of fs.readFileSync(env, "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }

async function main() {
  const { consultarPadron, estadoPadron } = await import("../src/server/servicios/padron");
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const forzar = args.includes("--forzar");
  console.log("Estado:", JSON.stringify(estadoPadron()));
  for (const cuit of args.filter((a) => !a.startsWith("--"))) {
    const t0 = Date.now();
    const d = await consultarPadron(cuit, { forzar });
    console.log(`\n${cuit} (${Date.now() - t0} ms):`, d ? JSON.stringify(d, null, 2) : "sin datos (completar a mano)");
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
