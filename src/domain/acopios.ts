/**
 * Acopios de clientes por MONTO con precios congelados.
 * El cliente deposita (o pacta) un importe, se le congela la lista de precios de la
 * unidad de negocio y va retirando con notas de pedido que descuentan del saldo.
 * Las devoluciones (DP) y los traspasos/ajustes (ACD) devuelven o mueven saldo.
 */
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Acopio, AjusteAcopio, DevolucionNP, EstadoAcopio, ItemNP, NotaPedido, Producto, Remito, Comprobante, Obra } from "./types";

const EPS = 0.005;

export function notasDelAcopio(acopioId: string, notas: NotaPedido[]): NotaPedido[] {
  return notas.filter((n) => n.acopioId === acopioId && n.tipo === "RETIRO_ACOPIO" && n.estado !== "ANULADA" && n.estado !== "BORRADOR");
}

/** Pendiente de entrega de una línea: cantidad − entregados − devueltos (nunca negativo). */
export function pendienteLinea(it: Pick<ItemNP, "cantidad" | "entregados" | "devueltos">): number {
  return Math.max(0, it.cantidad - it.entregados - (it.devueltos ?? 0));
}

/** Σ montos retirados (NP) − Σ devueltos (DP): lo efectivamente consumido del saldo. */
export function retiradoAcopio(acopioId: string, notas: NotaPedido[], devoluciones: DevolucionNP[]): number {
  const np = notasDelAcopio(acopioId, notas).reduce((a, n) => a + n.monto, 0);
  const dp = devoluciones.filter((d) => d.acopioId === acopioId).reduce((a, d) => a + d.monto, 0);
  return Math.round((np + dp) * 1000) / 1000;
}

/**
 * Saldo disponible = importe − Σ NP + Σ DP (montos negativos, suman) + Σ ACD.
 */
export function saldoDisponible(acopio: Pick<Acopio, "id" | "importe">, notas: NotaPedido[], devoluciones: DevolucionNP[], ajustes: AjusteAcopio[]): number {
  const ajuste = ajustes.filter((a) => a.acopioId === acopio.id).reduce((s, a) => s + a.monto, 0);
  return Math.round((acopio.importe - retiradoAcopio(acopio.id, notas, devoluciones) + ajuste) * 100) / 100 || 0;
}

export interface LineaMovimiento {
  itemId?: string;
  codigo: string;
  descripcion: string;
  obra: string;
  cantidad: number;
  entregados: number;
  /** Pendiente de entrega de la línea (cantidad − entregados). */
  saldo: number;
  remitos: { id?: string; numero: string }[];
  facturas: string[];
  precio: number;
  subtotal: number;
  /** Saldo corrido del acopio después de esta línea. */
  saldoDisponible: number;
  productoId?: string;
  obraId?: string;
}

export interface GrupoMovimiento {
  id: string;
  tipoDoc: "NP" | "DP" | "ACD";
  numero: string;
  fecha: string;
  monto: number;
  lineas: LineaMovimiento[];
}

interface CtxMov {
  productos: Producto[];
  obras: Obra[];
  remitos: Remito[];
  comprobantes: Comprobante[];
}

/**
 * Movimientos del acopio agrupados por documento (NP, DP, ACD) en orden cronológico,
 * con saldo disponible corrido línea a línea, como el documento "Detalle de acopio".
 */
