/**
 * Una vez por corrida: aplica migraciones y carga los datos de ejemplo en la base de pruebas
 * (reemplaza todo su contenido). Nunca corre contra producción (ver entorno.ts y seed-ejemplo).
 */
import { execSync } from "node:child_process";
import { cargarEntornoTest } from "./entorno";

/** Neon apaga la base inactiva: el primer intento puede no llegar mientras se despierta. */
function conReintentos(cmd: string, env: NodeJS.ProcessEnv) {
  for (let i = 1; ; i++) {
    try {
      return execSync(cmd, { stdio: "inherit", env });
    } catch (e) {
      if (i >= 4) throw e;
      execSync(`sleep ${i * 5}`);
    }
  }
}

export default function preparar() {
  cargarEntornoTest();
  const env = { ...process.env, NODE_ENV: "test" as const };
  conReintentos("npx prisma migrate deploy", env);
  conReintentos("npx tsx prisma/seed-ejemplo.ts", env);
}
