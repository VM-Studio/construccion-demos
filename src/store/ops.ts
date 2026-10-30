/**
 * Operaciones transaccionales reutilizadas por varias slices.
 * Todas reciben la transacción y aplican reglas de `src/domain`.
 */
import { addDays, parseISO } from "date-fns";
import type { Circuito, Cliente, Comprobante, CondicionIVA, ItemVenta, MedioCobro, MovimientoCaja, NotaPedido, Remito } from "@/domain/types";
import { validarCUIT, buscarPorCuit } from "@/domain/cuit";
import { cajaPorDefecto } from "@/domain/caja";
import { calcularDisponible, calcularPendienteEntrega, calcularReservado, lineasPendientes } from "@/domain/stock";
import { estadoDerivado, pendienteLinea, saldoDisponible } from "@/domain/acopios";
import { diasCondicionPago, letraFacturaPara } from "@/domain/ventas";
import { estadoPorSaldo } from "@/domain/cuentasCorrientes";
import { formatQty } from "@/lib/format";
import { newId } from "@/lib/utils";
import { ErrorNegocio, r2 } from "./helpers";
import type { Tx } from "./tx";

export function nombreProducto(tx: Tx, productoId: string) {
  const p = tx.find("productos", productoId);
  return p ? `${p.codigo} ${p.nombre}` : productoId;
}

export function puntoVentaDe(tx: Tx, sucursalId: string) {
  return tx.find("sucursales", sucursalId)?.puntoVenta ?? "0001";
}

export function puntoVentaRemitoDe(tx: Tx, sucursalId: string) {
  return tx.find("sucursales", sucursalId)?.puntoVentaRemito ?? "00016";
}

/** Pendiente de entrega (NP confirmadas sin remitir, fuera de picking). */
export function pendienteEntrega(tx: Tx, productoId: string, depositoId: string) {
  return calcularPendienteEntrega(productoId, depositoId, tx.get("notasPedido"), tx.get("remitos"));
}

/** Reservado: remitos en picking. */
export function reservado(tx: Tx, productoId: string, depositoId: string) {
  return calcularReservado(productoId, depositoId, tx.get("remitos"));
}

/** Disponible para vender = físico − pendiente de entrega − reservado. */
export function disponible(tx: Tx, productoId: string, depositoId: string) {
  return calcularDisponible(tx.fisico(productoId, depositoId), pendienteEntrega(tx, productoId, depositoId), reservado(tx, productoId, depositoId));
}

/** Mensaje estándar de sobreventa. */
export function mensajeSinDisponible(tx: Tx, productoId: string, depositoId: string, pedido: number) {
  const u = tx.find("productos", productoId)?.unidad ?? "UN";
  const dep = tx.find("depositos", depositoId)?.nombre ?? "el depósito";
  const fis = tx.fisico(productoId, depositoId);
  const pend = pendienteEntrega(tx, productoId, depositoId) + reservado(tx, productoId, depositoId);
  return `No hay disponible suficiente de ${nombreProducto(tx, productoId)} en ${dep}: físico ${formatQty(fis, u)}, pendiente de entrega ${formatQty(pend, u)}, disponible ${formatQty(Math.max(0, fis - pend), u)} (pedido ${formatQty(pedido, u)}).`;
}

/** Recalcula estado y bandera de pendiente de entrega de una NP (no toca BORRADOR ni ANULADA). */
export function actualizarEstadoNP(tx: Tx, npId: string) {
  const np = tx.must("notasPedido", npId);
  if (np.estado === "BORRADOR" || np.estado === "ANULADA") return np;
  const pend = np.items.some((i) => pendienteLinea(i) > 0.0005);
  const algo = np.items.some((i) => i.entregados > 0);
  const estado: NotaPedido["estado"] = !pend ? "ENTREGADA" : algo ? "ENTREGADA_PARCIAL" : "PENDIENTE";
  // pendienteEntrega es la intención del vendedor (retira después / entrega programada); se apaga al completar.
  const pendienteEntrega = pend && np.pendienteEntrega;
  if (estado !== np.estado || pendienteEntrega !== np.pendienteEntrega) return tx.patch("notasPedido", np.id, { estado, pendienteEntrega });
  return np;
}

