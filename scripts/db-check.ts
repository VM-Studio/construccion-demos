/**
 * Consistencia de la base real: `pnpm db:check`.
 * - Σ movimientos por artículo y depósito = StockDeposito (kardex) y el resto de verificarIntegridad
 *   (entregados ≤ cantidad, saldos de comprobantes = total − imputaciones, saldo de acopio = importe − NP + DP + ACD).
 * - Numeración: sin duplicados y sin huecos dentro de cada serie; ningún número supera el contador.
 * - La vista v_stock_posicion coincide con el cálculo en TypeScript (muestra de 200 posiciones).
 */
import { prisma } from "../src/server/db-base";
import { leerEstado } from "../src/server/datos/mapeo";
import { verificarIntegridad } from "../src/domain/integridad";
import { parsearNumeroDoc } from "../src/domain/numeracion";
import { posicionesDe } from "../src/store/calculos";

let fallas = 0;
const check = (n: string, ok: boolean, d = "") => {
  if (!ok) fallas++;
  console.log(`${ok ? "✔" : "✘"} ${n}${d ? ` — ${d}` : ""}`);
};

async function main() {
  const t0 = Date.now();
  const db = await leerEstado(prisma, { paralelo: true });
  console.log(`\nAceros RNF · chequeo de la base (${new URL(process.env.DATABASE_URL!).hostname.split(".")[0]})\n`);
  const r = verificarIntegridad(db);
  for (const c of r.chequeos) {
    check(c.nombre, c.ok, c.detalle);
    for (const e of c.errores.slice(0, 5)) console.log(`    · ${e}`);
  }

  // Numeración por serie (código + circuito + punto de venta)
  const series = new Map<string, number[]>();
  const todos = [db.notasPedido, db.acopios, db.remitos, db.comprobantes, db.cobranzas, db.ordenesCompra, db.pagosProveedores, db.acopiosProveedor, db.cotizaciones, db.recepciones, db.transferencias, db.ajustes, db.despachos, db.ajustesAcopio]
    .flat()
    .map((x) => (x as { numero: string }).numero)
    .filter((n) => n && !n.includes("(a favor)"));
  const repetidos = todos.length - new Set(todos).size;
  for (const n of todos) {
    const p = parsearNumeroDoc(n);
    if (!p) continue;
    const k = `${p.codigo}|${p.circuito ?? 0}|${p.puntoVenta}`;
    series.set(k, [...(series.get(k) ?? []), p.correlativo]);
  }
  // Saltos legítimos: "Establecer número inicial" (continuar la numeración del sistema anterior).
  const aud = await prisma.auditoria.findMany({ where: { accion: "Estableció número inicial" }, select: { entidadId: true, detalle: true } });
  const saltos = new Map<string, number[]>();
  for (const a of aud) {
    const hasta = Number(a.detalle.split("→")[1]);
    if (Number.isFinite(hasta)) saltos.set(a.entidadId, [...(saltos.get(a.entidadId) ?? []), hasta + 1]);
  }
  const huecos: string[] = [];
  const excedidos: string[] = [];
  for (const [k, ns] of series) {
    const orden = [...new Set(ns)].sort((a, b) => a - b);
    for (let i = 1; i < orden.length; i++) if (orden[i] !== orden[i - 1] + 1 && !(saltos.get(k) ?? []).includes(orden[i])) huecos.push(`${k}: salta de ${orden[i - 1]} a ${orden[i]}`);
    if ((db.numeradores[k] ?? 0) < orden.at(-1)!) excedidos.push(`${k}: usado ${orden.at(-1)} > contador ${db.numeradores[k] ?? 0}`);
  }
  check("Numeración sin duplicados", repetidos === 0, `${todos.length} documentos, ${series.size} series`);
  if (huecos.length && process.argv.includes("--historicos")) console.log(`⚠ Numeración: ${huecos.length} saltos históricos de los datos de ejemplo (${huecos.slice(0, 2).join(" · ")})`);
  else check("Numeración sin huecos dentro de cada serie", huecos.length === 0, huecos.slice(0, 3).join(" · "));
  check("Ningún número supera su contador", excedidos.length === 0, excedidos.slice(0, 3).join(" · "));

  // Vista de stock vs cálculo TypeScript
  const vista = await prisma.$queryRaw<{ productoId: string; depositoId: string; fisico: unknown; pendiente_entrega: unknown; reservado: unknown; disponible: unknown; en_transito: unknown }[]>`SELECT * FROM "v_stock_posicion" ORDER BY "productoId", "depositoId" LIMIT 200`;
  const pos = posicionesDe(db);
  const dif: string[] = [];
  for (const v of vista) {
    const t = pos.get(v.productoId)?.porDeposito[v.depositoId];
    if (!t) continue;
    const campos: [string, number, number][] = [["físico", Number(v.fisico), t.fisico], ["pendiente", Number(v.pendiente_entrega), t.pendiente], ["reservado", Number(v.reservado), t.reservado], ["disponible", Number(v.disponible), t.disponible], ["en tránsito", Number(v.en_transito), t.enTransito]];
    for (const [c, a, b] of campos) if (Math.abs(a - b) > 0.001) dif.push(`${v.productoId}@${v.depositoId} ${c}: vista ${a} ≠ TS ${b}`);
  }
  check("v_stock_posicion = cálculo TypeScript", dif.length === 0, dif.length ? dif.slice(0, 3).join(" · ") : `${vista.length} posiciones comparadas`);
  console.log(`\n${fallas ? `✘ ${fallas} chequeos fallaron` : "✔ Base consistente"} (${Date.now() - t0} ms)\n`);
  process.exitCode = fallas ? 1 : 0;
}
main().finally(() => prisma.$disconnect());
