/**
 * Valida la consistencia del seed de Aceros RNF: `pnpm seed:check`.
 * Sale con código 1 si algún chequeo falla.
 */
import { seedBase, seedEjemplo } from "../src/data/seed";
import { estaVacio } from "../src/domain/prerequisitos";
import { verificarIntegridad } from "../src/domain/integridad";
import { estaBajoMinimo, lineasPendientes } from "../src/domain/stock";
import { estaVencido } from "../src/domain/cuentasCorrientes";
import { estadoDerivado, diasParaVencer, movimientosAcopio, pendienteLinea, saldoDisponible } from "../src/domain/acopios";
import { pendienteRetirar } from "../src/domain/acopiosProveedor";

const hoy = new Date();
const marca = (b: boolean) => (b ? "✔" : "✘");
let ok = true;

// ── 1. Base vacía: solo estructura ──
console.log("\nAceros RNF · base vacía (solo estructura)\n");
{
  const b = seedBase(hoy);
  const r = verificarIntegridad(b);
  for (const c of r.chequeos) console.log(`${marca(c.ok)} ${c.nombre} — ${c.detalle}`);
  if (!r.ok) ok = false;
  const cond = (nombre: string, v: boolean, detalle = "") => {
    console.log(`${marca(v)} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
    if (!v) ok = false;
  };
  cond("Sin datos maestros ni operativos", estaVacio(b) && !b.adjuntos.length && !b.auditoria.length && !b.vehiculos.length && !b.choferes.length && !b.stock.length && !b.precios.length);
  cond("2 sucursales con depósito y posiciones", b.sucursales.length === 2 && b.depositos.length === 2 && b.depositos.every((d) => d.posiciones.length >= 4), b.sucursales.map((s) => `${s.nombre} PV ${s.puntoVenta}`).join(" · "));
  cond("2 unidades de negocio con rubros", b.unidadesNegocio.length === 2 && b.unidadesNegocio.every((u) => b.rubros.some((r) => r.unidadNegocioId === u.id)), `${b.rubros.length} rubros`);
  cond("3 listas de precios sin precios", b.listasPrecios.length === 3, b.listasPrecios.map((l) => `${l.nombre} ${l.markupPorDefecto} %`).join(" · "));
  cond("4 usuarios (dueño, administración, ventas, depósito)", b.usuarios.length === 4 && ["DUENO", "ADMINISTRACION", "VENTAS", "DEPOSITO"].every((r) => b.usuarios.some((u) => u.rol === r)));
  cond("Numeración en 0", Object.keys(b.numeradores).length === 0);
  cond("Motivo de ajuste «Inventario inicial»", b.config.motivosAjuste.some((m) => m.codigo === "INVENTARIO_INICIAL"));
}

// ── 2. Datos de ejemplo ──
const db = seedEjemplo(hoy);
const res = verificarIntegridad(db);
if (!res.ok) ok = false;
console.log("\nAceros RNF · datos de ejemplo\n");
for (const c of res.chequeos) {
  console.log(`${marca(c.ok)} ${c.nombre} — ${c.detalle}`);
  for (const e of c.errores.slice(0, 10)) console.log(`    · ${e}`);
  if (c.errores.length > 10) console.log(`    · … y ${c.errores.length - 10} más`);
}

const chequear = (nombre: string, cond: boolean, detalle = "") => {
  console.log(`${marca(cond)} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) ok = false;
};

// Saldo de cada acopio = importe − NP + DP + ACD
for (const a of db.acopios) {
  const np = db.notasPedido.filter((n) => n.acopioId === a.id && n.estado !== "ANULADA").reduce((s, n) => s + n.monto, 0);
  const dp = db.devoluciones.filter((d) => d.acopioId === a.id).reduce((s, d) => s + d.monto, 0);
  const acd = db.ajustesAcopio.filter((x) => x.acopioId === a.id).reduce((s, x) => s + x.monto, 0);
  const saldo = saldoDisponible(a, db.notasPedido, db.devoluciones, db.ajustesAcopio);
  if (Math.abs(a.importe - np - dp + acd - saldo) > 0.01) chequear(`Saldo de ${a.numero}`, false, `${saldo} ≠ ${a.importe - np - dp + acd}`);
}
chequear("Saldo de cada acopio = importe − NP + DP + ACD", true, `${db.acopios.length} acopios`);

// Entregados ≤ cantidad y pendiente = Σ(cantidad − entregados − devueltos)
const lineas = db.notasPedido.flatMap((n) => (n.estado === "ANULADA" || n.estado === "BORRADOR" ? [] : n.items));
chequear("Entregados ≤ cantidad en cada línea de NP", lineas.every((i) => i.entregados <= i.cantidad + 1e-9), `${lineas.length} líneas`);
const pendDirecto = lineas.reduce((s, i) => s + Math.max(0, i.cantidad - i.entregados - (i.devueltos ?? 0)), 0);
const pendDominio = lineas.reduce((s, i) => s + pendienteLinea(i), 0);
const enPicking = db.remitos.filter((r) => r.estado === "PICKING").flatMap((r) => r.items).reduce((s, i) => s + i.cantidad, 0);
const pendLineas = lineasPendientes(db.notasPedido, db.remitos).reduce((s, l) => s + l.pendiente, 0);
chequear("Pendiente de entrega = Σ(cantidad − entregados)", Math.abs(pendDirecto - pendDominio) < 0.01 && Math.abs(pendDominio - enPicking - pendLineas) < 0.01, `${Math.round(pendDominio)} unidades (${Math.round(enPicking)} en picking)`);

// Ramos cierra en $ 844,85
const ramos = db.acopios.find((a) => a.numero === "AC2 0001-00003633")!;
const saldoRamos = saldoDisponible(ramos, db.notasPedido, db.devoluciones, db.ajustesAcopio);
const grupos = movimientosAcopio(ramos, db.notasPedido, db.devoluciones, db.ajustesAcopio, db);
const corrido = grupos.at(-1)!.lineas.at(-1)!.saldoDisponible;
chequear("Acopio de Ramos (AC2 0001-00003633) cierra en $ 844,85", Math.abs(saldoRamos - 844.85) < 0.005 && Math.abs(corrido - 844.85) < 0.005, `saldo ${saldoRamos} · saldo corrido ${corrido} · ${grupos.length} grupos (${grupos.filter((g) => g.tipoDoc === "NP").length} NP, ${grupos.filter((g) => g.tipoDoc === "DP").length} DP, ${grupos.filter((g) => g.tipoDoc === "ACD").length} ACD)`);
chequear("Primera línea del detalle de Ramos = $ 4.268.925,90", grupos[0].lineas[0].saldoDisponible === 4268925.9);

// Acopios con proveedores: pendiente de retirar = pactado − recibido
for (const a of db.acopiosProveedor.filter((x) => x.modalidad === "CANTIDAD")) {
  const p = pendienteRetirar(a, db.ordenesCompra).porProducto;
  chequear(`${a.numero}: pendiente de retirar`, p.every((x) => Math.abs(x.pendiente - (x.pactado - x.recibido)) < 1e-9), p.map((x) => `${x.pendiente} de ${x.pactado}`).join(", "));
}

// Despachos de hoy en los tres estados
const esHoy = (iso: string) => new Date(iso).toDateString() === hoy.toDateString();
const desHoy = db.despachos.filter((d) => esHoy(d.fechaEspera));
const estados = (e: string) => desHoy.filter((d) => d.estado === e).length;
chequear("Despachos de hoy en espera, preparación y finalizados", estados("ESPERA") > 0 && estados("PREPARACION") > 0 && estados("FINALIZADO") > 0, `espera ${estados("ESPERA")} · preparación ${estados("PREPARACION")} · finalizados ${estados("FINALIZADO")} · en viaje ${estados("EN_VIAJE")}`);
const remEstados = (e: string) => db.remitos.filter((r) => r.estado === e).length;
chequear("Remitos en los tres estados", remEstados("INICIAL") > 0 && remEstados("PICKING") > 0 && remEstados("HECHO") > 0, `inicial ${remEstados("INICIAL")} · picking ${remEstados("PICKING")} · hechos ${remEstados("HECHO")}`);
const firmados = db.remitos.filter((r) => r.firmadoAdjuntoId).length;
const sinFirmar = db.remitos.filter((r) => r.estado === "HECHO" && !r.firmadoAdjuntoId && (hoy.getTime() - Date.parse(r.fecha)) / 86400000 <= 15).length;
chequear("Remitos firmados de ejemplo y hechos sin firmar", firmados === 3 && sinFirmar > 0, `${firmados} firmados · ${sinFirmar} hechos sin firmar (últimos 15 días)`);
chequear("Al menos 50 notas de pedido", db.notasPedido.length >= 50, `${db.notasPedido.length} NP (${db.notasPedido.filter((n) => n.origen === "ACOPIO").length} retiros de acopio)`);

// Caso límite: Holcim en Casa Central con disponible 80
{
  const pid = "prod_50104";
  const fis = db.stock.find((s) => s.productoId === pid && s.depositoId === "dep_central")!.cantidadFisica;
  const pend = lineasPendientes(db.notasPedido, db.remitos).filter((l) => l.productoId === pid && l.depositoId === "dep_central").reduce((s, l) => s + l.pendiente, 0);
  const resv = db.remitos.filter((r) => r.estado === "PICKING" && r.depositoId === "dep_central").flatMap((r) => r.items).filter((i) => i.productoId === pid).reduce((s, i) => s + i.cantidad, 0);
  chequear("Cemento Holcim en Casa Central: disponible 80", Math.abs(fis - pend - resv - 80) < 0.01, `físico ${fis} · pendiente ${pend} · reservado ${resv}`);
}

const fisicoTotal = (pid: string) => db.stock.filter((s) => s.productoId === pid).reduce((a, s) => a + s.cantidadFisica, 0);
const bajoMinimo = db.productos.filter((p) => estaBajoMinimo(p, fisicoTotal(p.id)));
const vencidos = db.comprobantes.filter((c) => c.clienteId && estaVencido(c, hoy));
const ocAtrasadas = db.ordenesCompra.filter((o) => (o.estado === "CONFIRMADA" || o.estado === "RECIBIDA_PARCIAL") && new Date(o.fechaEntregaEstimada) < hoy);
const resumen = db.acopios.map((a) => ({ a, saldo: saldoDisponible(a, db.notasPedido, db.devoluciones, db.ajustesAcopio) }));
const estadoAco = (e: string) => resumen.filter((r) => estadoDerivado(r.a, hoy, r.saldo) === e).length;
const porVencer = resumen.filter((r) => estadoDerivado(r.a, hoy, r.saldo) === "VIGENTE" && diasParaVencer(r.a, hoy) <= 30).length;

console.log("\nResumen de datos para la demo");
console.log(`  Clientes: ${db.clientes.length} · obras: ${db.obras.length} · proveedores: ${db.proveedores.length} · artículos: ${db.productos.length} (bajo mínimo: ${bajoMinimo.length})`);
console.log(`  Acopios: ${db.acopios.length} · vigentes ${estadoAco("VIGENTE")} · vencidos ${estadoAco("VENCIDO")} · agotados ${estadoAco("AGOTADO")} · por vencer ≤30 días ${porVencer}`);
console.log(`  Acopios con proveedores: ${db.acopiosProveedor.length} · OC: ${db.ordenesCompra.length} (atrasadas ${ocAtrasadas.length}) · recepciones: ${db.recepciones.length}`);
console.log(`  NP: ${db.notasPedido.length} · devoluciones: ${db.devoluciones.length} · remitos: ${db.remitos.length} · despachos: ${db.despachos.length} (hoy ${desHoy.length})`);
console.log(`  Comprobantes: ${db.comprobantes.length} · vencidos sin cobrar: ${vencidos.length} · recibos: ${db.cobranzas.length} · OP: ${db.pagosProveedores.length} · cheques: ${db.cheques.length}`);
console.log(`  Movimientos: ${db.movimientos.length} · transferencias: ${db.transferencias.length} · ajustes: ${db.ajustes.length} · auditoría: ${db.auditoria.length}`);

if (!ok) {
  console.error("\n✘ El seed tiene inconsistencias.\n");
  process.exit(1);
}
console.log("\n✔ Seed consistente.\n");