/** Saldo disponible actual de un acopio. */
export function saldoAcopio(tx: Tx, acopioId: string) {
  const a = tx.must("acopios", acopioId);
  return saldoDisponible(a, tx.get("notasPedido"), tx.get("devoluciones"), tx.get("ajustesAcopio"));
}

/** Recalcula el estado derivado de un acopio (vigente / vencido / agotado). */
export function actualizarEstadoAcopio(tx: Tx, acopioId: string) {
  const a = tx.must("acopios", acopioId);
  const e = estadoDerivado(a, new Date(), saldoAcopio(tx, acopioId));
  if (e !== a.estado) tx.patch("acopios", a.id, { estado: e });
}

/** Cantidad pendiente de una línea que todavía no está en ningún remito abierto (INICIAL/PICKING). */
export function pendienteSinRemito(tx: Tx, np: NotaPedido, itemId: string) {
  const it = np.items.find((i) => i.id === itemId);
  if (!it) return 0;
  let enRemitos = 0;
  for (const r of tx.get("remitos"))
    if ((r.estado === "INICIAL" || r.estado === "PICKING") && r.notaPedidoId === np.id) for (const x of r.items) if (x.itemNPId === itemId) enRemitos += x.cantidad;
  return Math.max(0, pendienteLinea(it) - enRemitos);
}

/** Crea un remito de venta o desacopio para una NP (estado INICIAL, PICKING o HECHO). */
export function crearRemitoNP(tx: Tx, npId: string, lineas: { itemId: string; cantidad: number }[] | null, estado: "INICIAL" | "PICKING" | "HECHO", fecha = tx.ahora): Remito {
  const np = tx.must("notasPedido", npId);
  if (np.estado === "BORRADOR" || np.estado === "ANULADA") throw new ErrorNegocio("La nota de pedido no está confirmada.");
  const ls = (lineas ?? np.items.map((i) => ({ itemId: i.id, cantidad: pendienteSinRemito(tx, np, i.id) }))).filter((l) => l.cantidad > 0);
  if (!ls.length) throw new ErrorNegocio("No hay cantidades pendientes para remitir.");
  for (const l of ls) {
    const max = pendienteSinRemito(tx, np, l.itemId);
    if (l.cantidad > max + 1e-9) throw new ErrorNegocio(`${nombreProducto(tx, np.items.find((i) => i.id === l.itemId)?.productoId ?? "")}: se pueden remitir hasta ${max}.`);
  }
  const items = ls.map((l) => {
    const it = np.items.find((i) => i.id === l.itemId)!;
    return { productoId: it.productoId, cantidad: l.cantidad, itemNPId: it.id, obraId: it.obraId };
  });
  const r: Remito = {
    id: newId("rem"),
    numero: tx.numero("RM", np.circuito, puntoVentaRemitoDe(tx, np.sucursalId)),
    circuito: np.circuito,
    tipo: np.origen === "ACOPIO" ? "DESACOPIO" : "VENTA",
    notaPedidoId: np.id,
    acopioId: np.acopioId,
    clienteId: np.clienteId,
    obraId: items.find((i) => i.obraId)?.obraId,
    sucursalId: np.sucursalId,
    depositoId: np.depositoId,
    fecha,
    direccionEntrega: np.direccionEntrega,
    items,
    cantidadTotal: items.reduce((a, i) => a + i.cantidad, 0),
    pesoTotalKg: Math.round(items.reduce((a, i) => a + i.cantidad * (tx.find("productos", i.productoId)?.pesoKg ?? 0), 0)),
    valorDeclarado: r2(items.reduce((a, i) => a + i.cantidad * (np.items.find((x) => x.id === i.itemNPId)?.precioUnitario ?? 0), 0)),
    estado: "INICIAL",
    facturado: np.origen === "ACOPIO" || tx.get("comprobantes").some((c) => np.comprobanteIds.includes(c.id) && c.tipo === "FACTURA" && c.estado !== "ANULADO"),
    facturasRef: tx.get("comprobantes").filter((c) => np.comprobanteIds.includes(c.id) && c.tipo === "FACTURA").map((c) => c.numero),
    ...tx.meta(),
  };
  tx.insert("remitos", r);
  tx.patch("notasPedido", np.id, { remitoIds: [...np.remitoIds, r.id] });
  tx.auditar("Generó remito", "Remito", r.id, `${r.numero} · ${np.numero}`);
  if (estado === "PICKING" || estado === "HECHO") pasarAPicking(tx, r.id);
  if (estado === "HECHO") marcarHecho(tx, r.id, fecha);
  return tx.must("remitos", r.id);
}

