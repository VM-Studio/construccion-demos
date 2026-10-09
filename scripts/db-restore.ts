/**
 * Restaura un backup de Cloudflare R2 en una base vacía (o la pisa: --clean --if-exists).
 *
 *   pnpm db:restore aceros-rnf-2026-10-09.dump.gz            # descarga de R2 y restaura
 *   pnpm db:restore ./backup-local.dump.gz                     # archivo local
 *   pnpm db:restore -- --listar                                # lista los backups de R2
 *
 * Variables (en `.env.local` o en el entorno, nunca en el repo):
 *   DATABASE_URL_RESTORE  base destino (ej. el branch `test` de Neon, conexión directa sin pooler)
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY   credenciales del bucket aceros-rnf-backups
 * Requiere `rclone` y `pg_restore` 18+ (brew install rclone postgresql@18).
 * Contra producción se niega salvo con --confirmo-produccion.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

for (const f of [".env.local", ".env.test"]) {
  const p = path.resolve(__dirname, "..", f);
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
}

const BUCKET = "aceros-rnf-backups";
const args = process.argv.slice(2).filter((a) => a !== "--");
const listar = args.includes("--listar");
const confirmoProd = args.includes("--confirmo-produccion");
const archivo = args.find((a) => !a.startsWith("--"));

function binario(nombre: string): string {
  for (const d of ["/opt/homebrew/opt/postgresql@18/bin", "/usr/lib/postgresql/18/bin", "/usr/local/opt/postgresql@18/bin"]) if (fs.existsSync(path.join(d, nombre))) return path.join(d, nombre);
  return nombre;
}

function rclone(...a: string[]) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error("Faltan R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY");
  return execFileSync("rclone", a, {
    encoding: "utf8",
    env: { ...process.env, RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_ACCESS_KEY_ID: R2_ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY, RCLONE_CONFIG_R2_ENDPOINT: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, RCLONE_CONFIG_R2_REGION: "auto", RCLONE_CONFIG_R2_NO_CHECK_BUCKET: "true" },
  });
}

async function main() {
  if (listar) {
    console.log(rclone("lsl", `r2:${BUCKET}`, "--include", "aceros-rnf-*.dump.gz"));
    return;
  }
  if (!archivo) throw new Error("Uso: pnpm db:restore <archivo.dump.gz>   (o -- --listar)");
  const destino = process.env.DATABASE_URL_RESTORE;
  if (!destino) throw new Error("Falta DATABASE_URL_RESTORE (base destino)");
  if (/ep-lingering-shape/.test(destino) && !confirmoProd) throw new Error("DATABASE_URL_RESTORE es PRODUCCIÓN. Si de verdad querés pisarla, agregá --confirmo-produccion");
  const host = new URL(destino).hostname.split(".")[0];

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "restore-"));
  let gz = archivo;
  if (!fs.existsSync(archivo)) {
    gz = path.join(tmp, path.basename(archivo));
    console.log(`↓ Descargando ${archivo} de R2…`);
    rclone("copyto", `r2:${BUCKET}/${archivo}`, gz);
  }
  const dump = path.join(tmp, "backup.dump");
  execFileSync("sh", ["-c", `gunzip -c "${gz}" > "${dump}"`]);
  console.log(`↻ Restaurando en ${host} (${(fs.statSync(dump).size / 1e6).toFixed(1)} MB)…`);
  const t0 = Date.now();
  try {
    execFileSync(binario("pg_restore"), ["--no-owner", "--no-privileges", "--clean", "--if-exists", "--single-transaction", `--dbname=${destino}`, dump], { stdio: "inherit" });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`✔ Restaurado en ${((Date.now() - t0) / 1000).toFixed(0)} s. Verificá con: DATABASE_URL=<destino> pnpm db:check`);
}

main().catch((e) => {
  console.error(`✘ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
