import type { EstadoInicial } from "./types";
import { calcularComprometido } from "./stock";

export interface ResultadoIntegridad {
  ok: boolean;
  chequeos: { nombre: string; ok: boolean; detalle: string; errores: string[] }[];
}

const EPS = 0.01;

/**
 * Verifica la consistencia interna de los datos:
 * - Σ movimientos por producto/depósito = stock físico, y nunca negativo en el tiempo.
 * - Comprometido = pedidos confirmados sin despachar + saldos de acopio (≤ lo vendido).
 * - Saldos de comprobantes = total − imputaciones (cobranzas, pagos y notas de crédito).
 * - Retiros de acopio ≤ acopiado y coherentes con lo registrado en cada ítem.
 * - Lo despachado de cada pedido coincide con los egresos de sus despachos.
 */
export function verificarIntegridad(db: EstadoInicial): ResultadoIntegridad {
  const chequeos: ResultadoIntegridad["chequeos"] = [];
  const nombreProd = new Map(db.productos.map((p) => [p.id, `${p.codigo} ${p.nombre}`]));
  const nombreDep = new Map(db.depositos.map((d) => [d.id, d.nombre]));

  // 1. Kardex = físico, y nunca negativo
  {
    const errores: string[] = [];
    const acumulado = new Map<string, number>();
    const movs = [...db.movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.signo === 1 ? -1 : 1));
    const negativos = new Set<string>();
    for (const m of movs) {
      const k = `${m.productoId}|${m.depositoId}`;
      const v = (acumulado.get(k) ?? 0) + m.signo * m.cantidad;
      acumulado.set(k, v);
      if (v < -EPS && !negativos.has(k)) {
        negativos.add(k);
        errores.push(`${nombreProd.get(m.productoId)} en ${nombreDep.get(m.depositoId)} quedó negativo (${v}) el ${m.fecha.slice(0, 10)}`);
      }
    }
    for (const s of db.stock) {
      const k = `${s.productoId}|${s.depositoId}`;
      const v = acumulado.get(k) ?? 0;
      if (Math.abs(v - s.cantidadFisica) > EPS)
        errores.push(`${nombreProd.get(s.productoId)} en ${nombreDep.get(s.depositoId)}: kardex ${v} ≠ físico ${s.cantidadFisica}`);
      if (s.cantidadFisica < -EPS) errores.push(`${nombreProd.get(s.productoId)} en ${nombreDep.get(s.depositoId)} con stock físico negativo`);
    }
    chequeos.push({ nombre: "Kardex cierra con el stock físico", ok: !errores.length, detalle: `${db.movimientos.length} movimientos, ${db.stock.length} posiciones`, errores });
  }

  // 2. Comprometido
  {
    const errores: string[] = [];
    let total = 0;
    for (const s of db.stock) {
      const c = calcularComprometido(s.productoId, s.depositoId, db.pedidos, db.acopios, db.despachos);
      if (c < 0) errores.push(`${nombreProd.get(s.productoId)}: comprometido negativo`);
      total += c;
    }
    for (const p of db.pedidos)
      for (const it of p.items)
        if ((it.cantidadDespachada ?? 0) - it.cantidad > EPS) errores.push(`${p.numero}: se despachó más de lo vendido en una línea`);
    chequeos.push({ nombre: "Comprometido = pedidos sin despachar + saldos de acopio", ok: !errores.length, detalle: `${Math.round(total)} unidades comprometidas`, errores });
  }

  // 3. Despachado de pedidos = egresos de despachos
  {
    const errores: string[] = [];
    const egresado = new Map<string, number>();
    for (const d of db.despachos) {
      if (d.origenTipo !== "PEDIDO" || !d.egresoGenerado || d.estado === "CANCELADO") continue;
      for (const it of d.items) {
        if (!it.itemOrigenId) continue;
        const entregadoNeto = it.cantidadEntregada !== undefined && (d.estado === "ENTREGADO" || d.estado === "RETIRADO_EN_MOSTRADOR") ? it.cantidadEntregada : it.cantidad;
        egresado.set(it.itemOrigenId, (egresado.get(it.itemOrigenId) ?? 0) + entregadoNeto);
      }
    }
    for (const p of db.pedidos)
      for (const it of p.items) {
        const e = egresado.get(it.id) ?? 0;
        if (Math.abs(e - (it.cantidadDespachada ?? 0)) > EPS) errores.push(`${p.numero}: despachado ${it.cantidadDespachada ?? 0} ≠ egresos ${e}`);
      }
    chequeos.push({ nombre: "Lo despachado de cada pedido coincide con sus remitos", ok: !errores.length, detalle: `${db.despachos.length} despachos`, errores });
  }

  // 4. Saldos de comprobantes
  {
    const errores: string[] = [];
    const imputado = new Map<string, number>();
    for (const c of db.cobranzas) for (const i of c.imputaciones) imputado.set(i.comprobanteId, (imputado.get(i.comprobanteId) ?? 0) + i.importe);
    for (const p of db.pagosProveedores) for (const i of p.imputaciones) imputado.set(i.comprobanteId, (imputado.get(i.comprobanteId) ?? 0) + i.importe);
    // Notas de crédito aplicadas a comprobantes con saldo
    for (const nc of db.comprobantes) for (const i of nc.aplicadoA ?? []) imputado.set(i.comprobanteId, (imputado.get(i.comprobanteId) ?? 0) + i.importe);
    for (const c of db.comprobantes) {
      if (c.tipo !== "FACTURA_A" && c.tipo !== "FACTURA_B" && c.tipo !== "NOTA_DEBITO") continue;
      const esperado = c.total - (imputado.get(c.id) ?? 0);
      if (c.estado === "ANULADO") continue;
      if (Math.abs(esperado - c.saldoPendiente) > 1) errores.push(`${c.numero}: saldo ${c.saldoPendiente.toFixed(2)} ≠ total − cobrado ${esperado.toFixed(2)}`);
    }
    const cobradoAcopio = new Map<string, number>();
    for (const c of db.cobranzas) for (const i of c.imputaciones) cobradoAcopio.set(i.comprobanteId, (cobradoAcopio.get(i.comprobanteId) ?? 0) + i.importe);
    for (const a of db.acopios) {
      const ids = a.comprobanteIds ?? (a.comprobanteId ? [a.comprobanteId] : []);
      const pagado = ids.reduce((s, id) => s + (cobradoAcopio.get(id) ?? 0), 0);
      if (Math.abs(pagado - a.montoPagado) > 1) errores.push(`${a.numero}: monto pagado ${a.montoPagado} ≠ cobranzas imputadas ${pagado.toFixed(2)}`);
    }
    chequeos.push({ nombre: "Saldos de comprobantes = total − imputaciones", ok: !errores.length, detalle: `${db.comprobantes.length} comprobantes, ${db.cobranzas.length} cobranzas, ${db.pagosProveedores.length} pagos`, errores });
  }

  // 5. Acopios
  {
    const errores: string[] = [];
    // Lo retirado = lo incluido en remitos de acopio no cancelados (en entregas parciales, lo entregado + el saldo reprogramado).
    const retirado = new Map<string, number>();
    for (const d of db.despachos) {
      if (d.origenTipo !== "RETIRO_ACOPIO" || d.estado === "CANCELADO") continue;
      const cerrado = d.estado === "ENTREGADO" || d.estado === "RETIRADO_EN_MOSTRADOR";
      for (const it of d.items)
        if (it.itemOrigenId) retirado.set(it.itemOrigenId, (retirado.get(it.itemOrigenId) ?? 0) + (cerrado ? (it.cantidadEntregada ?? it.cantidad) : it.cantidad));
    }
    for (const a of db.acopios)
      for (const it of a.items) {
        if (it.cantidadRetirada - it.cantidadAcopiada > EPS) errores.push(`${a.numero}: retirado mayor a lo acopiado (${nombreProd.get(it.productoId)})`);
        const r = retirado.get(it.id) ?? 0;
        if (Math.abs(r - it.cantidadRetirada) > EPS) errores.push(`${a.numero}: retiros ${r} ≠ registrado ${it.cantidadRetirada} (${nombreProd.get(it.productoId)})`);
      }
    chequeos.push({ nombre: "Retiros de acopio ≤ acopiado", ok: !errores.length, detalle: `${db.acopios.length} acopios, ${db.retiros.length} retiros`, errores });
  }

  return { ok: chequeos.every((c) => c.ok), chequeos };
}