export function pasarAPicking(tx: Tx, remitoId: string) {
  const r = tx.must("remitos", remitoId);
  if (r.estado !== "INICIAL") throw new ErrorNegocio("Solo se puede iniciar el picking de un remito en estado Inicial.");
  tx.patch("remitos", r.id, { estado: "PICKING" });
  tx.auditar("Inició picking", "Remito", r.id, r.numero);
}

/**
 * Marca un remito como HECHO: genera los movimientos de stock (egreso de venta o
 * desacopio; ingreso si es devolución), actualiza `entregados` en la NP y su estado.
 */
export function marcarHecho(tx: Tx, remitoId: string, fecha = tx.ahora) {
  const r = tx.must("remitos", remitoId);
  if (r.estado === "HECHO") return r;
  if (r.estado === "ANULADO") throw new ErrorNegocio("El remito está anulado.");
  if (r.tipo === "VENTA" || r.tipo === "DESACOPIO") {
    for (const it of r.items) {
      if (it.cantidad <= 0) continue;
      const fis = tx.fisico(it.productoId, r.depositoId);
      if (fis + 1e-9 < it.cantidad) {
        const dep = tx.find("depositos", r.depositoId)?.nombre ?? "el depósito";
        const u = tx.find("productos", it.productoId)?.unidad ?? "UN";
        throw new ErrorNegocio(`Sin stock físico suficiente de ${nombreProducto(tx, it.productoId)} en ${dep} (hay ${formatQty(fis, u)}). Transferí o ingresá mercadería primero.`, "SIN_STOCK");
      }
    }
    for (const it of r.items)
      if (it.cantidad > 0)
        tx.movimiento({ productoId: it.productoId, depositoId: r.depositoId, tipo: r.tipo === "DESACOPIO" ? "EGRESO_ACOPIO" : "EGRESO_VENTA", cantidad: it.cantidad, signo: -1, referenciaTipo: "REMITO", referenciaId: r.id, fecha });
  } else if (r.tipo === "DEVOLUCION") {
    for (const it of r.items)
      if (it.cantidad > 0) tx.movimiento({ productoId: it.productoId, depositoId: r.depositoId, tipo: "DEVOLUCION_CLIENTE", cantidad: it.cantidad, signo: 1, referenciaTipo: "REMITO", referenciaId: r.id, fecha });
  }
  tx.patch("remitos", r.id, { estado: "HECHO", fechaEntrega: fecha, stockAplicado: true });
  if (r.notaPedidoId && (r.tipo === "VENTA" || r.tipo === "DESACOPIO")) {
    const signo = 1;
    tx.patch("notasPedido", r.notaPedidoId, (np) => ({
      ...np,
      items: np.items.map((i) => {
        const q = r.items.filter((x) => x.itemNPId === i.id).reduce((a, x) => a + x.cantidad, 0);
        return q ? { ...i, entregados: i.entregados + signo * q } : i;
      }),
    }));
    actualizarEstadoNP(tx, r.notaPedidoId);
  }
  tx.auditar("Marcó remito como hecho", "Remito", r.id, `${r.numero}${r.tipo === "DEVOLUCION" ? " · reingreso de stock" : " · egreso de stock"}`);
  return tx.must("remitos", r.id);
}

