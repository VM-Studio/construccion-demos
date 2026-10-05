/**
 * Operaciones transaccionales reutilizadas por varias slices.
 * Todas reciben la transacción y aplican reglas de `src/domain`.
 */
import { addDays, parseISO } from "date-fns";
import type { Acopio, Comprobante, Despacho, ItemVenta, Pedido, TipoComprobante } from "@/domain/types";
import { calcularComprometido, pendienteDespachoItem } from "@/domain/stock";
import { estadoDerivado } from "@/domain/acopios";
import { diasCondicionPago, tipoFacturaPara } from "@/domain/ventas";
import { estadoPorSaldo } from "@/domain/cuentasCorrientes";
import { formatQty } from "@/lib/format";
import { newId } from "@/lib/utils";
import { ErrorNegocio, r2 } from "./helpers";
import type { Tx } from "./tx";

export function comprometido(tx: Tx, productoId: string, depositoId: string) {
  return calcularComprometido(productoId, depositoId, tx.get("pedidos"), tx.get("acopios"), tx.get("despachos"));
}

export function disponible(tx: Tx, productoId: string, depositoId: string) {
  return tx.fisico(productoId, depositoId) - comprometido(tx, productoId, depositoId);
}

export function nombreProducto(tx: Tx, productoId: string) {
  const p = tx.find("productos", productoId);
  return p ? `${p.codigo} ${p.nombre}` : productoId;
}

export function puntoVentaDe(tx: Tx, sucursalId: string) {
  return tx.find("sucursales", sucursalId)?.puntoVenta ?? "0001";
}

/** Cantidad de un ítem de pedido incluida en despachos activos aún sin egreso. */
export function enDespachosPendientes(tx: Tx, pedidoId: string, itemId: string) {
  let q = 0;
  for (const d of tx.get("despachos")) {
    if (d.origenTipo !== "PEDIDO" || d.origenId !== pedidoId || d.egresoGenerado || d.estado === "CANCELADO") continue;
    for (const it of d.items) if (it.itemOrigenId === itemId) q += it.cantidad;
  }
  return q;
}

/** Cantidad que todavía se puede incluir en un nuevo despacho. */
export function pendienteDeProgramar(tx: Tx, pedido: Pedido, item: ItemVenta) {
  return Math.max(0, pendienteDespachoItem(item) - enDespachosPendientes(tx, pedido.id, item.id));
}

/**
 * Genera los egresos de stock de un despacho (EGRESO_VENTA o EGRESO_ACOPIO)
 * y marca lo despachado en el pedido. Valida stock físico suficiente.
 */
export function confirmarEgresoDeDespacho(tx: Tx, despachoId: string, fecha = tx.ahora) {
  const d = tx.must("despachos", despachoId);
  if (d.egresoGenerado) return d;
  for (const it of d.items) {
    const fis = tx.fisico(it.productoId, d.depositoId);
    if (fis + 1e-9 < it.cantidad) {
      const dep = tx.find("depositos", d.depositoId)?.nombre ?? "el depósito";
      const unidad = tx.find("productos", it.productoId)?.unidad ?? "UN";
      throw new ErrorNegocio(`Sin stock físico suficiente de ${nombreProducto(tx, it.productoId)} en ${dep} (hay ${formatQty(fis, unidad)}). Transferí o ingresá mercadería primero.`, "SIN_STOCK");
    }
  }
  const tipo = d.origenTipo === "PEDIDO" ? "EGRESO_VENTA" : "EGRESO_ACOPIO";
  for (const it of d.items)
    tx.movimiento({
      productoId: it.productoId,
      depositoId: d.depositoId,
      tipo,
      cantidad: it.cantidad,
      signo: -1,
      referenciaTipo: "DESPACHO",
      referenciaId: d.id,
      fecha,
    });
  if (d.origenTipo === "PEDIDO") {
    tx.patch("pedidos", d.origenId, (p) => ({
      ...p,
      items: p.items.map((i) => {
        const q = d.items.filter((x) => x.itemOrigenId === i.id).reduce((a, x) => a + x.cantidad, 0);
        return q ? { ...i, cantidadDespachada: (i.cantidadDespachada ?? 0) + q } : i;
      }),
    }));
  }
  return tx.patch("despachos", d.id, { egresoGenerado: true, fechaSalida: fecha });
}

