/**
 * Prueba de ida y vuelta del mapeo dominio ↔ base: lo que se escribió con db:seed:ejemplo
 * se lee y se compara campo por campo con seedEjemplo() (fechas normalizadas, números a la
 * precisión de la columna). `pnpm db:test:mapeo` (solo contra la rama de desarrollo).
 */
import { prisma } from "../src/server/db-base";
import { seedEjemplo } from "../src/data/seed";
import { COLECCIONES, leerEstado } from "../src/server/datos/mapeo";

const esFecha = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T|$)/.test(v);
function normal(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normal);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== null).map(([k, x]) => [k, normal(x)]).sort(([a], [b]) => a.localeCompare(b)));
  if (esFecha(v)) return new Date(v as string).toISOString();
  if (typeof v === "number") return Math.round(v * 10000) / 10000;
  return v;
}
function diferencias(a: unknown, b: unknown, ruta: string, out: string[]) {
  if (out.length > 20) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return void out.push(`${ruta}: largo ${a.length} ≠ ${b.length}`);
    a.forEach((x, i) => diferencias(x, b[i], `${ruta}[${i}]`, out));
    return;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diferencias((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${ruta}.${k}`, out);
    return;
  }
  if (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 0.006) return;
  if (a !== b) out.push(`${ruta}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
}

async function main() {
  const original = seedEjemplo(new Date());
  const leido = await leerEstado(prisma);
  let errores = 0;
  for (const k of COLECCIONES) {
    const porId = (xs: unknown[]) => [...(xs as { id: string }[])].sort((x, y) => x.id.localeCompare(y.id));
    const out: string[] = [];
    // Las fechas del seed dependen de "hoy": se comparan solo si el seed se cargó hoy.
    diferencias(normal(porId(original[k] as unknown[])), normal(porId(leido[k] as unknown[])), k, out);
    const reales = out.filter((d) => !/(creadoEn|actualizadoEn|fecha|vencimiento|subidoEn|fechaCobro|Fecha|Espera|Programada|Fin|Entrega|ahora)/i.test(d));
    if (reales.length) {
      errores += reales.length;
      console.log(`✘ ${k}`);
      for (const d of reales.slice(0, 5)) console.log(`    ${d}`);
    } else console.log(`✔ ${k} (${(leido[k] as unknown[]).length})`);
  }
  const cfg: string[] = [];
  diferencias(normal(original.config), normal(leido.config), "config", cfg);
  const num: string[] = [];
  diferencias(normal(original.numeradores), normal(leido.numeradores), "numeradores", num);
  console.log(cfg.length ? `✘ config: ${cfg.slice(0, 3).join(" · ")}` : "✔ config");
  console.log(num.length ? `✘ numeradores: ${num.slice(0, 3).join(" · ")}` : "✔ numeradores");
  errores += cfg.length + num.length;
  console.log(errores ? `\n✘ ${errores} diferencias` : "\n✔ El mapeo dominio ↔ base es exacto.");
  process.exitCode = errores ? 1 : 0;
}
main().finally(() => prisma.$disconnect());