/** Factura de venta: F1 (letra A/B según condición de IVA) o F2 interna sin IVA. */
export function crearFacturaVenta(
  tx: Tx,
  o: {
    clienteId: string;
    sucursalId: string;
    circuito: Circuito;
    fecha?: string;
    total: number;
    neto?: number;
    npId?: string;
    acopioId?: string;
    items?: ItemVenta[];
    vencimientoDias?: number;
    observaciones?: string;
    datosFactura?: Pick<Comprobante, "ventaML" | "compradorNombre" | "compradorDoc">;
  },
): Comprobante {
  const c = tx.must("clientes", o.clienteId);
  const fecha = o.fecha ?? tx.ahora;
  const subtotal = o.neto ?? (o.circuito === 1 ? r2(o.total / (1 + tx.config.ivaPct / 100)) : r2(o.total));
  const cmp: Comprobante = {
    id: newId("cmp"),
    tipo: "FACTURA",
    letra: o.circuito === 1 ? letraFacturaPara(c.condicionIVA) : undefined,
    circuito: o.circuito,
    numero: tx.numero("F", o.circuito, puntoVentaDe(tx, o.sucursalId)),
    clienteId: c.id,
    notaPedidoId: o.npId,
    acopioId: o.acopioId,
    sucursalId: o.sucursalId,
    fecha,
    vencimiento: addDays(parseISO(fecha), o.vencimientoDias ?? diasCondicionPago(c.condicionPago)).toISOString(),
    subtotal: r2(subtotal),
    iva: r2(o.total - subtotal),
    total: r2(o.total),
    saldoPendiente: r2(o.total),
    estado: "PENDIENTE",
    items: o.items,
    observaciones: o.observaciones,
    // F1 va a ARCA (factura electrónica); F2 es interna.
    arcaEstado: o.circuito === 1 ? "PENDIENTE" : "NO_APLICA",
    ...o.datosFactura,
    ...tx.meta(),
  };
  tx.insert("comprobantes", cmp);
  return cmp;
}

/** Aplica un importe a un comprobante (cobro, pago o nota de crédito). */
export function aplicarAComprobante(tx: Tx, comprobanteId: string, importe: number) {
  const c = tx.must("comprobantes", comprobanteId);
  if (c.estado === "ANULADO") throw new ErrorNegocio(`El comprobante ${c.numero} está anulado.`);
  if (importe > c.saldoPendiente + 0.01) throw new ErrorNegocio(`El importe imputado supera el saldo de ${c.numero}.`);
  const saldo = r2(c.saldoPendiente - importe);
  tx.patch("comprobantes", c.id, { saldoPendiente: saldo, estado: estadoPorSaldo(c.total, saldo) });
  if (c.acopioProveedorId) {
    const acp = tx.must("acopiosProveedor", c.acopioProveedorId);
    tx.patch("acopiosProveedor", acp.id, { pagado: r2(acp.pagado + importe) });
  }
}

/** Inverso de aplicarAComprobante: al anular un recibo u orden de pago, el saldo vuelve. */
export function desaplicarDeComprobante(tx: Tx, comprobanteId: string, importe: number) {
  const c = tx.find("comprobantes", comprobanteId);
  if (!c) return;
  if (c.estado !== "ANULADO") {
    const saldo = r2(Math.min(c.total, c.saldoPendiente + importe));
    tx.patch("comprobantes", c.id, { saldoPendiente: saldo, estado: estadoPorSaldo(c.total, saldo) });
  }
  if (c.acopioProveedorId) {
    const acp = tx.find("acopiosProveedor", c.acopioProveedorId);
    if (acp) tx.patch("acopiosProveedor", acp.id, { pagado: r2(Math.max(0, acp.pagado - importe)) });
  }
}

