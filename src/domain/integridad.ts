import type { EstadoInicial } from "./types";
import { movimientosAcopio, pendienteLinea, saldoDisponible } from "./acopios";
import { pendienteRetirar } from "./acopiosProveedor";
import { calcularDisponible, lineasPendientes } from "./stock";
import { parsearNumeroDoc } from "./numeracion";

export interface ResultadoIntegridad {
  ok: boolean;
  chequeos: { nombre: string; ok: boolean; detalle: string; errores: string[] }[];
}

const EPS = 0.01;

/**
 * Verifica la consistencia interna de los datos:
 * - Kardex: Σ movimientos = stock físico, nunca negativo en el tiempo.
 * - Notas de pedido: entregados ≤ cantidad y = remitos hechos − devoluciones; pendiente consistente.
 * - Disponible nunca negativo salvo ventas forzadas (auditadas).
 * - Comprobantes: saldo = total − imputaciones.
 * - Acopios: saldo = importe − NP + DP + ACD (y el saldo corrido del detalle cierra igual).
 * - Acopios con proveedores: pendiente de retirar = pactado − recibido; pagado = OP imputadas.
 * - Numeración: ningún número repetido por (código, circuito, punto de venta) y circuito heredado.
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
      if (Math.abs(v - s.cantidadFisica) > EPS) errores.push(`${nombreProd.get(s.productoId)} en ${nombreDep.get(s.depositoId)}: kardex ${v} ≠ físico ${s.cantidadFisica}`);
    }
    chequeos.push({ nombre: "Kardex cierra con el stock físico", ok: !errores.length, detalle: `${db.movimientos.length} movimientos, ${db.stock.length} posiciones`, errores });
  }

  // 2. Notas de pedido: entregados vs remitos
  {
    const errores: string[] = [];
    const neto = new Map<string, number>();
    for (const r of db.remitos) {
      if (r.estado !== "HECHO") continue;
      const signo = r.tipo === "DEVOLUCION" ? -1 : r.tipo === "TRANSFERENCIA" ? 0 : 1;
      for (const it of r.items) if (it.itemNPId && signo) neto.set(it.itemNPId, (neto.get(it.itemNPId) ?? 0) + signo * it.cantidad);
    }
    let lineas = 0;
    for (const n of db.notasPedido)
      for (const it of n.items) {
        lineas++;
        if (it.entregados - it.cantidad > EPS) errores.push(`${n.numero}: entregados ${it.entregados} > cantidad ${it.cantidad} (${nombreProd.get(it.productoId)})`);
        if (it.entregados + (it.devueltos ?? 0) - it.cantidad > EPS) errores.push(`${n.numero}: entregados + devueltos superan la cantidad (${nombreProd.get(it.productoId)})`);
        const r = neto.get(it.id) ?? 0;
        if (Math.abs(r - it.entregados) > EPS) errores.push(`${n.numero}: entregados ${it.entregados} ≠ remitos hechos ${r} (${nombreProd.get(it.productoId)})`);
        const pend = pendienteLinea(it) > EPS;
        if (n.estado === "ENTREGADA" && pend) errores.push(`${n.numero}: figura entregada con pendiente`);
      }
    chequeos.push({ nombre: "Entregados ≤ cantidad y = remitos hechos − devoluciones", ok: !errores.length, detalle: `${db.notasPedido.length} notas de pedido, ${lineas} líneas`, errores });
  }

  // 3. Pendiente de entrega y disponible
  {
    const errores: string[] = [];
    const pend = new Map<string, number>();
    const lineas = lineasPendientes(db.notasPedido, db.remitos);
    for (const l of lineas) pend.set(`${l.productoId}|${l.depositoId}`, (pend.get(`${l.productoId}|${l.depositoId}`) ?? 0) + l.pendiente);
    const res = new Map<string, number>();
    for (const r of db.remitos) if (r.estado === "PICKING" && (r.tipo === "VENTA" || r.tipo === "DESACOPIO")) for (const it of r.items) res.set(`${it.productoId}|${r.depositoId}`, (res.get(`${it.productoId}|${r.depositoId}`) ?? 0) + it.cantidad);
    const forzados = new Set(db.notasPedido.filter((n) => n.forzadoSinDisponible && n.estado !== "ENTREGADA" && n.estado !== "ANULADA").flatMap((n) => n.items.map((i) => `${i.productoId}|${n.depositoId}`)));
    let negativos = 0;
    for (const s of db.stock) {
      const k = `${s.productoId}|${s.depositoId}`;
      const disp = calcularDisponible(s.cantidadFisica, pend.get(k) ?? 0, res.get(k) ?? 0);
      if (disp < -EPS) {
        negativos++;
        if (!forzados.has(k)) errores.push(`${nombreProd.get(s.productoId)} en ${nombreDep.get(s.depositoId)}: disponible ${disp} sin venta forzada auditada`);
      }
    }
    const total = lineas.reduce((a, l) => a + l.pendiente * l.precio, 0);
    chequeos.push({ nombre: "Disponible = físico − pendiente − reservado (nunca negativo salvo forzados)", ok: !errores.length, detalle: `${lineas.length} líneas pendientes por $ ${Math.round(total).toLocaleString("es-AR")} · ${negativos} posiciones negativas`, errores });
  }

  // 4. Saldos de comprobantes
  {
    const errores: string[] = [];
    const imputado = new Map<string, number>();
    const add = (id: string, x: number) => imputado.set(id, (imputado.get(id) ?? 0) + x);
    for (const c of db.cobranzas) for (const i of c.imputaciones) add(i.comprobanteId, i.importe);
    for (const p of db.pagosProveedores) for (const i of p.imputaciones) add(i.comprobanteId, i.importe);
    for (const nc of db.comprobantes) for (const i of nc.aplicadoA ?? []) add(i.comprobanteId, i.importe);
    for (const c of db.comprobantes) {
      if (c.estado === "ANULADO" || (c.tipo !== "FACTURA" && c.tipo !== "NOTA_DEBITO")) continue;
      const esperado = c.total - (imputado.get(c.id) ?? 0);
      if (Math.abs(esperado - c.saldoPendiente) > 1) errores.push(`${c.numero}: saldo ${c.saldoPendiente.toFixed(2)} ≠ total − imputado ${esperado.toFixed(2)}`);
    }
    chequeos.push({ nombre: "Saldos de comprobantes = total − imputaciones", ok: !errores.length, detalle: `${db.comprobantes.length} comprobantes, ${db.cobranzas.length} recibos, ${db.pagosProveedores.length} órdenes de pago`, errores });
  }

  // 5. Acopios de clientes
  {
    const errores: string[] = [];
    for (const a of db.acopios) {
      const np = db.notasPedido.filter((n) => n.acopioId === a.id && n.estado !== "ANULADA" && n.estado !== "BORRADOR").reduce((s, n) => s + n.monto, 0);
      const dp = db.devoluciones.filter((d) => d.acopioId === a.id).reduce((s, d) => s + d.monto, 0);
      const acd = db.ajustesAcopio.filter((x) => x.acopioId === a.id).reduce((s, x) => s + x.monto, 0);
      const esperado = Math.round((a.importe - np - dp + acd) * 100) / 100;
      const saldo = saldoDisponible(a, db.notasPedido, db.devoluciones, db.ajustesAcopio);
      if (Math.abs(esperado - saldo) > EPS) errores.push(`${a.numero}: saldo ${saldo} ≠ importe − NP + DP + ACD ${esperado}`);
      const grupos = movimientosAcopio(a, db.notasPedido, db.devoluciones, db.ajustesAcopio, db);
      const ultimo = grupos.at(-1)?.lineas.at(-1)?.saldoDisponible ?? a.importe;
      if (Math.abs(ultimo - saldo) > EPS) errores.push(`${a.numero}: el saldo corrido del detalle (${ultimo}) no cierra con el saldo (${saldo})`);
      if (saldo < -EPS && !db.notasPedido.some((n) => n.acopioId === a.id && n.autorizadoSaldoNegativo)) errores.push(`${a.numero}: saldo negativo sin autorización`);
      for (const n of db.notasPedido.filter((x) => x.acopioId === a.id)) if (n.circuito !== a.circuito) errores.push(`${n.numero}: no hereda el circuito del acopio ${a.numero}`);
    }
    chequeos.push({ nombre: "Saldo de acopio = importe − NP + DP + ACD", ok: !errores.length, detalle: `${db.acopios.length} acopios, ${db.devoluciones.length} devoluciones, ${db.ajustesAcopio.length} ajustes/traspasos`, errores });
  }

  // 6. Acopios con proveedores
  {
    const errores: string[] = [];
    for (const a of db.acopiosProveedor) {
      if (a.modalidad === "CANTIDAD")
        for (const p of pendienteRetirar(a, db.ordenesCompra).porProducto) {
          const recibido = db.ordenesCompra.filter((o) => o.acopioProveedorId === a.id).flatMap((o) => o.items).filter((i) => i.productoId === p.productoId).reduce((s, i) => s + i.cantidadRecibida, 0);
          if (Math.abs(p.pendiente - Math.max(0, p.pactado - recibido)) > EPS) errores.push(`${a.numero}: pendiente de retirar ≠ pactado − recibido`);
        }
      const pagado = db.pagosProveedores.flatMap((o) => o.imputaciones).filter((i) => a.comprobanteCompraIds.includes(i.comprobanteId)).reduce((s, i) => s + i.importe, 0);
      if (Math.abs(pagado - a.pagado) > 1) errores.push(`${a.numero}: pagado ${a.pagado} ≠ órdenes de pago imputadas ${pagado}`);
    }
    chequeos.push({ nombre: "Acopios con proveedores: pendiente = pactado − recibido; pagado = OP", ok: !errores.length, detalle: `${db.acopiosProveedor.length} acopios con proveedores`, errores });
  }

  // 7. Numeración única y circuito heredado
  {
    const errores: string[] = [];
    const vistos = new Map<string, string>();
    const docs: { numero: string; tipo: string }[] = [
      ...db.acopios.map((x) => ({ numero: x.numero, tipo: "acopio" })),
      ...db.notasPedido.filter((n) => n.numero).map((x) => ({ numero: x.numero, tipo: "NP" })),
      ...db.remitos.map((x) => ({ numero: x.numero, tipo: "remito" })),
      ...db.comprobantes.filter((c) => c.clienteId && c.tipo !== "SALDO_A_FAVOR").map((x) => ({ numero: x.numero, tipo: "comprobante" })),
      ...db.cobranzas.map((x) => ({ numero: x.numero, tipo: "recibo" })),
      ...db.pagosProveedores.map((x) => ({ numero: x.numero, tipo: "OP" })),
      ...db.ordenesCompra.map((x) => ({ numero: x.numero, tipo: "OC" })),
      ...db.ajustesAcopio.map((x) => ({ numero: x.numero, tipo: "ACD" })),
      ...db.devoluciones.map((x) => ({ numero: x.numero, tipo: "DP" })),
      ...db.despachos.map((x) => ({ numero: x.numero, tipo: "despacho" })),
    ];
    for (const d of docs) {
      const p = parsearNumeroDoc(d.numero);
      if (!p) continue;
      const k = d.numero;
      if (vistos.has(k)) errores.push(`Número repetido: ${d.numero} (${vistos.get(k)} y ${d.tipo})`);
      vistos.set(k, d.tipo);
    }
    const npPorId = new Map(db.notasPedido.map((n) => [n.id, n]));
    for (const r of db.remitos) {
      const n = r.notaPedidoId ? npPorId.get(r.notaPedidoId) : undefined;
      if (n && n.circuito !== r.circuito) errores.push(`${r.numero}: circuito distinto al de ${n.numero}`);
    }
    for (const c of db.comprobantes) {
      const n = c.notaPedidoId ? npPorId.get(c.notaPedidoId) : undefined;
      if (n && n.circuito !== c.circuito) errores.push(`${c.numero}: circuito distinto al de ${n.numero}`);
    }
    chequeos.push({ nombre: "Numeración única por código, circuito y punto de venta", ok: !errores.length, detalle: `${docs.length} documentos numerados`, errores });
  }

  return { ok: chequeos.every((c) => c.ok), chequeos };
}
