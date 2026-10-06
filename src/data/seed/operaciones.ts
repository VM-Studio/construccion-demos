/**
 * Operaciones del seed de Aceros RNF (últimos ~6 meses, relativas a hoy):
 * acopios de clientes por monto (incluido el de Ramos, fiel al documento real),
 * notas de pedido (retiros de acopio y ventas nuevas) con sus remitos, devoluciones,
 * comprobantes, recibos, cotizaciones, compras y acopios con proveedores, despachos
 * de hoy con tiempos reales, transferencias y ajustes.
 * Determinístico: usa el PRNG del seed.
 */
import type {
  Acopio,
  AcopioProveedor,
  Adjunto,
  AjusteAcopio,
  AjusteStock,
  Auditoria,
  Cheque,
  Circuito,
  Cliente,
  Cobranza,
  CodigoDoc,
  Comprobante,
  Cotizacion,
  Deposito,
  Despacho,
  DevolucionNP,
  EstadoDespacho,
  EstadoRemito,
  FormaPagoAcopio,
  HojaRuta,
  ItemNP,
  ItemOC,
  MedioCobro,
  ModalidadEntrega,
  NotaPedido,
  Obra,
  OrdenCompra,
  PagoProveedor,
  PrecioCongelado,
  Producto,
  Proveedor,
  RecepcionMercaderia,
  Remito,
  Sucursal,
  TransferenciaStock,
} from "@/domain/types";
import { formatearDoc } from "@/domain/numeracion";
import { diasCondicionPago, letraFacturaPara } from "@/domain/ventas";
import { pendienteLinea } from "@/domain/acopios";
import { round2 } from "@/lib/utils";
import type { ProductoSpec } from "./catalogo";
import type { Calendario, Random } from "./util";
import { RAMOS_DOCS, RAMOS_FACTURA, RAMOS_IMPORTE, RAMOS_MONTOS, RAMOS_RECIBOS, RAMOS_VENCE_DIA } from "./ramos";

export interface EntradaOps {
  R: Random;
  cal: Calendario;
  ahora: Date;
  productos: Producto[];
  specs: Map<string, ProductoSpec>;
  clientes: Cliente[];
  obras: Obra[];
  proveedores: Proveedor[];
  sucursales: Sucursal[];
  depositos: Deposito[];
  /** Precio de lista vigente hoy (sin IVA). */
  precioHoy: (productoId: string, listaId: string) => number;
}

export interface SalidaOps {
  acopios: Acopio[];
  notasPedido: NotaPedido[];
  devoluciones: DevolucionNP[];
  ajustesAcopio: AjusteAcopio[];
  remitos: Remito[];
  adjuntos: Adjunto[];
  comprobantes: Comprobante[];
  cobranzas: Cobranza[];
  cheques: Cheque[];
  cotizaciones: Cotizacion[];
  acopiosProveedor: AcopioProveedor[];
  ordenesCompra: OrdenCompra[];
  recepciones: RecepcionMercaderia[];
  pagosProveedores: PagoProveedor[];
  despachos: Despacho[];
  hojasRuta: HojaRuta[];
  transferencias: TransferenciaStock[];
  ajustes: AjusteStock[];
  auditoria: Auditoria[];
  /** Números de documentos propios (para inicializar los numeradores). */
  numeros: string[];
  /** Líneas de NP que tienen que quedar con disponible justo (caso límite de la demo). */
  casoLimite: { productoId: string; depositoId: string; disponible: number };
}

// Último número usado al empezar el período del seed, por código (circuito 2, punto de venta 0001).
const BASE: Partial<Record<CodigoDoc, number>> = {
  AC: 3700, NP: 74000, DP: 4410, ACD: 3610, RD: 1230, F: 98000, NC: 10700, ND: 950, RC: 27500,
  OC: 5200, OP: 3100, ACP: 10, COT: 6100, RCP: 4100, TRF: 380, AJU: 610, DES: 18800,
};
const BASE_RM: Record<string, number> = { "1|00016": 6250, "2|00016": 14900, "1|00006": 21300, "2|00006": 58500 };

const ID_RAMOS = "aco_ramos_3633";
const ID_RAMOS_VIEJO = "aco_ramos_3208";