export function movimientosAcopio(acopio: Acopio, notas: NotaPedido[], devoluciones: DevolucionNP[], ajustes: AjusteAcopio[], ctx: CtxMov): GrupoMovimiento[] {
  const prod = new Map(ctx.productos.map((p) => [p.id, p]));
  const obra = new Map(ctx.obras.map((o) => [o.id, o.nombre]));
  const remitosPorItem = new Map<string, { id?: string; numero: string }[]>();
  const facturasPorItem = new Map<string, string[]>();
  for (const r of ctx.remitos) {
    if (r.estado === "ANULADO") continue;
    for (const it of r.items) {
      if (!it.itemNPId) continue;
      const lr = remitosPorItem.get(it.itemNPId) ?? [];
      if (!lr.some((x) => x.numero === r.numero)) lr.push({ id: r.id, numero: r.numero });
      remitosPorItem.set(it.itemNPId, lr);
      const lf = facturasPorItem.get(it.itemNPId) ?? [];
      for (const f of r.facturasRef ?? []) if (!lf.includes(f)) lf.push(f);
      facturasPorItem.set(it.itemNPId, lf);
    }
  }
  type GrupoSinSaldo = Omit<GrupoMovimiento, "lineas"> & { _lineas: Omit<LineaMovimiento, "saldoDisponible">[] };
  const grupos: GrupoSinSaldo[] = [];
  for (const n of notasDelAcopio(acopio.id, notas)) {
    grupos.push({
      id: n.id,
      tipoDoc: "NP",
      numero: n.numero,
      fecha: n.fecha,
      monto: n.monto,
      _lineas: n.items.map((it) => {
        const p = prod.get(it.productoId);
        return {
          itemId: it.id,
          productoId: it.productoId,
          obraId: it.obraId,
          codigo: p?.codigo ?? "",
          descripcion: p?.nombre ?? "",
          obra: it.obraId ? obra.get(it.obraId) ?? "" : "",
          cantidad: it.cantidad,
          entregados: it.entregados,
          saldo: Math.max(0, it.cantidad - it.entregados),
          remitos: remitosPorItem.get(it.id) ?? [],
          facturas: facturasPorItem.get(it.id) ?? [],
          precio: it.precioUnitario,
          subtotal: it.subtotal,
        };
      }),
    });
  }
  for (const d of devoluciones.filter((x) => x.acopioId === acopio.id)) {
    const rd = ctx.remitos.find((r) => r.id === d.remitoDevolucionId);
    const nc = ctx.comprobantes.find((c) => c.id === d.notaCreditoId);
    grupos.push({
      id: d.id,
      tipoDoc: "DP",
      numero: d.numero,
      fecha: d.fecha,
      monto: d.monto,
      _lineas: d.items.map((it) => {
        const p = prod.get(it.productoId);
        return {
          productoId: it.productoId,
          obraId: it.obraId,
          codigo: p?.codigo ?? "",
          descripcion: p?.nombre ?? "",
          obra: it.obraId ? obra.get(it.obraId) ?? "" : "",
          cantidad: it.cantidad,
          entregados: 0,
          saldo: it.cantidad,
          remitos: rd ? [{ id: rd.id, numero: rd.numero }] : (d.remitosRef ?? []).map((numero) => ({ numero })),
          facturas: nc ? [nc.numero] : d.notasCreditoRef ?? [],
          precio: -it.precioUnitario,
          subtotal: -(it.subtotal ?? it.cantidad * it.precioUnitario),
        };
      }),
    });
  }
  for (const a of ajustes.filter((x) => x.acopioId === acopio.id)) {
    grupos.push({
      id: a.id,
      tipoDoc: "ACD",
      numero: a.numero,
      fecha: a.fecha,
      monto: -a.monto,
      _lineas: [{ codigo: "", descripcion: a.descripcion, obra: "", cantidad: 1, entregados: 0, saldo: 1, remitos: [{ numero: "0" }], facturas: [], precio: -a.monto, subtotal: -a.monto }],
    });
  }
  grupos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero));
  // El saldo corrido se acumula sin redondear (como el sistema original) y se redondea al mostrar.
  let saldo = acopio.importe;
  return grupos.map((g) => ({
    id: g.id,
    tipoDoc: g.tipoDoc,
    numero: g.numero,
    fecha: g.fecha,
    monto: g.monto,
    lineas: g._lineas.map((l) => {
      saldo -= l.subtotal;
      return { ...l, saldoDisponible: Math.round(saldo * 100) / 100 };
    }),
  }));
}

/** Pendiente de entrega del acopio, por producto (y obra). */
export function pendienteEntrega(acopioId: string, notas: NotaPedido[]): { productoId: string; obraId?: string; pendiente: number; precio: number; notaPedidoId: string; itemId: string }[] {
  const out: { productoId: string; obraId?: string; pendiente: number; precio: number; notaPedidoId: string; itemId: string }[] = [];
  for (const n of notasDelAcopio(acopioId, notas))
    for (const it of n.items) {
      const p = pendienteLinea(it);
      if (p > EPS) out.push({ productoId: it.productoId, obraId: it.obraId, pendiente: p, precio: it.precioUnitario, notaPedidoId: n.id, itemId: it.id });
    }
  return out;
}

/** $ pendiente de entrega (al precio congelado de cada línea). */
export function montoPendienteEntrega(acopioId: string, notas: NotaPedido[]): number {
  return pendienteEntrega(acopioId, notas).reduce((a, p) => a + p.pendiente * p.precio, 0);
}

export interface ResumenArticulo {
  productoId: string;
  codigo: string;
  articulo: string;
  precio: number;
  /** Reservada sin entregar: en remitos generados o en preparación (picking). */
  cantidad: number;
  /** Baja de artículos de la lista congelada (ajustes manuales; las devoluciones ya netean el saldo). */
  bajas: number;
  /** Devuelto por DP (informativo). */
  devueltos: number;
  /** Pendiente de entrega (retirado con NP y todavía no remitido). */
  pendiente: number;
  /** Negativo = total retirado neto (NP − DP). */
  saldo: number;
}