/** Recalcula el estado del pedido según lo entregado (no pisa FACTURADO ni CANCELADO). */
export function actualizarEstadoPedido(tx: Tx, pedidoId: string) {
  const p = tx.must("pedidos", pedidoId);
  if (p.estado === "CANCELADO" || p.estado === "BORRADOR") return;
  const entregado = new Map<string, number>();
  let hayActivos = false;
  for (const d of tx.get("despachos")) {
    if (d.origenTipo !== "PEDIDO" || d.origenId !== p.id || d.estado === "CANCELADO") continue;
    if (d.estado === "ENTREGADO" || d.estado === "RETIRADO_EN_MOSTRADOR") {
      for (const it of d.items) if (it.itemOrigenId) entregado.set(it.itemOrigenId, (entregado.get(it.itemOrigenId) ?? 0) + (it.cantidadEntregada ?? it.cantidad));
    } else hayActivos = true;
  }
  const totalEntregado = [...entregado.values()].reduce((a, b) => a + b, 0);
  const completo = p.items.every((i) => (entregado.get(i.id) ?? 0) + 1e-9 >= i.cantidad);
  if (p.estado === "FACTURADO") return;
  let estado = p.estado;
  if (completo) estado = "DESPACHADO";
  else if (totalEntregado > 0) estado = "DESPACHADO_PARCIAL";
  else if (hayActivos) estado = "EN_PREPARACION";
  else estado = "CONFIRMADO";
  if (estado !== p.estado) tx.patch("pedidos", p.id, { estado });
}

/** Recalcula el estado derivado de un acopio. */
export function actualizarEstadoAcopio(tx: Tx, acopioId: string) {
  const a = tx.must("acopios", acopioId);
  const e = estadoDerivado(a, new Date());
  if (e !== a.estado) tx.patch("acopios", a.id, { estado: e });
}

/** Crea una factura de venta (A o B según el cliente) para un pedido o acopio. */
export function crearFacturaVenta(
  tx: Tx,
  opts: {
    clienteId: string;
    sucursalId: string;
    tipo?: TipoComprobante;
    fecha?: string;
    vencimiento?: string;
    neto: number;
    iva: number;
    total: number;
    pedidoId?: string;
    acopioId?: string;
    items?: ItemVenta[];
    condicionPago?: string;
    observaciones?: string;
  },
): Comprobante {
  const cliente = tx.must("clientes", opts.clienteId);
  const tipo = opts.tipo ?? tipoFacturaPara(cliente.condicionIVA);
  const fecha = opts.fecha ?? tx.ahora;
  const venc = opts.vencimiento ?? addDays(parseISO(fecha), diasCondicionPago(opts.condicionPago ?? cliente.condicionPago)).toISOString();
  const c: Comprobante = {
    id: newId("cmp"),
    tipo,
    numero: tx.numeroFiscal(puntoVentaDe(tx, opts.sucursalId), tipo),
    clienteId: cliente.id,
    pedidoId: opts.pedidoId,
    acopioId: opts.acopioId,
    sucursalId: opts.sucursalId,
    fecha,
    vencimiento: venc,
    subtotal: r2(opts.neto),
    iva: r2(opts.iva),
    total: r2(opts.total),
    saldoPendiente: r2(opts.total),
    estado: "PENDIENTE",
    items: opts.items,
    observaciones: opts.observaciones,
    ...tx.meta(),
  };
  tx.insert("comprobantes", c);
  return c;
}

/** Aplica un importe a un comprobante (cobro, pago o nota de crédito). */
export function aplicarAComprobante(tx: Tx, comprobanteId: string, importe: number) {
  const c = tx.must("comprobantes", comprobanteId);
  if (c.estado === "ANULADO") throw new ErrorNegocio(`El comprobante ${c.numero} está anulado.`);
  if (importe > c.saldoPendiente + 0.01) throw new ErrorNegocio(`El importe imputado supera el saldo de ${c.numero}.`);
  const saldo = r2(c.saldoPendiente - importe);
  tx.patch("comprobantes", c.id, { saldoPendiente: saldo, estado: estadoPorSaldo(c.total, saldo) });
  if (c.acopioId) recalcularPagadoAcopio(tx, c.acopioId);
}

/** montoPagado del acopio = Σ cobranzas imputadas a sus comprobantes. */
export function recalcularPagadoAcopio(tx: Tx, acopioId: string) {
  const a = tx.must("acopios", acopioId);
  const ids = new Set(a.comprobanteIds ?? (a.comprobanteId ? [a.comprobanteId] : []));
  let pagado = 0;
  for (const cob of tx.get("cobranzas")) for (const i of cob.imputaciones) if (ids.has(i.comprobanteId)) pagado += i.importe;
  tx.patch("acopios", a.id, { montoPagado: r2(pagado) });
}

/** Valor a precio pactado (sin IVA) de lo ya retirado de un acopio. */
export function valorRetirado(a: Acopio) {
  return a.items.reduce((s, i) => s + i.cantidadRetirada * i.precioUnitarioPactado, 0);
}

export function despachoDe(tx: Tx, id: string): Despacho {
  return tx.must("despachos", id);
}