export function generarOperaciones(e: EntradaOps): SalidaOps {
  const { R, cal, ahora, productos, specs, clientes, obras, proveedores, sucursales } = e;
  const dia = cal.dia;
  const meta = (f: string) => ({ creadoEn: f, actualizadoEn: f });
  const contId = new Map<string, number>();
  const id = (p: string) => {
    const n = (contId.get(p) ?? 0) + 1;
    contId.set(p, n);
    return `${p}_${String(n).padStart(4, "0")}`;
  };
  const prod = new Map(productos.map((p) => [p.id, p]));
  const pid = (codigo: string) => `prod_${codigo}`;
  const spec = (productoId: string) => specs.get(productoId)!;
  const cli = new Map(clientes.map((c) => [c.id, c]));
  const suc = new Map(sucursales.map((s) => [s.id, s]));
  const obrasDe = (clienteId: string) => obras.filter((o) => o.clienteId === clienteId);
  const ahoraIso = ahora.toISOString();
  const inicioHoy = new Date(cal.hoy);
  /**
   * ISO de hace `m` minutos para los despachos de hoy. Si el seed se genera temprano (poco
   * margen desde las 6:30), los tiempos se escalan para que todo quede dentro del día.
   */
  const margen = Math.max(20, (ahora.getTime() - (inicioHoy.getTime() + 6.5 * 3600000)) / 60000);
  const escala = Math.min(1, margen / 215);
  const hace = (m: number) => new Date(ahora.getTime() - Math.round(m * escala) * 60000).toISOString();
  const sumarMin = (iso: string, m: number) => new Date(Date.parse(iso) + m * 60000).toISOString();
  const sumarDias = (iso: string, d: number) => new Date(Date.parse(iso) + d * 86400000).toISOString();
  const offDe = (iso: string) => Math.round((Date.parse(iso) - cal.hoy.getTime()) / 86400000);

  // ── Precios y costos en el tiempo (inflación ~2,1 % mensual) ──
  const deflactor = (off: number) => 1 / (1 + 0.021 * (Math.max(0, -off) / 30.4));
  const precioEn = (productoId: string, lista: string, off: number) => Math.max(1, Math.round(e.precioHoy(productoId, lista) * deflactor(off)));
  const costoEn = (productoId: string, off: number) => round2(spec(productoId).costo * deflactor(off));

  // ── Numeración diferida: se asigna al final en orden cronológico ──
  const aNumerar: { obj: { numero: string }; codigo: CodigoDoc; circ: Circuito | null; pv: string; fecha: string; orden: number }[] = [];
  const numerar = (obj: { numero: string }, codigo: CodigoDoc, circ: Circuito | null, pv: string, fecha: string) =>
    aNumerar.push({ obj, codigo, circ, pv, fecha, orden: aNumerar.length });
  const numerosFijos: string[] = [];
  /** Las DP se numeran como la NP que devuelven: `DP2 0001-00067661-1`. */
  const dpDeNP: [DevolucionNP, NotaPedido][] = [];
  /** Usa un número histórico fijo en lugar del correlativo. */
  const fijarNumero = (obj: { numero: string }, numero: string) => {
    const i = aNumerar.findIndex((x) => x.obj === obj);
    if (i >= 0) aNumerar.splice(i, 1);
    obj.numero = numero;
    numerosFijos.push(numero);
  };

  const out: SalidaOps = {
    acopios: [], notasPedido: [], devoluciones: [], ajustesAcopio: [], remitos: [], adjuntos: [], comprobantes: [], cobranzas: [], cheques: [],
    cotizaciones: [], acopiosProveedor: [], ordenesCompra: [], recepciones: [], pagosProveedores: [], despachos: [], hojasRuta: [],
    transferencias: [], ajustes: [], auditoria: [], numeros: [], casoLimite: { productoId: pid("50104"), depositoId: "dep_central", disponible: 80 },
  };
  const auditar = (fecha: string, usuarioId: string, accion: string, entidad: string, entidadId: string, detalle = "") =>
    out.auditoria.push({ id: id("aud"), fecha, usuarioId, accion, entidad, entidadId, detalle, ...meta(fecha) });

  // ───────────────────────── Helpers de documentos ─────────────────────────

  const estadoNP = (np: NotaPedido) => {
    const pend = np.items.some((i) => pendienteLinea(i) > 0);
    const algo = np.items.some((i) => i.entregados > 0);
    np.estado = !pend ? "ENTREGADA" : algo ? "ENTREGADA_PARCIAL" : "PENDIENTE";
    np.pendienteEntrega = pend;
  };

  /** Remito de una NP. Si queda HECHO suma `entregados` y aplica stock. */
  const crearRemito = (np: NotaPedido, entregas: { itemId: string; cantidad: number }[], fecha: string, estado: EstadoRemito, numeroFijo?: string): Remito => {
    const s = suc.get(np.sucursalId)!;
    const items = entregas.map((en) => {
      const it = np.items.find((i) => i.id === en.itemId)!;
      return { productoId: it.productoId, cantidad: en.cantidad, itemNPId: it.id, obraId: it.obraId };
    });
    const r: Remito = {
      id: id("rem"),
      numero: numeroFijo ?? "",
      circuito: np.circuito,
      tipo: np.origen === "ACOPIO" ? "DESACOPIO" : "VENTA",
      notaPedidoId: np.id,
      acopioId: np.acopioId,
      clienteId: np.clienteId,
      obraId: items.find((i) => i.obraId)?.obraId,
      sucursalId: np.sucursalId,
      depositoId: np.depositoId,
      fecha,
      fechaEntrega: estado === "HECHO" ? fecha : undefined,
      direccionEntrega: np.direccionEntrega,
      items,
      cantidadTotal: items.reduce((a, i) => a + i.cantidad, 0),
      pesoTotalKg: Math.round(items.reduce((a, i) => a + i.cantidad * (prod.get(i.productoId)?.pesoKg ?? 0), 0)),
      valorDeclarado: round2(items.reduce((a, i) => a + i.cantidad * (np.items.find((x) => x.id === i.itemNPId)?.precioUnitario ?? 0), 0)),
      estado,
      facturado: np.origen === "ACOPIO" || np.comprobanteIds.length > 0,
      stockAplicado: estado === "HECHO",
      ...meta(fecha),
    };
    if (estado === "HECHO") for (const en of entregas) np.items.find((i) => i.id === en.itemId)!.entregados += en.cantidad;
    if (!numeroFijo) numerar(r, "RM", np.circuito, s.puntoVentaRemito, fecha);
    np.remitoIds.push(r.id);
    out.remitos.push(r);
    estadoNP(np);
    return r;
  };

  /** Entrega todo lo pendiente (o una fracción) de una NP. */
  const entregar = (np: NotaPedido, fecha: string, estado: EstadoRemito = "HECHO", fraccion = 1) => {
    const entregas = np.items
      .map((it) => {
        const p = pendienteLinea(it);
        let q = fraccion >= 1 ? p : Math.floor(p * fraccion);
        const u = prod.get(it.productoId)!;
        if (fraccion < 1 && u.unidadesPorPallet && q >= u.unidadesPorPallet) q = Math.floor(q / u.unidadesPorPallet) * u.unidadesPorPallet;
        return { itemId: it.id, cantidad: q };
      })
      .filter((x) => x.cantidad > 0);
    return entregas.length ? crearRemito(np, entregas, fecha, estado) : undefined;
  };

  const ivaDe = (circ: Circuito) => (circ === 1 ? 21 : 0);

  /** Factura de venta (F1 con letra según IVA del cliente; F2 interna sin IVA). */
  const crearFactura = (o: { clienteId: string; circuito: Circuito; sucursalId: string; fecha: string; total: number; npId?: string; acopioId?: string; vencDias?: number; observaciones?: string }): Comprobante => {
    const c = cli.get(o.clienteId)!;
    const subtotal = o.circuito === 1 ? round2(o.total / 1.21) : round2(o.total);
    const cmp: Comprobante = {
      id: id("cmp"),
      tipo: "FACTURA",
      letra: o.circuito === 1 ? letraFacturaPara(c.condicionIVA) : undefined,
      circuito: o.circuito,
      numero: "",
      clienteId: c.id,
      notaPedidoId: o.npId,
      acopioId: o.acopioId,
      sucursalId: o.sucursalId,
      fecha: o.fecha,
      vencimiento: sumarDias(o.fecha, o.vencDias ?? diasCondicionPago(c.condicionPago)),
      subtotal,
      iva: round2(o.total - subtotal),
      total: round2(o.total),
      saldoPendiente: round2(o.total),
      estado: "PENDIENTE",
      observaciones: o.observaciones,
      ...meta(o.fecha),
    };
    numerar(cmp, "F", o.circuito, suc.get(o.sucursalId)!.puntoVenta, o.fecha);
    out.comprobantes.push(cmp);
    return cmp;
  };

  const aplicar = (cmp: Comprobante, importe: number) => {
    cmp.saldoPendiente = round2(cmp.saldoPendiente - importe);
    cmp.estado = cmp.saldoPendiente <= 0.009 ? "PAGADO" : cmp.saldoPendiente < cmp.total - 0.009 ? "PARCIAL" : "PENDIENTE";
  };

  const BANCOS = ["Banco Galicia", "Banco Nación", "Banco Santander", "BBVA", "Banco Macro", "Banco Provincia", "ICBC", "Banco Credicoop"];
  const chequesCartera: Cheque[] = [];

  /** Recibo (RC) imputado a comprobantes. */
  const crearRecibo = (clienteId: string, circuito: Circuito, sucursalId: string, fecha: string, imputaciones: { cmp: Comprobante; importe: number }[], medioPref?: MedioCobro["medio"], numeroFijo?: string): Cobranza => {
    const total = round2(imputaciones.reduce((a, i) => a + i.importe, 0));
    const medio = medioPref ?? (total > 2_000_000 ? R.pick(["TRANSFERENCIA", "TRANSFERENCIA", "ECHEQ", "CHEQUE"] as const) : R.pick(["EFECTIVO", "TRANSFERENCIA", "MERCADOPAGO", "TRANSFERENCIA"] as const));
    const cob: Cobranza = {
      id: id("cob"),
      numero: numeroFijo ?? "",
      circuito,
      clienteId,
      sucursalId,
      fecha,
      medios: [],
      imputaciones: imputaciones.map((i) => ({ comprobanteId: i.cmp.id, importe: round2(i.importe) })),
      total,
      usuarioId: R.pick(["usr_natalia", "usr_sergio"]),
      ...meta(fecha),
    };
    const m: MedioCobro = { medio, importe: total };
    if (medio === "CHEQUE" || medio === "ECHEQ") {
      const ch: Cheque = {
        id: id("chq"),
        tipo: medio,
        banco: R.pick(BANCOS),
        numero: String(R.int(10_000_000, 99_999_999)),
        importe: total,
        fechaCobro: sumarDias(fecha, R.int(15, 60)),
        clienteId,
        cobranzaId: cob.id,
        estado: "EN_CARTERA",
        ...meta(fecha),
      };
      if (Date.parse(ch.fechaCobro) < ahora.getTime()) ch.estado = "DEPOSITADO";
      else chequesCartera.push(ch);
      out.cheques.push(ch);
      Object.assign(m, { banco: ch.banco, numeroCheque: ch.numero, fechaCobro: ch.fechaCobro, chequeId: ch.id });
    } else if (medio === "TRANSFERENCIA") m.referencia = `Op. ${R.int(1_000_000, 9_999_999)}`;
    cob.medios.push(m);
    for (const i of imputaciones) aplicar(i.cmp, i.importe);
    if (!numeroFijo) numerar(cob, "RC", circuito, suc.get(sucursalId)!.puntoVenta, fecha);
    out.cobranzas.push(cob);
    return cob;
  };

  const nuevaNP = (o: {
    circuito: Circuito;
    origen: "NUEVA" | "ACOPIO";
    acopio?: Acopio;
    clienteId: string;
    sucursalId: string;
    fecha: string;
    items: ItemNP[];
    formaPago: NotaPedido["formaPago"];
    modalidad: ModalidadEntrega;
    descuentoPct?: number;
    fechaEntregaProgramada?: string;
    numeroFijo?: string;
  }): NotaPedido => {
    const c = cli.get(o.clienteId)!;
    const s = suc.get(o.sucursalId)!;
    const monto = round2(o.items.reduce((a, i) => a + i.subtotal, 0));
    const neto = round2(monto * (1 - (o.descuentoPct ?? 0) / 100));
    const iva = o.origen === "ACOPIO" ? 0 : round2(neto * (ivaDe(o.circuito) / 100));
    const obra = obras.find((x) => x.id === o.items.find((i) => i.obraId)?.obraId);
    const np: NotaPedido = {
      id: id("np"),
      numero: o.numeroFijo ?? "",
      circuito: o.circuito,
      tipo: o.origen === "ACOPIO" ? "RETIRO_ACOPIO" : "VENTA",
      origen: o.origen,
      acopioId: o.acopio?.id,
      clienteId: c.id,
      sucursalId: s.id,
      depositoId: o.acopio?.depositoId ?? s.depositoId,
      vendedorId: c.vendedorId ?? "usr_lucas",
      fecha: o.fecha,
      fechaConfirmacion: o.fecha,
      items: o.items,
      monto,
      descuentoPct: o.descuentoPct ?? 0,
      iva,
      total: round2(neto + iva),
      estado: "PENDIENTE",
      formaPago: o.formaPago,
      condicionPago: o.formaPago === "CONTADO" ? "CONTADO" : o.formaPago === "ACOPIO" ? "ANTICIPO" : c.condicionPago,
      pendienteEntrega: true,
      modalidadEntrega: o.modalidad,
      direccionEntrega: o.modalidad === "ENVIO" ? [obra?.direccion ?? c.direccion, obra?.localidad ?? c.localidad].filter(Boolean).join(", ") : undefined,
      fechaEntregaProgramada: o.fechaEntregaProgramada,
      remitoIds: [],
      comprobanteIds: [],
      ...meta(o.fecha),
    };
    if (!o.numeroFijo) numerar(np, "NP", o.circuito, s.puntoVenta, o.fecha);
    out.notasPedido.push(np);
    return np;
  };

  const item = (productoId: string, cantidad: number, precio: number, obraId?: string, costo = 0, subtotal?: number, descuentoPct = 0): ItemNP => ({
    id: id("inp"),
    productoId,
    obraId,
    cantidad,
    entregados: 0,
    precioUnitario: precio,
    costoUnitarioSnapshot: costo,
    descuentoPct: descuentoPct || undefined,
    subtotal: subtotal ?? round2(cantidad * precio * (1 - descuentoPct / 100)),
  });

  /** Cantidad típica de una línea según el perfil del producto. */
  const cantidadTipica = (productoId: string): number => {
    const s = spec(productoId);
    const p = prod.get(productoId)!;
    if (p.unidad === "KG") return R.int(3, 14) * 100;
    if (p.unidad === "M3") return R.int(3, 12);
    if (p.unidad === "TN") return R.int(6, 24);
    switch (s.perfil) {
      case "granel":
        return s.pallet ? s.pallet * R.int(1, 4) : R.int(40, 200);
      case "medio":
        return s.pallet ? Math.round(s.pallet * R.float(0.4, 1.5)) : R.int(10, 80);
      case "unidad":
        return R.int(1, 3);
      default:
        return R.int(2, 12);
    }
  };
  const redondearCant = (productoId: string, q: number) => {
    const p = prod.get(productoId)!;
    if (p.unidad === "KG") return Math.max(100, Math.round(q / 50) * 50);
    if (p.unidadesPorPallet && q >= p.unidadesPorPallet) return Math.round(q / p.unidadesPorPallet) * p.unidadesPorPallet;
    return Math.max(1, Math.round(q));
  };

  const prodsUN = (un: string) => productos.filter((p) => p.unidadNegocioId === un && p.activo);
  /** Productos que más se mueven en acopios de corralón. */
  const FRECUENTES_COR = ["50104", "50101", "50113", "50106", "30101", "30104", "30105", "30108", "30109", "20102", "20103", "20104", "20105", "20203", "20204", "20205", "20175", "10102", "10104", "10120", "40115", "40125", "50318", "60312", "70101", "70103", "20113"].map(pid);
  const FRECUENTES_FER = ["81001", "81004", "82001", "82002", "82006", "83001", "83003", "84001", "84002", "84003", "85001", "85002", "86001", "86003", "86005", "87002", "87003"].map(pid);

  // ═════════════════════ 1. Acopio de Ramos (documento real) ═════════════════════

  const OFF_RAMOS = -182;
  const fR = (d: number, h = 10, m = 0) => dia(OFF_RAMOS + d, h, m);
  const ramosObra = (n: 1 | 2) => (n === 1 ? "obra_ramos_1" : "obra_ramos_2");
  const listaRef: PrecioCongelado[] = productos
    .filter((p) => spec(p.id).precio2022 !== undefined)
    .map((p) => ({ productoId: p.id, precio: spec(p.id).precio2022!, costoSnapshot: round2(spec(p.id).precio2022! / 1.3) }));

  // 1a. Acopio viejo AC2 3208 (agotado; su saldo final se traspasó al 3633)
  {
    const off = OFF_RAMOS - 78;
    const f = dia(off, 11);
    const lista = listaRef.map((x) => ({ ...x, precio: round2(x.precio * 0.93), costoSnapshot: round2(x.costoSnapshot * 0.93) }));
    const pc = (codigo: string) => lista.find((x) => x.productoId === pid(codigo))!;
    const a: Acopio = {
      id: ID_RAMOS_VIEJO,
      numero: "AC2 0001-00003208",
      circuito: 2,
      clienteId: "cli_ramos",
      sucursalId: "suc_central",
      depositoId: "dep_central",
      vendedorId: "usr_lucas",
      obraIds: ["obra_ramos_1"],
      fechaCreacion: f,
      fechaVencimiento: dia(off + 180, 11),
      importe: 0,
      alicuotaIIBBPct: 0,
      importeConIIBB: 0,
      formaPago: "ANTICIPO",
      listaPreciosBaseId: "lst_gen",
      unidadNegocioId: "un_cor",
      preciosCongelados: lista,
      comprobanteIds: [],
      reciboIds: [],
      estado: "AGOTADO",
      observaciones: "Primer acopio de la obra Canton Islas. Saldo final traspasado al AC2 3633.",
      ...meta(f),
    };
    numerosFijos.push(a.numero);
    out.acopios.push(a);
    const lineas: [string, number][][] = [
      [["30101", 6000], ["50104", 120], ["20103", 200], ["20102", 150]],
      [["30109", 900], ["50113", 60], ["20104", 80], ["40121", 14]],
    ];
    const nums = ["NP2 0001-00065810", "NP2 0001-00066342"];
    const rems = [["RM2 00016-00012980", "RM2 00016-00012993"], ["RM2 00016-00013102"]];
    lineas.forEach((ls, k) => {
      const fnp = dia(off + 4 + k * 38, 10);
      const np = nuevaNP({
        circuito: 2, origen: "ACOPIO", acopio: a, clienteId: "cli_ramos", sucursalId: "suc_central", fecha: fnp, formaPago: "ACOPIO", modalidad: "ENVIO", numeroFijo: nums[k],
        items: ls.map(([c, q]) => item(pid(c), q, pc(c).precio, "obra_ramos_1", pc(c).costoSnapshot)),
      });
      numerosFijos.push(np.numero);
      rems[k].forEach((rn, j, arr) => {
        const entregas = np.items.map((it) => ({ itemId: it.id, cantidad: j === arr.length - 1 ? it.cantidad - it.entregados : Math.floor(it.cantidad / arr.length) }));
        const r = crearRemito(np, entregas, dia(off + 6 + k * 38 + j * 2, 9), "HECHO", rn);
        numerosFijos.push(r.numero);
      });
    });
    const retirado = out.notasPedido.filter((n) => n.acopioId === a.id).reduce((s, n) => s + n.monto, 0);
    a.importe = round2(retirado + 980.804);
    a.importeConIIBB = a.importe;
    const fac = crearFactura({ clienteId: "cli_ramos", circuito: 2, sucursalId: "suc_central", fecha: f, total: a.importe, acopioId: a.id, vencDias: 0 });
    fijarNumero(fac, "F2 0001-00081544");
    a.comprobanteIds.push(fac.id);
    const rc = crearRecibo("cli_ramos", 2, "suc_central", f, [{ cmp: fac, importe: a.importe }], "TRANSFERENCIA");
    fijarNumero(rc, "RC2 0001-00025112");
    a.reciboIds.push(rc.id);
    auditar(f, "usr_lucas", "Creó acopio", "Acopio", a.id, `${a.numero} · Ramos María Zulema`);
  }

  // 1b. AC2 0001-00003633: transcripción fiel
  const ramos: Acopio = {
    id: ID_RAMOS,
    numero: "AC2 0001-00003633",
    circuito: 2,
    clienteId: "cli_ramos",
    sucursalId: "suc_central",
    depositoId: "dep_central",
    vendedorId: "usr_lucas",
    obraIds: ["obra_ramos_1", "obra_ramos_2"],
    fechaCreacion: fR(0, 11, 20),
    fechaVencimiento: fR(RAMOS_VENCE_DIA, 11, 20),
    importe: RAMOS_IMPORTE,
    alicuotaIIBBPct: 0,
    importeConIIBB: RAMOS_IMPORTE,
    formaPago: "ANTICIPO",
    listaPreciosBaseId: "lst_gen",
    unidadNegocioId: "un_cor",
    preciosCongelados: listaRef,
    comprobanteIds: [],
    reciboIds: [],
    estado: "VIGENTE",
    observaciones: "Acopio para las obras de Canton Islas (lote 268) y Canton Golf (lote 377).",
    ...meta(fR(0, 11, 20)),
  };
  numerosFijos.push(ramos.numero);
  out.acopios.push(ramos);
  {
    const fac = crearFactura({ clienteId: "cli_ramos", circuito: 2, sucursalId: "suc_central", fecha: ramos.fechaCreacion, total: RAMOS_IMPORTE, acopioId: ramos.id, vencDias: 0 });
    fijarNumero(fac, RAMOS_FACTURA);
    ramos.comprobanteIds.push(fac.id);
    RAMOS_RECIBOS.forEach(([numero, importe], i) => {
      const rc = crearRecibo("cli_ramos", 2, "suc_central", fR(i * 2, 12), [{ cmp: fac, importe }], i === 0 ? "TRANSFERENCIA" : "EFECTIVO", numero);
      numerosFijos.push(numero);
      ramos.reciboIds.push(rc.id);
    });
    auditar(ramos.fechaCreacion, "usr_lucas", "Creó acopio", "Acopio", ramos.id, `${ramos.numero} · $ 4.500.000 · precios congelados lista General`);

    const pv = (rn: string) => (rn.includes(" 00006-") ? "suc_2" : "suc_central");
    const npPorNumero = new Map<string, NotaPedido>();
    // Remito → líneas que entrega, facturas y fecha máxima de las NP que lo usan.
    const remitos = new Map<string, { entregas: { np: NotaPedido; itemId: string; cantidad: number }[]; facturas: string[]; d: number }>();
    for (const doc of RAMOS_DOCS) {
      if (doc.t === "NP") {
        const items = doc.l.map(([codigo, obra, cantidad, , , , subtotal]) => {
          const pc = listaRef.find((x) => x.productoId === pid(codigo))!;
          return item(pid(codigo), cantidad, pc.precio, ramosObra(obra), pc.costoSnapshot, subtotal);
        });
        // El último renglón absorbe los decimales que el documento no muestra (monto del grupo exacto).
        const exacto = RAMOS_MONTOS[doc.n];
        items[items.length - 1].subtotal = Math.round((exacto - items.slice(0, -1).reduce((a, i) => a + i.subtotal, 0)) * 1000) / 1000;
        const np = nuevaNP({ circuito: 2, origen: "ACOPIO", acopio: ramos, clienteId: "cli_ramos", sucursalId: "suc_central", fecha: fR(doc.d, 9 + (doc.d % 6), 15), formaPago: "ACOPIO", modalidad: "ENVIO", items, numeroFijo: `NP2 0001-${doc.n}`, fechaEntregaProgramada: doc.d === 180 ? dia(3, 9) : undefined });
        np.monto = exacto;
        np.total = exacto;
        numerosFijos.push(np.numero);
        npPorNumero.set(doc.n, np);
        doc.l.forEach(([, , , entregados, rems, facs], i) => {
          rems.forEach((rn, j) => {
            const q = j === 0 ? entregados - Math.floor(entregados / rems.length) * (rems.length - 1) : Math.floor(entregados / rems.length);
            const r = remitos.get(rn) ?? { entregas: [], facturas: [], d: 0 };
            r.entregas.push({ np, itemId: items[i].id, cantidad: q });
            const fac = facs[j] ?? facs[facs.length - 1];
            if (fac && !r.facturas.includes(fac)) r.facturas.push(fac);
            r.d = Math.max(r.d, doc.d);
            remitos.set(rn, r);
          });
        });
      } else if (doc.t === "DP") {
        const np = npPorNumero.get(doc.np)!;
        const exacto = RAMOS_MONTOS[`DP-${doc.np}`];
        const items = doc.l.map(([codigo, cantidad]) => {
          const it = np.items.find((x) => x.productoId === pid(codigo) && pendienteLinea(x) >= cantidad) ?? np.items.find((x) => x.productoId === pid(codigo))!;
          it.devueltos = (it.devueltos ?? 0) + cantidad;
          return { itemNPId: it.id, productoId: it.productoId, obraId: it.obraId, cantidad, precioUnitario: it.precioUnitario, subtotal: exacto };
        });
        const dp: DevolucionNP = {
          id: id("dp"),
          numero: `DP2 0001-${doc.np}-1`,
          circuito: 2,
          notaPedidoId: np.id,
          acopioId: ramos.id,
          clienteId: "cli_ramos",
          fecha: fR(doc.d, 16, 30),
          items,
          monto: -exacto,
          remitosRef: doc.rd ? [doc.rd] : undefined,
          notasCreditoRef: doc.nc ? [doc.nc] : undefined,
          motivo: doc.rd ? "Devolución de pallets retornables" : "El cliente no retiró la mercadería: se anula la línea y vuelve el saldo al acopio",
          usuarioId: "usr_natalia",
          ...meta(fR(doc.d, 16, 30)),
        };
        out.devoluciones.push(dp);
        estadoNP(np);
      } else {
        const aj: AjusteAcopio = {
          id: id("acd"),
          numero: `ACD2 0001-${doc.n}`,
          circuito: 2,
          acopioId: ramos.id,
          fecha: fR(doc.d, 11, Number(doc.n.slice(-1))),
          tipo: "TRASPASO_ENTRADA",
          acopioRelacionadoId: doc.n === "00003595" ? ID_RAMOS_VIEJO : undefined,
          monto: RAMOS_MONTOS[doc.n],
          descripcion: doc.desc,
          usuarioId: "usr_natalia",
          ...meta(fR(doc.d, 11)),
        };
        numerosFijos.push(aj.numero);
        out.ajustesAcopio.push(aj);
        if (doc.n === "00003595") {
          const sal: AjusteAcopio = {
            ...aj,
            id: id("acd"),
            numero: "ACD2 0001-00003594",
            acopioId: ID_RAMOS_VIEJO,
            tipo: "TRASPASO_SALIDA",
            acopioRelacionadoId: ramos.id,
            monto: -RAMOS_MONTOS[doc.n],
            descripcion: "AC2 3208. Se traspasa el saldo al AC2 3633, a pedido del cliente.",
          };
          numerosFijos.push(sal.numero);
          out.ajustesAcopio.push(sal);
          auditar(aj.fecha, "usr_natalia", "Traspasó saldo de acopio", "Acopio", ramos.id, "AC2 3208 → AC2 3633 · $ 980,80");
        }
      }
    }
    // Remitos del documento (desacopio, hechos y facturados)
    for (const [rn, r] of remitos) {
      const fecha = fR(r.d + 1, 8 + (r.d % 7), 30);
      const np = r.entregas[0].np;
      const porNP = new Map<NotaPedido, { itemId: string; cantidad: number }[]>();
      for (const en of r.entregas) porNP.set(en.np, [...(porNP.get(en.np) ?? []), { itemId: en.itemId, cantidad: en.cantidad }]);
      // Un remito físico puede cubrir líneas de varias NP: se registra en la primera y se suman las demás.
      const rem = crearRemito(np, porNP.get(np)!, fecha, "HECHO", rn);
      rem.sucursalId = pv(rn);
      rem.depositoId = suc.get(rem.sucursalId)!.depositoId;
      for (const [otra, ents] of porNP) {
        if (otra === np) continue;
        for (const en of ents) {
          const it = otra.items.find((i) => i.id === en.itemId)!;
          it.entregados += en.cantidad;
          rem.items.push({ productoId: it.productoId, cantidad: en.cantidad, itemNPId: it.id, obraId: it.obraId });
        }
        otra.remitoIds.push(rem.id);
        estadoNP(otra);
      }
      rem.cantidadTotal = rem.items.reduce((a, i) => a + i.cantidad, 0);
      rem.pesoTotalKg = Math.round(rem.items.reduce((a, i) => a + i.cantidad * (prod.get(i.productoId)?.pesoKg ?? 0), 0));
      rem.valorDeclarado = round2(rem.items.reduce((a, i) => a + i.cantidad * (listaRef.find((x) => x.productoId === i.productoId)?.precio ?? 0), 0));
      rem.facturasRef = r.facturas;
      numerosFijos.push(rn);
    }
  }

  // ═════════════════════ 2. Otros acopios de clientes ═════════════════════

  interface AcoSpec {
    cli: string;
    circ: Circuito;
    forma: FormaPagoAcopio;
    un: "un_cor" | "un_fer";
    off: number;
    importe: number;
    suc: string;
    consumo: number;
    retiros: number;
    pagado?: number;
    iibb?: number;
    devolucion?: boolean;
    obs?: string;
  }
  const ACOS: AcoSpec[] = [
    { cli: "cli_sp2", circ: 1, forma: "CUENTA_CORRIENTE", un: "un_cor", off: -120, importe: 38_000_000, suc: "suc_central", consumo: 0.52, retiros: 6, pagado: 0.6, obs: "Estructura y mampostería Edificio Maipú 2150 y Torre Olivos." },
    { cli: "cli_delplata", circ: 1, forma: "ANTICIPO", un: "un_cor", off: -95, importe: 52_000_000, suc: "suc_central", consumo: 0.44, retiros: 6, iibb: 2.5, obs: "Acopio para tres obras. Entregas a obra con hidrogrúa." },
    { cli: "cli_pampa", circ: 1, forma: "ANTICIPO", un: "un_cor", off: -165, importe: 27_500_000, suc: "suc_central", consumo: 0.68, retiros: 5 },
    { cli: "cli_indinaco", circ: 2, forma: "ANTICIPO", un: "un_cor", off: -80, importe: 9_800_000, suc: "suc_central", consumo: 0.5, retiros: 4, devolucion: true },
    { cli: "cli_naku", circ: 2, forma: "CUENTA_CORRIENTE", un: "un_cor", off: -70, importe: 7_200_000, suc: "suc_central", consumo: 0.4, retiros: 3, pagado: 0.25, obs: "Pago en cuotas. Cliente atrasado con la segunda cuota." },
    { cli: "cli_mammarella", circ: 2, forma: "ANTICIPO", un: "un_cor", off: -205, importe: 4_600_000, suc: "suc_central", consumo: 0.72, retiros: 4, obs: "Venció con saldo: contactar para extender o retirar." },
    { cli: "cli_lurbrecht", circ: 2, forma: "ANTICIPO", un: "un_cor", off: -60, importe: 15_000_000, suc: "suc_2", consumo: 0.36, retiros: 3 },
    { cli: "cli_eltornillo", circ: 2, forma: "CUENTA_CORRIENTE", un: "un_fer", off: -45, importe: 3_200_000, suc: "suc_central", consumo: 0.42, retiros: 3, pagado: 0.5, obs: "Acopio de herramientas y pinturas para reventa." },
  ];
  /** NP de acopio recientes, para programar entregas de hoy. */
  const npRecientes: NotaPedido[] = [];

  for (const s of ACOS) {
    const c = cli.get(s.cli)!;
    const sc = suc.get(s.suc)!;
    const f = dia(s.off, 10, 30);
    const lista = c.listaPreciosId;
    const congelados: PrecioCongelado[] = prodsUN(s.un).map((p) => {
      const precio = precioEn(p.id, lista, s.off);
      return { productoId: p.id, precio, costoSnapshot: costoEn(p.id, s.off) };
    });
    const obrasCli = obrasDe(c.id);
    const a: Acopio = {
      id: id("aco"),
      numero: "",
      circuito: s.circ,
      clienteId: c.id,
      sucursalId: sc.id,
      depositoId: sc.depositoId,
      vendedorId: c.vendedorId ?? "usr_lucas",
      obraIds: obrasCli.map((o) => o.id),
      fechaCreacion: f,
      fechaVencimiento: dia(s.off + 180, 10, 30),
      importe: s.importe,
      alicuotaIIBBPct: s.iibb ?? 0,
      importeConIIBB: round2(s.importe * (1 + (s.iibb ?? 0) / 100)),
      formaPago: s.forma,
      listaPreciosBaseId: lista,
      unidadNegocioId: s.un,
      preciosCongelados: congelados,
      comprobanteIds: [],
      reciboIds: [],
      estado: "VIGENTE",
      observaciones: s.obs,
      ...meta(f),
    };
    numerar(a, "AC", s.circ, sc.puntoVenta, f);
    out.acopios.push(a);
    auditar(f, a.vendedorId, "Creó acopio", "Acopio", a.id, `${c.razonSocial} · ${s.forma === "ANTICIPO" ? "anticipo" : "cuenta corriente"}`);

    // Factura y cobro
    const fac = crearFactura({ clienteId: c.id, circuito: s.circ, sucursalId: sc.id, fecha: f, total: a.importeConIIBB, acopioId: a.id, vencDias: s.forma === "ANTICIPO" ? 0 : 30 });
    a.comprobanteIds.push(fac.id);
    if (s.forma === "ANTICIPO") {
      a.reciboIds.push(crearRecibo(c.id, s.circ, sc.id, f, [{ cmp: fac, importe: fac.total }], a.importe > 10_000_000 ? "TRANSFERENCIA" : undefined).id);
    } else {
      // Cuotas pagadas hasta `pagado`
      const objetivo = round2(fac.total * (s.pagado ?? 0));
      const cuotas = objetivo > 0 ? Math.max(1, Math.round((s.pagado ?? 0) * 4)) : 0;
      for (let k = 0; k < cuotas; k++) {
        const imp = k === cuotas - 1 ? round2(objetivo - (fac.total - fac.saldoPendiente)) : round2(objetivo / cuotas);
        a.reciboIds.push(crearRecibo(c.id, s.circ, sc.id, dia(s.off + 3 + k * 28, 12), [{ cmp: fac, importe: imp }]).id);
      }
    }

    // Retiros (NP de acopio)
    const frecuentes = (s.un === "un_cor" ? FRECUENTES_COR : FRECUENTES_FER).filter((x) => congelados.some((pc) => pc.productoId === x));
    let restante = round2(s.importe * s.consumo);
    const ultimo = Math.min(-1, s.off + 172);
    const fechas = Array.from({ length: s.retiros }, (_, k) => Math.round(s.off + 4 + ((ultimo - s.off - 4) * (k + R.float(0.15, 0.85))) / s.retiros)).sort((x, y) => x - y);
    // Acopios vigentes: el último retiro es de estos días (queda pendiente de entrega para los despachos de hoy).
    fechas[fechas.length - 1] = ultimo === -1 ? -R.int(0, 3) : Math.min(fechas[fechas.length - 1], ultimo);
    fechas.forEach((off, k) => {
      const objetivo = k === fechas.length - 1 ? restante : (restante / (fechas.length - k)) * R.float(0.75, 1.25);
      const elegidos = R.sample(frecuentes, R.int(2, 4));
      const base = elegidos.map((p) => ({ p, q: cantidadTipica(p), precio: congelados.find((x) => x.productoId === p)!.precio }));
      const bruto = base.reduce((acc, b) => acc + b.q * b.precio, 0);
      const factor = objetivo / bruto;
      const its = base
        .map((b) => {
          const pc = congelados.find((x) => x.productoId === b.p)!;
          return item(b.p, redondearCant(b.p, b.q * factor), pc.precio, R.pick(obrasCli).id, pc.costoSnapshot);
        })
        .filter((i) => i.cantidad > 0);
      let monto = its.reduce((acc, i) => acc + i.subtotal, 0);
      while (monto > restante && its.length > 1) monto -= its.pop()!.subtotal;
      if (monto > restante) return;
      restante = round2(restante - monto);
      const fnp = dia(off, R.int(8, 16), R.pick([0, 15, 30, 45]));
      const recien = off >= -4;
      const np = nuevaNP({
        circuito: s.circ, origen: "ACOPIO", acopio: a, clienteId: c.id, sucursalId: sc.id, fecha: fnp, items: its, formaPago: "ACOPIO",
        modalidad: R.chance(0.75) ? "ENVIO" : "RETIRA", fechaEntregaProgramada: recien ? dia(R.int(0, 2), 9) : undefined,
      });
      auditar(fnp, np.vendedorId, "Confirmó nota de pedido", "NotaPedido", np.id, `Retiro de acopio · ${c.razonSocial}`);
      if (recien) {
        npRecientes.push(np);
        return;
      }
      if (off < -12) {
        entregar(np, sumarDias(fnp, R.int(0, 3)));
      } else {
        // Entrega parcial: queda pendiente de entrega
        entregar(np, sumarDias(fnp, 1), "HECHO", R.float(0.4, 0.7));
      }
    });

    // Devolución sobre un retiro entregado (DP + RD + NC)
    if (s.devolucion) {
      const np = out.notasPedido.filter((n) => n.acopioId === a.id && n.estado === "ENTREGADA").at(-1);
      const it = np?.items.reduce((m, x) => (x.entregados > m.entregados ? x : m), np.items[0]);
      if (np && it) {
        const q = Math.max(1, Math.round(it.entregados * 0.15));
        const fd = sumarDias(np.fecha, 6);
        const dp: DevolucionNP = {
          id: id("dp"),
          numero: "",
          circuito: s.circ,
          notaPedidoId: np.id,
          acopioId: a.id,
          clienteId: c.id,
          fecha: fd,
          items: [{ itemNPId: it.id, productoId: it.productoId, obraId: it.obraId, cantidad: q, precioUnitario: it.precioUnitario }],
          monto: -round2(q * it.precioUnitario),
          motivo: "Sobrante de obra: el cliente devuelve material en buen estado",
          usuarioId: "usr_natalia",
          ...meta(fd),
        };
        dpDeNP.push([dp, np]);
        const rd: Remito = {
          id: id("rem"),
          numero: "",
          circuito: s.circ,
          tipo: "DEVOLUCION",
          notaPedidoId: np.id,
          acopioId: a.id,
          devolucionId: dp.id,
          clienteId: c.id,
          obraId: it.obraId,
          sucursalId: sc.id,
          depositoId: a.depositoId,
          fecha: fd,
          fechaEntrega: fd,
          items: [{ productoId: it.productoId, cantidad: q, itemNPId: it.id, obraId: it.obraId }],
          cantidadTotal: q,
          pesoTotalKg: Math.round(q * (prod.get(it.productoId)?.pesoKg ?? 0)),
          valorDeclarado: round2(q * it.precioUnitario),
          estado: "HECHO",
          facturado: true,
          stockAplicado: true,
          ...meta(fd),
        };
        numerar(rd, "RD", s.circ, sc.puntoVenta, fd);
        it.entregados -= q;
        it.devueltos = (it.devueltos ?? 0) + q;
        const nc: Comprobante = {
          id: id("cmp"),
          tipo: "NOTA_CREDITO",
          circuito: s.circ,
          numero: "",
          clienteId: c.id,
          acopioId: a.id,
          devolucionId: dp.id,
          sucursalId: sc.id,
          fecha: fd,
          subtotal: s.circ === 1 ? round2(-dp.monto / 1.21) : -dp.monto,
          iva: s.circ === 1 ? round2(-dp.monto - -dp.monto / 1.21) : 0,
          total: -dp.monto,
          saldoPendiente: 0,
          estado: "PAGADO",
          observaciones: "Aplicada al saldo del acopio (vuelve a quedar disponible para retirar).",
          ...meta(fd),
        };
        numerar(nc, "NC", s.circ, sc.puntoVenta, fd);
        dp.remitoDevolucionId = rd.id;
        dp.notaCreditoId = nc.id;
        out.devoluciones.push(dp);
        out.remitos.push(rd);
        out.comprobantes.push(nc);
        auditar(fd, "usr_natalia", "Registró devolución", "DevolucionNP", dp.id, `${c.razonSocial} · ${q} ${prod.get(it.productoId)?.unidad}`);
      }
    }
  }

  // ═════════════════════ 3. Ventas nuevas ═════════════════════

  const candidatos = clientes.filter((c) => c.id !== "cli_ramos");
  const ventasNuevas: NotaPedido[] = [];
  const offsVentas = Array.from({ length: 40 }, (_, k) => -Math.round(175 * Math.pow(1 - k / 40, 1.6))).sort((x, y) => x - y);
  const atrasadas = new Set([offsVentas.findIndex((o) => o >= -30), offsVentas.findIndex((o) => o >= -24), offsVentas.findIndex((o) => o >= -19)]);
  offsVentas.forEach((off, k) => {
    const c = R.pick(candidatos);
    const un = c.tipo === "FERRETERIA" ? "un_fer" : c.tipo === "CONSTRUCTORA" && R.chance(0.2) ? "un_fer" : c.tipo === "PARTICULAR" && R.chance(0.25) ? "un_fer" : "un_cor";
    const circ: Circuito = R.chance(0.85) ? c.circuitoHabitual : c.circuitoHabitual === 1 ? 2 : 1;
    const sc = suc.get(c.sucursalPreferidaId)!;
    const forma = c.condicionPago === "CONTADO" ? "CONTADO" : R.chance(0.8) ? "CUENTA_CORRIENTE" : "CONTADO";
    const obrasCli = obrasDe(c.id);
    const pool = un === "un_fer" ? prodsUN("un_fer").map((p) => p.id) : FRECUENTES_COR.concat(R.sample(prodsUN("un_cor").map((p) => p.id), 8));
    const elegidos = R.sample(pool, R.int(1, c.tipo === "PARTICULAR" ? 3 : 5));
    const desc = c.listaPreciosId === "lst_may" && R.chance(0.4) ? R.pick([3, 5]) : 0;
    const escala = c.tipo === "PARTICULAR" ? 0.35 : c.tipo === "FERRETERIA" ? 0.8 : 1;
    const its = elegidos.map((p) => item(p, redondearCant(p, cantidadTipica(p) * escala), precioEn(p, c.listaPreciosId, off), R.pick(obrasCli).id));
    const fnp = dia(off, R.int(8, 17), R.pick([0, 10, 20, 30, 40, 50]));
    const pendiente = off >= -6 || atrasadas.has(k);
    const np = nuevaNP({
      circuito: circ, origen: "NUEVA", clienteId: c.id, sucursalId: sc.id, fecha: fnp, items: its, formaPago: forma, descuentoPct: desc,
      modalidad: c.tipo === "PARTICULAR" || R.chance(0.3) ? "RETIRA" : "ENVIO",
      fechaEntregaProgramada: pendiente && !atrasadas.has(k) ? dia(R.int(0, 3), 9) : undefined,
    });
    ventasNuevas.push(np);
    auditar(fnp, np.vendedorId, "Confirmó nota de pedido", "NotaPedido", np.id, `${c.razonSocial} · ${forma === "CONTADO" ? "contado" : "cuenta corriente"}`);
    if (!pendiente) entregar(np, sumarDias(fnp, R.chance(0.5) ? 0 : R.int(1, 3)));
    else if (atrasadas.has(k) && R.chance(0.5)) entregar(np, sumarDias(fnp, 1), "HECHO", 0.5);
  });

  // Caso límite de la demo (M7): Holcim en Casa Central con dos NP pendientes por 300 y 120 bolsas.
  const casoLimiteNP = new Set<string>();
  {
    const casos: [string, number, Circuito, ModalidadEntrega, number][] = [
      ["cli_enjinia", 300, 1, "ENVIO", 1],
      ["cli_launion", 120, 2, "RETIRA", 2],
    ];
    for (const [cid, q, circ, modalidad, en] of casos) {
      const c = cli.get(cid)!;
      const off = -R.int(2, 5);
      const fnp = dia(off, 11, 10);
      const np = nuevaNP({
        circuito: circ, origen: "NUEVA", clienteId: c.id, sucursalId: "suc_central", fecha: fnp, formaPago: "CUENTA_CORRIENTE", modalidad, fechaEntregaProgramada: dia(en, 9),
        items: [item(pid("50104"), q, precioEn(pid("50104"), c.listaPreciosId, off), obrasDe(c.id)[0].id)],
      });
      ventasNuevas.push(np);
      casoLimiteNP.add(np.id);
      auditar(fnp, np.vendedorId, "Confirmó nota de pedido", "NotaPedido", np.id, `${c.razonSocial} · ${q} bolsas de cemento Holcim (pendiente de entrega)`);
    }
  }

  // Facturación y cobro de ventas nuevas
  const facturaDeNP = new Map<string, Comprobante>();
  for (const np of ventasNuevas) {
    const c = cli.get(np.clienteId)!;
    const off = offDe(np.fecha);
    const entregado = np.items.some((i) => i.entregados > 0);
    // Contado se factura al confirmar; cuenta corriente al entregar.
    if (np.formaPago !== "CONTADO" && !entregado) continue;
    const ff = np.formaPago === "CONTADO" ? np.fecha : out.remitos.find((r) => r.notaPedidoId === np.id && r.estado === "HECHO")!.fecha;
    const fac = crearFactura({ clienteId: c.id, circuito: np.circuito, sucursalId: np.sucursalId, fecha: ff, total: np.total, npId: np.id, vencDias: np.formaPago === "CONTADO" ? 0 : diasCondicionPago(c.condicionPago) });
    fac.items = np.items.map((i) => ({ id: i.id, productoId: i.productoId, obraId: i.obraId, cantidad: i.cantidad, precioUnitario: i.precioUnitario, costoUnitarioSnapshot: 0, descuentoPct: i.descuentoPct ?? 0 }));
    np.comprobanteIds.push(fac.id);
    facturaDeNP.set(np.id, fac);
    for (const rid of np.remitoIds) {
      const r = out.remitos.find((x) => x.id === rid)!;
      r.facturado = true;
    }
    if (np.formaPago === "CONTADO") crearRecibo(c.id, np.circuito, np.sucursalId, ff, [{ cmp: fac, importe: fac.total }]);
    else {
      const vencida = Date.parse(fac.vencimiento!) < ahora.getTime();
      const u = R.next();
      if (vencida && u < 0.62) crearRecibo(c.id, np.circuito, np.sucursalId, sumarDias(fac.vencimiento!, R.int(-5, 6)), [{ cmp: fac, importe: fac.total }]);
      else if (vencida && u < 0.8) crearRecibo(c.id, np.circuito, np.sucursalId, sumarDias(fac.vencimiento!, -2), [{ cmp: fac, importe: round2(fac.total * R.pick([0.3, 0.5])) }]);
      else if (!vencida && off < -10 && u < 0.3) crearRecibo(c.id, np.circuito, np.sucursalId, sumarDias(ff, 7), [{ cmp: fac, importe: fac.total }]);
    }
  }

  // Devolución de una venta nueva (DP + RD + NC imputada a la factura)
  {
    const np = ventasNuevas.find((n) => n.formaPago === "CUENTA_CORRIENTE" && n.estado === "ENTREGADA" && (facturaDeNP.get(n.id)?.saldoPendiente ?? 0) > 0 && offDe(n.fecha) < -20);
    if (np) {
      const it = np.items[0];
      const fac = facturaDeNP.get(np.id)!;
      const q = Math.max(1, Math.round(it.entregados * 0.2));
      const fd = sumarDias(np.fecha, 5);
      const neto = round2(q * it.precioUnitario * (1 - (it.descuentoPct ?? 0) / 100) * (1 - np.descuentoPct / 100));
      const total = round2(neto * (1 + ivaDe(np.circuito) / 100));
      const sc = suc.get(np.sucursalId)!;
      const dp: DevolucionNP = {
        id: id("dp"), numero: "", circuito: np.circuito, notaPedidoId: np.id, clienteId: np.clienteId, fecha: fd,
        items: [{ itemNPId: it.id, productoId: it.productoId, obraId: it.obraId, cantidad: q, precioUnitario: it.precioUnitario }],
        monto: -neto, motivo: "Material con fallas de fábrica", usuarioId: "usr_natalia", ...meta(fd),
      };
      dpDeNP.push([dp, np]);
      const rd: Remito = {
        id: id("rem"), numero: "", circuito: np.circuito, tipo: "DEVOLUCION", notaPedidoId: np.id, devolucionId: dp.id, clienteId: np.clienteId, obraId: it.obraId,
        sucursalId: np.sucursalId, depositoId: np.depositoId, fecha: fd, fechaEntrega: fd, items: [{ productoId: it.productoId, cantidad: q, itemNPId: it.id, obraId: it.obraId }],
        cantidadTotal: q, pesoTotalKg: Math.round(q * (prod.get(it.productoId)?.pesoKg ?? 0)), valorDeclarado: neto, estado: "HECHO", facturado: true, stockAplicado: true, ...meta(fd),
      };
      numerar(rd, "RD", np.circuito, sc.puntoVenta, fd);
      it.entregados -= q;
      it.devueltos = q;
      const nc: Comprobante = {
        id: id("cmp"), tipo: "NOTA_CREDITO", letra: fac.letra, circuito: np.circuito, numero: "", clienteId: np.clienteId, notaPedidoId: np.id, devolucionId: dp.id,
        comprobanteOrigenId: fac.id, aplicadoA: [{ comprobanteId: fac.id, importe: Math.min(total, fac.saldoPendiente) }], sucursalId: np.sucursalId, fecha: fd,
        subtotal: neto, iva: round2(total - neto), total, saldoPendiente: 0, estado: "PAGADO", ...meta(fd),
      };
      numerar(nc, "NC", np.circuito, sc.puntoVenta, fd);
      aplicar(fac, Math.min(total, fac.saldoPendiente));
      dp.remitoDevolucionId = rd.id;
      dp.notaCreditoId = nc.id;
      out.devoluciones.push(dp);
      out.remitos.push(rd);
      out.comprobantes.push(nc);
      np.comprobanteIds.push(nc.id);
      estadoNP(np);
    }
  }

  // ═════════════════════ 4. Cotizaciones ═════════════════════
  {
    const estados: Cotizacion["estado"][] = ["ACEPTADA", "ACEPTADA", "ENVIADA", "ENVIADA", "ENVIADA", "RECHAZADA", "VENCIDA", "BORRADOR", "ENVIADA"];
    estados.forEach((estado, k) => {
      const c = estado === "ACEPTADA" ? cli.get(ventasNuevas[ventasNuevas.length - 6 - k * 3].clienteId)! : R.pick(candidatos);
      const off = estado === "VENCIDA" ? -R.int(20, 40) : estado === "BORRADOR" ? 0 : -R.int(1, 12);
      const f = dia(off, R.int(9, 17), 20);
      const sc = suc.get(c.sucursalPreferidaId)!;
      const un = c.tipo === "FERRETERIA" ? "un_fer" : "un_cor";
      const pool = un === "un_fer" ? FRECUENTES_FER : FRECUENTES_COR;
      const items = R.sample(pool, R.int(2, 5)).map((p) => ({
        id: id("icot"), productoId: p, obraId: obrasDe(c.id)[0]?.id, cantidad: redondearCant(p, cantidadTipica(p)), precioUnitario: precioEn(p, c.listaPreciosId, off), costoUnitarioSnapshot: costoEn(p, off), descuentoPct: 0,
      }));
      const subtotal = round2(items.reduce((a, i) => a + i.cantidad * i.precioUnitario, 0));
      const iva = round2(subtotal * (ivaDe(c.circuitoHabitual) / 100));
      const cot: Cotizacion = {
        id: id("cot"), numero: "", circuito: c.circuitoHabitual, clienteId: c.id, obraId: obrasDe(c.id)[0]?.id, sucursalId: sc.id, vendedorId: c.vendedorId ?? "usr_lucas",
        estado, fecha: f, validezDias: 7, items, subtotal, descuentoPct: 0, iva, total: round2(subtotal + iva), ...meta(f),
      };
      if (estado === "ACEPTADA") {
        const np = ventasNuevas[ventasNuevas.length - 6 - k * 3];
        cot.notaPedidoId = np.id;
        np.cotizacionId = cot.id;
        cot.fecha = sumarDias(np.fecha, -2);
      }
      numerar(cot, "COT", cot.circuito, sc.puntoVenta, cot.fecha);
      out.cotizaciones.push(cot);
    });
  }

  // ═════════════════════ 5. Despachos ═════════════════════

  const posiciones = (depId: string) => e.depositos.find((d) => d.id === depId)?.posiciones ?? ["Playa"];
  const crearDespacho = (np: NotaPedido, estado: EstadoDespacho, t: { espera: string; prep?: string; fin?: string; entrega?: string }, remito?: Remito, posicion?: string): Despacho => {
    const c = cli.get(np.clienteId)!;
    const its = (remito?.items ?? np.items.map((i) => ({ productoId: i.productoId, cantidad: pendienteLinea(i), itemNPId: i.id }))).filter((i) => i.cantidad > 0);
    const d: Despacho = {
      id: id("des"),
      numero: "",
      sucursalId: np.sucursalId,
      depositoId: np.depositoId,
      clienteId: c.id,
      notaPedidoId: np.id,
      remitoId: remito?.id,
      modalidad: np.modalidadEntrega,
      estado,
      posicion: posicion ?? R.pick(posiciones(np.depositoId).filter((p) => (np.modalidadEntrega === "RETIRA" ? true : p !== "Mostrador"))),
      fechaProgramada: t.espera,
      fechaEspera: t.espera,
      fechaInicioPreparacion: t.prep,
      fechaFin: t.fin,
      fechaEntrega: t.entrega,
      operarioId: t.prep ? "usr_hugo" : undefined,
      direccionEntrega: np.direccionEntrega ?? "Retira en mostrador",
      obraId: np.items[0]?.obraId,
      items: its.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, itemNPId: i.itemNPId })),
      ...meta(t.espera),
    };
    if (remito) remito.despachoId = d.id;
    numerar(d, "DES", null, suc.get(np.sucursalId)!.puntoVenta, t.espera);
    out.despachos.push(d);
    return d;
  };

  // 5a. Historia: despachos de los remitos de los últimos 21 días (con tiempos reales)
  const hojasPasadas: Despacho[][] = [[], []];
  for (const r of [...out.remitos]) {
    if (r.estado !== "HECHO" || r.tipo === "DEVOLUCION" || !r.notaPedidoId || r.acopioId === ID_RAMOS || r.acopioId === ID_RAMOS_VIEJO) continue;
    const off = offDe(r.fecha);
    if (off < -21 || off >= 0) continue;
    const np = out.notasPedido.find((n) => n.id === r.notaPedidoId)!;
    const fin = r.fecha;
    const prepMin = R.int(14, 55) + (r.pesoTotalKg > 5000 ? R.int(10, 30) : 0);
    const esperaMin = R.int(4, 35);
    const prep = sumarMin(fin, -prepMin);
    const espera = sumarMin(prep, -esperaMin);
    const envio = np.modalidadEntrega === "ENVIO";
    const d = crearDespacho(np, envio ? "ENTREGADO" : "FINALIZADO", { espera, prep, fin, entrega: envio ? sumarMin(fin, R.int(40, 150)) : fin }, r);
    if (envio && (off === -1 || off === -2)) hojasPasadas[-off - 1].push(d);
  }
  hojasPasadas.forEach((ds, k) => {
    if (!ds.length) return;
    const f = dia(-(k + 1), 8);
    const v = k === 0 ? "veh_1" : "veh_2";
    for (const d of ds) Object.assign(d, { vehiculoId: v, choferId: k === 0 ? "cho_1" : "cho_2" });
    out.hojasRuta.push({ id: id("hr"), fecha: f, vehiculoId: v, choferId: k === 0 ? "cho_1" : "cho_2", despachoIds: ds.map((d) => d.id), estado: "CERRADA", ...meta(f) });
  });

  // 5b. Hoy: finalizados, en preparación, en espera y envíos en viaje
  // Todas las NP con entrega programada (sin las atrasadas a propósito ni el caso límite), las más viejas primero.
  const paraHoy = [...npRecientes, ...ventasNuevas]
    .filter((n) => n.pendienteEntrega && n.fechaEntregaProgramada && !casoLimiteNP.has(n.id))
    .sort((x, y) => x.fecha.localeCompare(y.fecha));
  const planHoy: { estado: EstadoDespacho; espera: number; prep?: number; fin?: number }[] = [
    { estado: "FINALIZADO", espera: 205, prep: 192, fin: 160 },
    { estado: "FINALIZADO", espera: 180, prep: 150, fin: 52 },
    { estado: "FINALIZADO", espera: 140, prep: 128, fin: 96 },
    { estado: "EN_VIAJE", espera: 170, prep: 158, fin: 118 },
    { estado: "EN_VIAJE", espera: 150, prep: 120, fin: 84 },
    { estado: "PREPARACION", espera: 75, prep: 38 },
    { estado: "PREPARACION", espera: 58, prep: 21 },
    { estado: "ESPERA", espera: 26 },
    { estado: "ESPERA", espera: 14 },
    { estado: "ESPERA", espera: 6 },
  ];
  const enViaje: Despacho[] = [];
  const firmadosHoy: Remito[] = [];
  planHoy.forEach((p, k) => {
    const np = paraHoy[k];
    if (!np) return;
    if (p.estado === "EN_VIAJE") np.modalidadEntrega = "ENVIO";
    if (p.estado === "FINALIZADO" && k === 0) np.modalidadEntrega = "RETIRA";
    const t = { espera: hace(p.espera), prep: p.prep !== undefined ? hace(p.prep) : undefined, fin: p.fin !== undefined ? hace(p.fin) : undefined };
    let r: Remito | undefined;
    if (p.estado === "FINALIZADO" || p.estado === "EN_VIAJE") r = entregar(np, t.fin!, "HECHO");
    else if (p.estado === "PREPARACION") r = entregar(np, t.prep!, "PICKING");
    const d = crearDespacho(np, p.estado, t, r, np.modalidadEntrega === "RETIRA" ? "Mostrador" : undefined);
    if (p.estado === "EN_VIAJE") enViaje.push(d);
    if (p.estado === "FINALIZADO" && r) firmadosHoy.push(r);
    np.fechaEntregaProgramada = dia(0, 9);
  });
  if (enViaje.length) {
    for (const d of enViaje) Object.assign(d, { vehiculoId: "veh_1", choferId: "cho_1" });
    const f = dia(0, 8);
    out.hojasRuta.push({ id: id("hr"), fecha: f, vehiculoId: "veh_1", choferId: "cho_1", despachoIds: enViaje.map((d) => d.id), estado: "EN_CURSO", ...meta(f) });
  }
  // Un remito INICIAL (generado, todavía sin picking) para mañana
  {
    const np = [...npRecientes, ...ventasNuevas].find((n) => n.pendienteEntrega && !casoLimiteNP.has(n.id) && !out.despachos.some((d) => d.notaPedidoId === n.id && d.estado !== "CANCELADO"));
    if (np) entregar(np, dia(0, 8, 40), "INICIAL");
  }

  // 5c. Remitos firmados de ejemplo (PDF generado en runtime y guardado en IndexedDB)
  {
    const hechos = out.remitos
      .filter((r) => r.estado === "HECHO" && r.tipo !== "DEVOLUCION" && r.acopioId !== ID_RAMOS && r.acopioId !== ID_RAMOS_VIEJO && offDe(r.fecha) >= -6)
      .sort((x, y) => y.fecha.localeCompare(x.fecha));
    const elegidos = [...firmadosHoy.slice(0, 1), ...hechos.filter((r) => !firmadosHoy.includes(r)).slice(1, 3)];
    for (const r of elegidos) {
      const subido = sumarMin(r.fechaEntrega ?? r.fecha, 95);
      const adj: Adjunto = {
        id: id("adj"),
        entidadTipo: "REMITO",
        entidadId: r.id,
        nombre: "",
        tamanoBytes: 0,
        tipoMime: "application/pdf",
        categoria: "REMITO_FIRMADO",
        subidoPor: R.pick(["usr_hugo", "usr_natalia"]),
        subidoEn: Date.parse(subido) > ahora.getTime() ? ahoraIso : subido,
        blobKey: `demo-firmado-${r.id}`,
        ...meta(subido),
      };
      r.firmadoAdjuntoId = adj.id;
      out.adjuntos.push(adj);
    }
  }

  // ═════════════════════ 6. Compras y acopios con proveedores ═════════════════════

  const prov = new Map(proveedores.map((p) => [p.id, p]));
  const facturaCompra = (proveedorId: string, circ: Circuito, fecha: string, total: number, extra: Partial<Comprobante> = {}): Comprobante => {
    const p = prov.get(proveedorId)!;
    const subtotal = circ === 1 ? round2(total / 1.21) : round2(total);
    const cmp: Comprobante = {
      id: id("cmp"),
      tipo: "FACTURA",
      letra: circ === 1 ? "A" : undefined,
      circuito: circ,
      numero: `${circ === 1 ? "FC A" : "FC X"} ${String(R.int(2, 12)).padStart(4, "0")}-${String(R.int(10_000, 990_000)).padStart(8, "0")}`,
      proveedorId,
      fecha,
      vencimiento: sumarDias(fecha, diasCondicionPago(p.condicionPago)),
      subtotal,
      iva: round2(total - subtotal),
      total: round2(total),
      saldoPendiente: round2(total),
      estado: "PENDIENTE",
      ...extra,
      ...meta(fecha),
    };
    out.comprobantes.push(cmp);
    return cmp;
  };
  const crearOP = (proveedorId: string, circ: Circuito, fecha: string, imputaciones: { cmp: Comprobante; importe: number }[], usarCheque = false): PagoProveedor => {
    const total = round2(imputaciones.reduce((a, i) => a + i.importe, 0));
    const op: PagoProveedor = {
      id: id("op"), numero: "", circuito: circ, proveedorId, fecha, medios: [], imputaciones: imputaciones.map((i) => ({ comprobanteId: i.cmp.id, importe: round2(i.importe) })),
      total, usuarioId: "usr_natalia", ...meta(fecha),
    };
    const ch = usarCheque ? chequesCartera.find((c) => c.estado === "EN_CARTERA" && c.importe <= total && Date.parse(c.creadoEn) < Date.parse(fecha)) : undefined;
    if (ch) {
      ch.estado = "ENTREGADO";
      ch.proveedorId = proveedorId;
      ch.pagoProveedorId = op.id;
      op.medios.push({ medio: ch.tipo, importe: ch.importe, banco: ch.banco, numeroCheque: ch.numero, fechaCobro: ch.fechaCobro, chequeId: ch.id });
      if (total - ch.importe > 0.009) op.medios.push({ medio: "TRANSFERENCIA", importe: round2(total - ch.importe), referencia: `Op. ${R.int(1_000_000, 9_999_999)}` });
    } else op.medios.push({ medio: "TRANSFERENCIA", importe: total, referencia: `Op. ${R.int(1_000_000, 9_999_999)}` });
    for (const i of imputaciones) aplicar(i.cmp, i.importe);
    numerar(op, "OP", circ, "0001", fecha);
    out.pagosProveedores.push(op);
    return op;
  };
  const totalesOC = (items: ItemOC[], circ: Circuito) => {
    const subtotal = round2(items.reduce((a, i) => a + i.cantidadPedida * i.costoUnitario * (1 - (i.descuentoPct || 0) / 100), 0));
    const iva = round2(subtotal * (ivaDe(circ) / 100));
    return { subtotal, iva, total: round2(subtotal + iva) };
  };
  /** OC (y su recepción si corresponde). `recibido`: 0 = nada, 1 = todo, entre 0 y 1 = parcial. */
  const crearOC = (o: { proveedorId: string; circ: Circuito; off: number; dep: string; items: { productoId: string; cantidad: number; costo: number }[]; estado: OrdenCompra["estado"]; recibido?: number; acopio?: AcopioProveedor; plazo?: number; pagar?: boolean }) => {
    const p = prov.get(o.proveedorId)!;
    const f = dia(o.off, R.int(9, 12), 30);
    const sucId = o.dep === "dep_2" ? "suc_2" : "suc_central";
    const items: ItemOC[] = o.items.map((i) => ({ id: id("ioc"), productoId: i.productoId, cantidadPedida: i.cantidad, cantidadRecibida: 0, costoUnitario: i.costo, descuentoPct: 0 }));
    const oc: OrdenCompra = {
      id: id("oc"), numero: "", circuito: o.circ, origen: o.acopio ? "ACOPIO" : "NUEVA", acopioProveedorId: o.acopio?.id, proveedorId: p.id, depositoDestinoId: o.dep, sucursalId: sucId,
      estado: o.estado, fechaEmision: f, fechaEntregaEstimada: dia(o.off + (o.plazo ?? p.plazoEntregaDias), 9), items, ...totalesOC(items, o.circ), usuarioId: "usr_sergio", ...meta(f),
    };
    numerar(oc, "OC", o.circ, "0001", f);
    out.ordenesCompra.push(oc);
    auditar(f, "usr_sergio", "Creó orden de compra", "OrdenCompra", oc.id, `${p.razonSocial}${o.acopio ? " · retiro de acopio" : ""}`);
    if (o.recibido && o.recibido > 0) {
      const fr = dia(Math.min(-1, o.off + Math.max(1, p.plazoEntregaDias - R.int(0, 2))), R.int(8, 15), 10);
      const rec: RecepcionMercaderia = {
        id: id("rcp"), numero: "", ordenCompraId: oc.id, depositoId: o.dep, remitoProveedor: `R ${String(R.int(1, 9)).padStart(4, "0")}-${String(R.int(10_000, 99_999_999)).padStart(8, "0")}`,
        fecha: fr, items: [], usuarioId: "usr_hugo", ...meta(fr),
      };
      let neto = 0;
      for (const it of items) {
        const q = o.recibido >= 1 ? it.cantidadPedida : redondearCant(it.productoId, it.cantidadPedida * o.recibido);
        if (q <= 0) continue;
        it.cantidadRecibida = Math.min(it.cantidadPedida, q);
        rec.items.push({ itemOCId: it.id, productoId: it.productoId, cantidadRecibida: it.cantidadRecibida, costoUnitario: it.costoUnitario, diferencia: "OK" });
        neto += it.cantidadRecibida * it.costoUnitario;
      }
      numerar(rec, "RCP", null, "0001", fr);
      out.recepciones.push(rec);
      oc.estado = items.every((i) => i.cantidadRecibida >= i.cantidadPedida) ? "RECIBIDA" : "RECIBIDA_PARCIAL";
      auditar(fr, "usr_hugo", "Registró recepción de mercadería", "RecepcionMercaderia", rec.id, `${p.razonSocial} · remito ${rec.remitoProveedor}`);
      if (!o.acopio) {
        // Compra nueva: genera la factura del proveedor (deuda)
        const fac = facturaCompra(p.id, o.circ, fr, round2(neto * (1 + ivaDe(o.circ) / 100)), { recepcionId: rec.id });
        rec.comprobanteId = fac.id;
        if (o.pagar && Date.parse(fac.vencimiento!) < ahora.getTime() && R.chance(0.85)) crearOP(p.id, o.circ, fac.vencimiento!, [{ cmp: fac, importe: fac.total }], R.chance(0.4));
      }
    }
    return oc;
  };

  // 6a. Acopios con proveedores
  const crearACP = (o: { proveedorId: string; circ: Circuito; off: number; modalidad: "MONTO" | "CANTIDAD"; forma: FormaPagoAcopio; importe?: number; items?: { codigo: string; cantidad: number; descuento: number }[]; descuento?: number; pagos?: number[]; obs?: string }) => {
    const p = prov.get(o.proveedorId)!;
    const f = dia(o.off, 11, 0);
    const congelados = productos
      .filter((x) => x.proveedorHabitualId === p.id)
      .map((x) => ({ productoId: x.id, costo: round2(costoEn(x.id, o.off) * (1 - (o.items?.find((i) => pid(i.codigo) === x.id)?.descuento ?? o.descuento ?? 0) / 100)) }));
    const items = o.items?.map((i) => ({ productoId: pid(i.codigo), cantidadPactada: i.cantidad }));
    const importe = o.importe ?? round2((items ?? []).reduce((a, i) => a + i.cantidadPactada * congelados.find((c) => c.productoId === i.productoId)!.costo, 0));
    const acp: AcopioProveedor = {
      id: id("acp"), numero: "", circuito: o.circ, proveedorId: p.id, sucursalId: "suc_central", depositoDestinoId: "dep_central", fechaCreacion: f, fechaVencimiento: dia(o.off + 180, 11),
      modalidad: o.modalidad, importe, formaPago: o.forma, preciosCongelados: congelados, items, pagado: 0, comprobanteCompraIds: [], ordenPagoIds: [], estado: "VIGENTE", observaciones: o.obs, ...meta(f),
    };
    numerar(acp, "ACP", o.circ, "0001", f);
    out.acopiosProveedor.push(acp);
    const fac = facturaCompra(p.id, o.circ, f, importe, { acopioProveedorId: acp.id, vencimiento: sumarDias(f, o.forma === "ANTICIPO" ? 0 : 30), observaciones: `Acopio ${o.modalidad === "CANTIDAD" ? "por cantidades" : "por monto"} con precios congelados` });
    acp.comprobanteCompraIds.push(fac.id);
    const pagos = o.forma === "ANTICIPO" ? [1] : (o.pagos ?? []);
    pagos.forEach((frac, k) => {
      const op = crearOP(p.id, o.circ, o.forma === "ANTICIPO" ? f : dia(o.off + 20 + k * 25, 12), [{ cmp: fac, importe: round2(importe * frac) }]);
      acp.ordenPagoIds.push(op.id);
      acp.pagado = round2(acp.pagado + op.total);
    });
    auditar(f, "usr_felipe", "Creó acopio con proveedor", "AcopioProveedor", acp.id, `${p.razonSocial} · ${o.forma === "ANTICIPO" ? "anticipo" : "cuenta corriente"}`);
    return acp;
  };
  const costoACP = (acp: AcopioProveedor, codigo: string) => acp.preciosCongelados.find((c) => c.productoId === pid(codigo))!.costo;

  const acpLoma = crearACP({ proveedorId: "prov_01", circ: 1, off: -100, modalidad: "CANTIDAD", forma: "ANTICIPO", items: [{ codigo: "50101", cantidad: 2000, descuento: 6 }], obs: "Acopio de 2.000 bolsas de cemento Loma Negra a precio congelado, retiro en camión completo." });
  crearOC({ proveedorId: "prov_01", circ: 1, off: -92, dep: "dep_central", acopio: acpLoma, estado: "RECIBIDA", recibido: 1, items: [{ productoId: pid("50101"), cantidad: 400, costo: costoACP(acpLoma, "50101") }] });
  crearOC({ proveedorId: "prov_01", circ: 1, off: -41, dep: "dep_central", acopio: acpLoma, estado: "RECIBIDA", recibido: 1, items: [{ productoId: pid("50101"), cantidad: 600, costo: costoACP(acpLoma, "50101") }] });
  crearOC({ proveedorId: "prov_01", circ: 1, off: -3, dep: "dep_central", acopio: acpLoma, estado: "CONFIRMADA", items: [{ productoId: pid("50101"), cantidad: 400, costo: costoACP(acpLoma, "50101") }] });

  const acpAcindar = crearACP({ proveedorId: "prov_03", circ: 1, off: -76, modalidad: "MONTO", forma: "ANTICIPO", importe: 30_000_000, descuento: 8, obs: "Anticipo de $ 30M con lista de hierros congelada (−8 %)." });
  crearOC({ proveedorId: "prov_03", circ: 1, off: -70, dep: "dep_central", acopio: acpAcindar, estado: "RECIBIDA", recibido: 1, items: [["20202", 3000], ["20203", 4500], ["20204", 2500], ["20205", 1500]].map(([c, q]) => ({ productoId: pid(c as string), cantidad: q as number, costo: costoACP(acpAcindar, c as string) })) });
  crearOC({ proveedorId: "prov_03", circ: 1, off: -30, dep: "dep_central", acopio: acpAcindar, estado: "CONFIRMADA", recibido: 0.6, items: [["20102", 600], ["20103", 500], ["20175", 60], ["20113", 400]].map(([c, q]) => ({ productoId: pid(c as string), cantidad: q as number, costo: costoACP(acpAcindar, c as string) })) });
  crearOC({ proveedorId: "prov_03", circ: 1, off: -9, dep: "dep_central", acopio: acpAcindar, estado: "CONFIRMADA", plazo: 6, items: [["20104", 300], ["20105", 200], ["20207", 20]].map(([c, q]) => ({ productoId: pid(c as string), cantidad: q as number, costo: costoACP(acpAcindar, c as string) })) });

  const acpHierros = crearACP({ proveedorId: "prov_12", circ: 2, off: -52, modalidad: "MONTO", forma: "CUENTA_CORRIENTE", importe: 12_000_000, descuento: 5, pagos: [0.25, 0.17], obs: "Cuenta corriente: áridos y viguetas a precio congelado." });
  crearOC({ proveedorId: "prov_12", circ: 2, off: -46, dep: "dep_central", acopio: acpHierros, estado: "RECIBIDA", recibido: 1, items: [["10102", 60], ["10104", 45], ["40115", 40], ["40125", 30]].map(([c, q]) => ({ productoId: pid(c as string), cantidad: q as number, costo: costoACP(acpHierros, c as string) })) });
  crearOC({ proveedorId: "prov_12", circ: 2, off: -14, dep: "dep_2", acopio: acpHierros, estado: "RECIBIDA", recibido: 1, items: [["10102", 30], ["10120", 20], ["50108", 120]].map(([c, q]) => ({ productoId: pid(c as string), cantidad: q as number, costo: costoACP(acpHierros, c as string) })) });

  const acpHolcim = crearACP({ proveedorId: "prov_02", circ: 1, off: -36, modalidad: "CANTIDAD", forma: "CUENTA_CORRIENTE", items: [{ codigo: "50104", cantidad: 1500, descuento: 5 }], pagos: [0.4], obs: "1.500 bolsas Holcim en cuenta corriente, pago a 30/60 días." });
  crearOC({ proveedorId: "prov_02", circ: 1, off: -31, dep: "dep_central", acopio: acpHolcim, estado: "RECIBIDA", recibido: 1, items: [{ productoId: pid("50104"), cantidad: 630, costo: costoACP(acpHolcim, "50104") }] });

  // 6b. Compras nuevas (reposición)
  const reposicion: { proveedorId: string; circ: Circuito; off: number; dep: string; codigos: [string, number][]; estado: OrdenCompra["estado"]; recibido?: number; plazo?: number }[] = [
    { proveedorId: "prov_04", circ: 2, off: -150, dep: "dep_central", codigos: [["30101", 20000], ["30104", 3960], ["30105", 2880], ["30108", 2520], ["30109", 2700]], estado: "RECIBIDA", recibido: 1 },
    { proveedorId: "prov_05", circ: 1, off: -128, dep: "dep_central", codigos: [["50203", 200], ["50318", 240], ["240029", 160], ["60312", 6], ["60313", 30]], estado: "RECIBIDA", recibido: 1 },
    { proveedorId: "prov_11", circ: 2, off: -118, dep: "dep_central", codigos: [["70101", 300], ["70102", 100], ["70103", 400], ["70104", 300], ["82001", 12], ["82006", 40], ["84001", 30], ["85001", 25]], estado: "RECIBIDA", recibido: 1 },
    { proveedorId: "prov_06", circ: 1, off: -110, dep: "dep_central", codigos: [["83001", 120], ["83002", 120], ["83003", 60], ["83004", 80], ["83005", 40], ["83006", 30]], estado: "RECIBIDA", recibido: 1 },
    { proveedorId: "prov_07", circ: 1, off: -96, dep: "dep_central", codigos: [["81001", 24], ["81002", 60], ["81004", 40], ["81005", 20], ["82002", 10], ["82004", 6]], estado: "RECIBIDA", recibido: 1 },
    { proveedorId: "prov_09", circ: 1, off: -88, dep: "dep_2", codigos: [["86001", 300], ["86002", 600], ["86005", 80], ["85006", 40]], estado: "RECIBIDA", recibido: 1 },
    { proveedorId: "prov_10", circ: 1, off: -80, dep: "dep_central", codigos: [["86003", 40], ["86004", 12], ["86006", 120]], estado: "RECIBIDA", recibido: 1 },
    { proveedorId: "prov_08", circ: 1, off: -66, dep: "dep_central", codigos: [["84002", 30], ["84004", 30], ["84005", 80], ["60402", 20]], estado: "RECIBIDA", recibido: 1 },
    { proveedorId: "prov_04", circ: 2, off: -58, dep: "dep_2", codigos: [["30101", 12000], ["30104", 1980], ["30105", 1440], ["30109", 900]], estado: "RECIBIDA", recibido: 1 },
    { proveedorId: "prov_11", circ: 2, off: -33, dep: "dep_2", codigos: [["81003", 20], ["81006", 20], ["81007", 40], ["87001", 20], ["87002", 200], ["87003", 40], ["87004", 60], ["87005", 30]], estado: "RECIBIDA", recibido: 1 },
    { proveedorId: "prov_05", circ: 1, off: -20, dep: "dep_central", codigos: [["50203", 160], ["50318", 200], ["60103", 12], ["60104", 8]], estado: "RECIBIDA", recibido: 0.7 },
    { proveedorId: "prov_04", circ: 2, off: -11, dep: "dep_central", codigos: [["30101", 15000], ["30108", 1260], ["30109", 1350]], estado: "CONFIRMADA", plazo: 5 },
    { proveedorId: "prov_11", circ: 2, off: -4, dep: "dep_central", codigos: [["82003", 8], ["82005", 6], ["84003", 24], ["85002", 100], ["85005", 30]], estado: "CONFIRMADA" },
    { proveedorId: "prov_09", circ: 1, off: -1, dep: "dep_central", codigos: [["86005", 60], ["86001", 200]], estado: "ENVIADA" },
    { proveedorId: "prov_06", circ: 1, off: 0, dep: "dep_2", codigos: [["83001", 60], ["83003", 30]], estado: "BORRADOR" },
  ];
  for (const r of reposicion)
    crearOC({ proveedorId: r.proveedorId, circ: r.circ, off: r.off, dep: r.dep, estado: r.estado, recibido: r.recibido, plazo: r.plazo, pagar: true, items: r.codigos.map(([c, q]) => ({ productoId: pid(c), cantidad: q, costo: costoEn(pid(c), r.off) })) });

  // ═════════════════════ 7. Transferencias y ajustes ═════════════════════
  {
    const trf = (off: number, origen: string, destino: string, items: [string, number][], estado: TransferenciaStock["estado"]): void => {
      const f = dia(off, 9, 30);
      const t: TransferenciaStock = {
        id: id("trf"), numero: "", depositoOrigenId: origen, depositoDestinoId: destino, items: items.map(([c, q]) => ({ productoId: pid(c), cantidad: q })), estado, usuarioId: "usr_hugo", fecha: f,
        fechaDespacho: estado !== "PENDIENTE" ? dia(off, 11) : undefined, fechaRecepcion: estado === "RECIBIDA" ? dia(off, 15) : undefined, ...meta(f),
      };
      numerar(t, "TRF", null, "0001", f);
      out.transferencias.push(t);
    };
    trf(-64, "dep_central", "dep_2", [["50104", 210], ["50101", 168], ["20103", 120]], "RECIBIDA");
    trf(-27, "dep_central", "dep_2", [["70101", 50], ["70103", 80], ["83001", 30]], "RECIBIDA");
    trf(-1, "dep_central", "dep_2", [["50113", 100], ["30104", 396]], "EN_TRANSITO");
    trf(0, "dep_2", "dep_central", [["86001", 40]], "PENDIENTE");

    const aju = (off: number, dep: string, items: [string, number, 1 | -1, string][], obs: string, usuario = "usr_hugo") => {
      const f = dia(off, 17, 30);
      const a: AjusteStock = { id: id("aju"), numero: "", depositoId: dep, items: items.map(([c, q, s, m]) => ({ productoId: pid(c), cantidad: q, signo: s, motivo: m })), usuarioId: usuario, fecha: f, observacion: obs, ...meta(f) };
      out.ajustes.push(a);
    };
    aju(-48, "dep_central", [["50104", 6, -1, "ROTURA"], ["70101", 3, -1, "ROTURA"]], "Bolsas rotas en la descarga y placas golpeadas");
    aju(-22, "dep_2", [["30101", 140, -1, "FALTANTE"], ["30104", 12, 1, "SOBRANTE"]], "Conteo cíclico de playa");
    aju(-6, "dep_central", [["84001", 1, -1, "MUESTRA"], ["81004", 2, -1, "FALTANTE"]], "Muestra para obra y faltante en mostrador", "usr_natalia");
  }

  // ═════════════════════ Numeración final (cronológica por código/circuito/punto de venta) ═════════════════════
  aNumerar.sort((x, y) => x.fecha.localeCompare(y.fecha) || x.orden - y.orden);
  const cont = new Map<string, number>();
  for (const n of aNumerar) {
    const k = `${n.codigo}|${n.circ ?? 0}|${n.pv}`;
    let actual = cont.get(k);
    if (actual === undefined) {
      if (n.codigo === "RM") actual = BASE_RM[`${n.circ ?? 2}|${n.pv}`] ?? 1000;
      else {
        const b = BASE[n.codigo] ?? 100;
        actual = Math.round(b * (n.circ === 1 ? 0.42 : 1) * (n.pv === "0002" ? 0.3 : 1));
      }
    }
    actual++;
    cont.set(k, actual);
    n.obj.numero = formatearDoc(n.codigo, n.circ, n.pv, actual);
  }
  for (const [dp, np] of dpDeNP) {
    const previas = out.devoluciones.filter((d) => d.notaPedidoId === np.id && d !== dp && d.numero).length;
    dp.numero = `DP${np.circuito} ${np.numero.split(" ")[1]}-${previas + 1}`;
  }
  // Ajustes de stock: número sin circuito
  out.ajustes.sort((x, y) => x.fecha.localeCompare(y.fecha));

  // Referencias que dependen de números
  for (const r of out.remitos) {
    if (r.tipo !== "VENTA") continue;
    const np = out.notasPedido.find((n) => n.id === r.notaPedidoId);
    const facs = np ? out.comprobantes.filter((c) => np.comprobanteIds.includes(c.id) && c.tipo === "FACTURA") : [];
    if (facs.length) r.facturasRef = facs.map((f) => f.numero);
  }
  for (const a of out.adjuntos) {
    const r = out.remitos.find((x) => x.id === a.entidadId)!;
    a.nombre = `Remito firmado ${r.numero.replace(/\s+/g, "_")}.pdf`;
    a.tamanoBytes = 38_000 + (r.items.length * 2_150) + R.int(0, 4_000);
  }

  // Estados derivados de acopios (vencido / agotado) y de NP
  for (const np of out.notasPedido) estadoNP(np);
  out.auditoria.sort((x, y) => x.fecha.localeCompare(y.fecha));
  out.numeros = [...numerosFijos, ...aNumerar.map((n) => n.obj.numero)];
  return out;
}
