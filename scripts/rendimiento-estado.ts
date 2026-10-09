/**
 * Camino real de la app con volumen (branch `test`, después de `pnpm db:seed:carga`):
 * lectura completa del estado en memoria, cálculos de las pantallas y tamaño del JSON inicial.
 * `pnpm db:rendimiento:estado`
 */
import fs from "node:fs";
import path from "node:path";

const env = path.resolve(__dirname, "../.env.test");
if (fs.existsSync(env)) for (const l of fs.readFileSync(env, "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
if (!process.env.DATABASE_URL_TEST || /ep-lingering-shape/.test(process.env.DATABASE_URL_TEST)) throw new Error("Solo contra el branch test (.env.test)");
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

async function main() {
  const { obtenerEstado, invalidarCache } = await import("../src/server/estado");
  const { posicionesDe, acopiosResumenDe, selectSaldosClientes, hoyKey } = await import("../src/store/calculos");
  const { lineasPendientes } = await import("../src/domain/stock");
  const { calcularAlertas } = await import("../src/store/alertas-calc");
  const { ventasFacturadas } = await import("../src/domain/metricas");
  const { periodoDesdePreset } = await import("../src/lib/periodos");
  const medir = async <T,>(nombre: string, fn: () => T | Promise<T>) => {
    const t = performance.now();
    const r = await fn();
    console.log(`${nombre.padEnd(46)} ${(performance.now() - t).toFixed(0).padStart(7)} ms`);
    return r;
  };
  invalidarCache();
  const m0 = process.memoryUsage().heapUsed;
  const { db } = await medir("Lectura completa del estado (fría)", () => obtenerEstado());
  console.log(`  memoria del estado ≈ ${((process.memoryUsage().heapUsed - m0) / 1e6).toFixed(0)} MB · ${db.productos.length} artículos · ${db.notasPedido.length} NP · ${db.acopios.length} acopios`);
  await medir("Lectura con caché (misma versión)", () => obtenerEstado());
  const actor = { id: "x", rol: "DUENO", activo: true } as never;
  await medir("Stock · posiciones de todos los artículos", () => posicionesDe(db));
  await medir("Pendientes de entrega", () => lineasPendientes(db.notasPedido, db.remitos));
  await medir("Acopios · resumen con saldo", () => acopiosResumenDe(db));
  await medir("Cuentas corrientes · saldos", () => selectSaldosClientes(db.comprobantes, hoyKey()));
  await medir("Tablero · ventas del mes", () => ventasFacturadas(db, periodoDesdePreset("MES"), null));
  await medir("Alertas", () => calcularAlertas(db, null, actor, hoyKey()));
  const json = await medir("JSON inicial para el navegador", () => JSON.stringify(db));
  console.log(`  tamaño: ${(json.length / 1e6).toFixed(1)} MB sin comprimir`);
  const { gzipSync } = await import("node:zlib");
  console.log(`  comprimido (gzip): ${(gzipSync(json).length / 1e6).toFixed(1)} MB`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
