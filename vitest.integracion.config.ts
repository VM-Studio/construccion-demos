import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Integración contra una base real de Neon (branch `test`). La URL sale de `.env.test`
 * (DATABASE_URL_TEST) o de la variable de entorno en CI; nunca de Vercel.
 */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/integracion/vacio.ts") } },
  test: {
    include: ["tests/integracion/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/integracion/preparar.ts"],
    setupFiles: ["tests/integracion/entorno.ts"],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
});
