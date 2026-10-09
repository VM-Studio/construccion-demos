import { defineConfig } from "vitest/config";
import path from "node:path";

/** Unitarios: reglas puras de `src/domain` (sin base). La integración usa vitest.integracion.config.ts. */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