/**
 * Tabla final del detalle: todos los artículos de la lista congelada con sus saldos,
 * igual que el documento real (Cantidad = reservada, Saldo = −retirado neto).
 */
export function resumenArticulos(acopio: Acopio, notas: NotaPedido[], devoluciones: DevolucionNP[], productos: Producto[], remitos: Remito[] = []): ResumenArticulo[] {
  const prod = new Map(productos.map((p) => [p.id, p]));
  const pedido = new Map<string, number>();
  const pend = new Map<string, number>();
  const add = (m: Map<string, number>, k: string, q: number) => m.set(k, (m.get(k) ?? 0) + q);
  for (const n of notasDelAcopio(acopio.id, notas))
    for (const it of n.items) {
      add(pedido, it.productoId, it.cantidad);
      add(pend, it.productoId, pendienteLinea(it));
    }
  const reservado = new Map<string, number>();
  for (const r of remitos) if (r.acopioId === acopio.id && (r.estado === "PICKING" || r.estado === "INICIAL") && r.tipo === "DESACOPIO") for (const it of r.items) add(reservado, it.productoId, it.cantidad);
  const devueltos = new Map<string, number>();
  for (const d of devoluciones.filter((x) => x.acopioId === acopio.id)) for (const it of d.items) add(devueltos, it.productoId, it.cantidad);
  return acopio.preciosCongelados
    .map((pc) => {
      const p = prod.get(pc.productoId);
      return {
        productoId: pc.productoId,
        codigo: p?.codigo ?? "",
        articulo: p?.nombre ?? "",
        precio: pc.precio,
        cantidad: reservado.get(pc.productoId) ?? 0,
        bajas: 0,
        devueltos: devueltos.get(pc.productoId) ?? 0,
        pendiente: pend.get(pc.productoId) ?? 0,
        saldo: -((pedido.get(pc.productoId) ?? 0) - (devueltos.get(pc.productoId) ?? 0)),
      };
    })
    .sort((a, b) => Number(a.codigo) - Number(b.codigo) || a.codigo.localeCompare(b.codigo));
}

/** Estado derivado: CANCELADO se respeta; AGOTADO si saldo ≤ 0; VENCIDO si pasó la fecha con saldo. */
export function estadoDerivado(acopio: Pick<Acopio, "estado" | "fechaVencimiento">, hoy: Date, saldo: number): EstadoAcopio {
  if (acopio.estado === "CANCELADO") return "CANCELADO";
  if (saldo <= EPS) return "AGOTADO";
  if (differenceInCalendarDays(hoy, parseISO(acopio.fechaVencimiento)) > 0) return "VENCIDO";
  return "VIGENTE";
}

export function diasParaVencer(acopio: Pick<Acopio, "fechaVencimiento">, hoy: Date): number {
  return differenceInCalendarDays(parseISO(acopio.fechaVencimiento), hoy);
}

/** Lo pagado del acopio: Σ (total − saldo) de sus comprobantes. */
export function pagadoAcopio(acopio: Pick<Acopio, "comprobanteIds">, comprobantes: Comprobante[]): number {
  return comprobantes.filter((c) => acopio.comprobanteIds.includes(c.id) && c.estado !== "ANULADO").reduce((a, c) => a + (c.total - c.saldoPendiente), 0);
}

export interface ValidacionRetiro {
  ok: boolean;
  saldoAntes: number;
  saldoDespues: number;
  /** Para acopios en cuenta corriente: cuánto pagó vs cuánto lleva retirado (incluido este retiro). */
  pagado?: number;
  retiradoTotal?: number;
}

/** El monto del retiro no puede superar el saldo disponible (salvo autorización). */
export function validarRetiro(saldoActual: number, montoRetiro: number, info?: { pagado: number; retirado: number; formaPago: Acopio["formaPago"] }): ValidacionRetiro {
  const saldoDespues = Math.round((saldoActual - montoRetiro) * 100) / 100;
  return {
    ok: saldoDespues >= -EPS,
    saldoAntes: saldoActual,
    saldoDespues,
    ...(info?.formaPago === "CUENTA_CORRIENTE" ? { pagado: info.pagado, retiradoTotal: info.retirado + montoRetiro } : {}),
  };
}

/** Precio congelado de un producto en el acopio (undefined si no está en la lista). */
export function precioCongelado(acopio: Pick<Acopio, "preciosCongelados">, productoId: string) {
  return acopio.preciosCongelados.find((p) => p.productoId === productoId);
}
