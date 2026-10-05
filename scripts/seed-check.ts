/**
 * Valida la consistencia del seed: `pnpm seed:check`.
 * Sale con código 1 si algún chequeo falla.
 */
import { crearSeed } from "../src/data/seed";
import { verificarIntegridad } from "../src/domain/integridad";
import { estaBajoMinimo } from "../src/domain/stock";
import { estaVencido } from "../src/domain/cuentasCorrientes";
import { estadoDerivado, diasParaVencer } from "../src/domain/acopios";

const hoy = new Date();
const db = crearSeed(hoy);
const res = verificarIntegridad(db);

console.log("\nconstruccion-demos · chequeo del seed\n");
for (const c of res.chequeos) {
  console.log(`${c.ok ? "✔" : "✘"} ${c.nombre} — ${c.detalle}`);
  for (const e of c.errores.slice(0, 10)) console.log(`    · ${e}`);
  if (c.errores.length > 10) console.log(`    · … y ${c.errores.length - 10} más`);
}

const fisicoTotal = (pid: string) => db.stock.filter((s) => s.productoId === pid).reduce((a, s) => a + s.cantidadFisica, 0);
const bajoMinimo = db.productos.filter((p) => estaBajoMinimo(p, fisicoTotal(p.id)));
const vencidos = db.comprobantes.filter((c) => c.clienteId && estaVencido(c, hoy));
const hoyStr = db.despachos.filter((d) => d.fechaProgramada.slice(0, 10) === new Date(hoy.setHours(0, 0, 0, 0)).toISOString().slice(0, 10));
const ocAtrasadas = db.ordenesCompra.filter((o) => (o.estado === "CONFIRMADA" || o.estado === "RECIBIDA_PARCIAL") && new Date(o.fechaEntregaEstimada) < new Date());
const porVencer = db.acopios.filter((a) => {
  const e = estadoDerivado(a, new Date());
  const d = diasParaVencer(a, new Date());
  return (e === "VIGENTE" || e === "RETIRADO_PARCIAL") && d <= 15;
});

console.log("\nResumen de datos para la demo");
console.log(`  Productos: ${db.productos.length} · bajo mínimo: ${bajoMinimo.length}`);
console.log(`  OC: ${db.ordenesCompra.length} · atrasadas: ${ocAtrasadas.length} · recepciones: ${db.recepciones.length}`);
console.log(`  Presupuestos: ${db.presupuestos.length} · pedidos: ${db.pedidos.length} · despachos: ${db.despachos.length} (hoy: ${hoyStr.length})`);
console.log(`  Acopios: ${db.acopios.length} · por vencer (≤15 días): ${porVencer.length} · vencidos: ${db.acopios.filter((a) => estadoDerivado(a, new Date()) === "VENCIDO").length}`);
console.log(`  Comprobantes: ${db.comprobantes.length} · vencidos sin cobrar: ${vencidos.length} · cobranzas: ${db.cobranzas.length} · cheques: ${db.cheques.length}`);
console.log(`  Movimientos: ${db.movimientos.length} · transferencias: ${db.transferencias.length} · ajustes: ${db.ajustes.length} · auditoría: ${db.auditoria.length}`);
const acopioGrande = Math.max(...db.acopios.map((a) => a.total));
console.log(`  Acopio más grande: $ ${Math.round(acopioGrande).toLocaleString("es-AR")}`);

if (!res.ok) {
  console.error("\n✘ El seed tiene inconsistencias.\n");
  process.exit(1);
}
console.log("\n✔ Seed consistente.\n");
