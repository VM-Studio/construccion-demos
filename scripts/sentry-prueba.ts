/**
 * Manda un evento de prueba a Sentry con las mismas opciones (y el mismo filtro de datos) que el
 * sistema. `pnpm sentry:prueba` — sirve para verificar el DSN después de configurarlo.
 */
import fs from "node:fs";
import path from "node:path";
import * as Sentry from "@sentry/node";
import { opcionesSentry } from "../src/lib/sentry-opciones";

const env = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(env)) for (const l of fs.readFileSync(env, "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }

async function main() {
  if (!process.env.SENTRY_DSN) throw new Error("Falta SENTRY_DSN");
  Sentry.init({ ...opcionesSentry(process.env.SENTRY_DSN), environment: process.env.SENTRY_ENTORNO ?? "prueba" } as Sentry.NodeOptions);
  Sentry.setUser({ id: "prueba", email: "no-debe-llegar@x.test" } as never);
  const id = Sentry.captureMessage("Evento de prueba de Aceros RNF", { level: "info", extra: { password: "no-debe-llegar", detalle: "ok" } });
  await Sentry.flush(5000);
  console.log(`✔ Evento enviado a Sentry (id ${id}). Revisalo en Issues: el usuario tiene que figurar solo con id y "password" como [filtrado].`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