/** Líneas pendientes de entrega de un cliente (o de todos). */
export function pendientesDe(tx: Tx, clienteId?: string) {
  return lineasPendientes(tx.get("notasPedido"), tx.get("remitos")).filter((l) => !clienteId || l.clienteId === clienteId);
}

// ───────────────────────── Clientes desde ventas ─────────────────────────

export interface DatosClienteVenta {
  razonSocial: string;
  cuit?: string;
  condicionIVA?: CondicionIVA;
  telefono?: string;
  email?: string;
  direccion?: string;
  localidad?: string;
  tipo?: string;
}

/** Lista de precios sugerida para un tipo de cliente nuevo. */
export function listaPorTipo(tx: Tx, tipo: string): string {
  const ids = new Set(tx.get("listasPrecios").filter((l) => l.activa && !l.clienteId).map((l) => l.id));
  const pref = tipo === "CONSUMIDOR_FINAL" || tipo === "PARTICULAR" ? "lst_pub" : tipo === "MAYORISTA" || tipo === "CONSTRUCTORA" ? "lst_may" : "lst_gen";
  return ids.has(pref) ? pref : [...ids][0] ?? "lst_gen";
}

/**
 * Alta de cliente desde una venta (cotización rápida aceptada, Mercado Libre). Si ya existe un
 * cliente con ese CUIT se usa ese. El CUIT es opcional; si se carga tiene que ser válido.
 */
export function crearClienteDesdeVenta(tx: Tx, d: DatosClienteVenta): Cliente {
  const razon = d.razonSocial.trim();
  if (!razon) throw new ErrorNegocio("Cargá el nombre o la razón social del cliente.");
  const cuit = (d.cuit ?? "").trim();
  if (cuit) {
    const err = validarCUIT(cuit);
    if (err) throw new ErrorNegocio(err);
    const existente = buscarPorCuit(tx.get("clientes"), cuit);
    if (existente) return existente;
  }
  const tipo = d.tipo || (cuit ? "MAYORISTA" : "CONSUMIDOR_FINAL");
  const max = tx.get("clientes").reduce((m, c) => Math.max(m, Number(c.codigo.replace(/\D/g, "")) || 0), 0);
  const suc = tx.get("sucursales").find((s) => s.id === tx.find("usuarios", tx.usuarioId)?.sucursalId) ?? tx.get("sucursales")[0];
  const cli: Cliente = {
    id: newId("cli"),
    codigo: `C${String(max + 1).padStart(4, "0")}`,
    razonSocial: razon,
    tipo,
    cuit,
    condicionIVA: d.condicionIVA ?? (cuit ? "RI" : "CF"),
    circuitoHabitual: 1,
    email: d.email?.trim() ?? "",
    telefono: d.telefono?.trim() ?? "",
    direccion: d.direccion?.trim() ?? "",
    localidad: d.localidad?.trim() ?? "",
    listaPreciosId: listaPorTipo(tx, tipo),
    condicionPago: "CONTADO",
    limiteCredito: 0,
    sucursalPreferidaId: suc?.id ?? "suc_central",
    activo: true,
    ...tx.meta(),
  };
  tx.insert("clientes", cli);
  tx.auditar("Creó cliente", "Cliente", cli.id, `${razon} · desde una venta`);
  return cli;
}

// ───────────────────────── Caja chica ─────────────────────────

/** Movimiento de caja de un medio en efectivo (cobro: entra; pago: sale). */
export function movimientoCajaDeMedio(tx: Tx, m: MedioCobro, o: { signo: 1 | -1; fecha: string; concepto: string; referenciaTipo: "RECIBO" | "ORDEN_PAGO"; referenciaId: string; sucursalId?: string }) {
  if (m.medio !== "EFECTIVO") return;
  const caja = m.cajaId ? tx.find("cajas", m.cajaId) : cajaPorDefecto(tx.get("cajas"), o.sucursalId);
  if (!caja) return;
  if (!caja.activa) throw new ErrorNegocio(`La caja ${caja.nombre} está desactivada.`);
  m.cajaId = caja.id;
  const usd = m.moneda === "USD";
  const mov: MovimientoCaja = {
    id: newId("mcj"),
    cajaId: caja.id,
    fecha: o.fecha,
    tipo: o.signo === 1 ? "INGRESO" : "EGRESO",
    signo: o.signo,
    moneda: usd ? "USD" : "ARS",
    importe: usd ? r2(m.importeME ?? 0) : r2(m.importe),
    concepto: o.concepto,
    referenciaTipo: o.referenciaTipo,
    referenciaId: o.referenciaId,
    usuarioId: tx.usuarioId,
    ...tx.meta(),
  };
  tx.insert("movimientosCaja", mov);
}

/** Anula los movimientos de caja generados por un recibo u orden de pago. */
export function anularMovimientosDe(tx: Tx, referenciaId: string, motivo: string) {
  for (const m of tx.get("movimientosCaja")) if (m.referenciaId === referenciaId && !m.anulado) tx.patch("movimientosCaja", m.id, { anulado: true, motivoAnulacion: motivo });
}

/** Normaliza los medios: dólares → pesos con el tipo de cambio cargado; valida cheques. */
export function normalizarMedios(medios: MedioCobro[], validarCheques = true): MedioCobro[] {
  const out = medios
    .map((m) => {
      if (m.medio === "EFECTIVO" && m.moneda === "USD") {
        if (!(m.importeME && m.importeME > 0)) throw new ErrorNegocio("Cargá cuántos dólares se recibieron.");
        if (!(m.tipoCambio && m.tipoCambio > 0)) throw new ErrorNegocio("Cargá el tipo de cambio del día para los dólares.");
        return { ...m, importe: r2(m.importeME * m.tipoCambio) };
      }
      const { moneda: _m, importeME: _i, tipoCambio: _t, ...resto } = m;
      void _m;
      void _i;
      void _t;
      return { ...resto };
    })
    .filter((m) => m.importe > 0);
  if (!out.length) throw new ErrorNegocio("Agregá al menos un medio de pago con importe.");
  if (validarCheques)
    for (const m of out)
      if ((m.medio === "CHEQUE" || m.medio === "ECHEQ") && !m.chequeId && (!m.banco || !m.numeroCheque || !m.fechaCobro))
      throw new ErrorNegocio("Para cheques completá banco, número y fecha de cobro.");
  return out;
}

/** Cliente genérico de las ventas por Mercado Libre (el comprador real va en la factura). */
export const CLIENTE_MELI = "__MELI__";
export function clienteMercadoLibre(tx: Tx): Cliente {
  const ex = tx.get("clientes").find((c) => c.codigo === "MELI");
  if (ex) return ex;
  const suc = tx.get("sucursales")[0];
  const cli: Cliente = {
    id: newId("cli"),
    codigo: "MELI",
    razonSocial: "Mercado Libre (ventas online)",
    tipo: "MELI",
    cuit: "",
    condicionIVA: "CF",
    circuitoHabitual: 1,
    email: "",
    telefono: "",
    direccion: "",
    localidad: "",
    listaPreciosId: listaPorTipo(tx, "CONSUMIDOR_FINAL"),
    condicionPago: "CONTADO",
    limiteCredito: 0,
    sucursalPreferidaId: suc?.id ?? "suc_central",
    activo: true,
    ...tx.meta(),
  };
  tx.insert("clientes", cli);
  tx.auditar("Creó cliente", "Cliente", cli.id, cli.razonSocial);
  return cli;
}
