import type { Circuito, Cliente, Comprobante, Cotizacion, DevolucionNP, FormaPagoVenta, ItemNP, ItemVenta, MedioCobro, ModalidadEntrega, Moneda, NotaPedido, OrigenVenta, Remito, Unidad } from "@/domain/types";
import { pendienteLinea, precioCongelado, validarRetiro, retiradoAcopio, pagadoAcopio } from "@/domain/acopios";
import { calcularTotales } from "@/domain/ventas";
import { saldoCliente } from "@/domain/cuentasCorrientes";
import { puede } from "@/domain/permisos";
import { formatMoney } from "@/lib/format";
import { newId, round2 } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir, r2 } from "../helpers";
import {
  actualizarEstadoAcopio,
  actualizarEstadoNP,
  aplicarAComprobante,
  crearFacturaVenta,
  CLIENTE_MELI,
  clienteMercadoLibre,
  crearClienteDesdeVenta,
  crearRemitoNP,
  disponible,
  type DatosClienteVenta,
  marcarHecho,
  mensajeSinDisponible,
  puntoVentaDe,
  saldoAcopio,
} from "../ops";
import type { Tx } from "../tx";
import type { GetFn, SetFn } from "../types";
import { tipoCambioVigente } from "./catalogo";
import { anularRecibo, registrarCobro } from "./finanzas";

/**
 * Precios en USD (clientes con `facturaEnUSD`). Regla: los importes del documento se guardan
 * SIEMPRE en pesos (listas de precios, cuentas corrientes, acopios y reportes siguen igual);
 * `moneda: "USD"` indica que el documento se presenta en dólares dividiendo por el
 * `tipoCambioAplicado`, que se congela al confirmar la NP o al guardar la cotización.
 */
function monedaDocumento(c: Cliente, pedida: Moneda | undefined, esAcopio = false): Moneda {
  if (pedida !== "USD" || esAcopio) return "ARS";
  if (!c.facturaEnUSD) throw new ErrorNegocio(`${c.razonSocial} no tiene habilitados los precios en USD (ficha del cliente).`);
  return "USD";
}

export interface ItemNPInput {
  id?: string;
  productoId: string;
  obraId?: string;
  cantidad: number;
  precioUnitario: number;
  descuentoPct?: number;
  unidadVenta?: Unidad;
}

export interface NotaPedidoInput {
  clienteId: string;
  sucursalId: string;
  depositoId: string;
  vendedorId?: string;
  fecha: string;
  circuito: Circuito;
  origen: OrigenVenta;
  acopioId?: string;
  formaPago: FormaPagoVenta;
  items: ItemNPInput[];
  descuentoPct: number;
  pendienteEntrega: boolean;
  modalidadEntrega: ModalidadEntrega;
  fechaEntregaProgramada?: string;
  direccionEntrega?: string;
  observaciones?: string;
  cotizacionId?: string;
  /** USD: la NP se presenta en dólares (importes en pesos; ver `monedaDocumento`). */
  moneda?: Moneda;
}

export interface OpcionesConfirmacion {
  /** DUENO/ADMIN: confirmar aunque no haya disponible (queda auditado). */
  forzarSinDisponible?: boolean;
  /** DUENO/ADMIN: retiro que deja el saldo del acopio negativo. */
  autorizarSaldoNegativo?: boolean;
  /** Excepción de límite de crédito. */
  excepcionCredito?: boolean;
}

/** Lo que se hace en el mismo paso al confirmar la venta (como en el sistema anterior: guardar y listo). */
export interface ExtrasVenta {
  /** El cliente se lleva la mercadería ahora: remito hecho y baja de stock. */
  retiraAhora?: boolean;
  /** Emitir el comprobante (F1 fiscal o F2 interno según el circuito). */
  facturar?: boolean;
  /** Cobro en el momento: recibo imputado a la factura. */
  cobro?: { medios: MedioCobro[] };
  /** Datos del comprador para la factura (Mercado Libre). */
  datosFactura?: Pick<Comprobante, "ventaML" | "compradorNombre" | "compradorDoc">;
}

export interface ResultadoVenta {
  npId: string;
  numero: string;
  clienteId: string;
  facturaId?: string;
  facturaNumero?: string;
  reciboId?: string;
  reciboNumero?: string;
  remitoId?: string;
  remitoNumero?: string;
}

export type EntregaAceptacion = "RETIRA_AHORA" | "RETIRA_DESPUES" | "ENVIO";

export interface AceptacionCotizacion {
  /** Datos del cliente: obligatorio en cotizaciones rápidas; en las demás actualiza nombre/CUIT si se cambiaron. */
  cliente?: DatosClienteVenta;
  circuito: Circuito;
  formaPago: "CONTADO" | "CUENTA_CORRIENTE";
  sucursalId?: string;
  depositoId?: string;
  entrega: EntregaAceptacion;
  fechaEntregaProgramada?: string;
  direccionEntrega?: string;
  facturar: boolean;
  cobro?: { medios: MedioCobro[] };
  observaciones?: string;
  opciones?: OpcionesConfirmacion;
}

export interface CotizacionInput {
  /** Vacío en cotizaciones rápidas: alcanza con nombre y teléfono del interesado. */
  clienteId?: string;
  prospectoNombre?: string;
  prospectoTelefono?: string;
  tipoCliente?: string;
  /** BORRADOR = "Guardar borrador"; PENDIENTE (por defecto) = "Crear". */
  estado?: "BORRADOR" | "PENDIENTE";
  obraId?: string;
  sucursalId: string;
  circuito: Circuito;
  fecha: string;
  validezDias: number;
  items: ItemVenta[];
  descuentoPct: number;
  observaciones?: string;
  /** USD: la cotización se presenta en dólares (importes en pesos; ver `monedaDocumento`). */
  moneda?: Moneda;
}

/** Nombre del cliente o del interesado de una cotización. */
const cliente = (tx: Tx, c: Pick<Cotizacion, "clienteId" | "prospectoNombre">) => (c.clienteId ? tx.find("clientes", c.clienteId)?.razonSocial : c.prospectoNombre) ?? "";

/** Arma los ítems y totales de una NP a partir del input (precios congelados si es de acopio). */
function armarNP(tx: Tx, data: NotaPedidoInput, previos: ItemNP[] = []) {
  const items = data.items.filter((i) => i.productoId && i.cantidad > 0);
  if (!items.length) throw new ErrorNegocio("Agregá al menos un producto con cantidad.");
  const acopio = data.origen === "ACOPIO" ? (data.acopioId ? tx.must("acopios", data.acopioId) : undefined) : undefined;
  if (data.origen === "ACOPIO" && !acopio) throw new ErrorNegocio("Elegí el acopio del que se retira.");
  const its: ItemNP[] = items.map((i) => {
    let precio = i.precioUnitario;
    let costo = tx.find("productos", i.productoId)?.costoPromedio ?? 0;
    if (acopio) {
      const pc = precioCongelado(acopio, i.productoId);
      if (!pc) throw new ErrorNegocio(`${tx.find("productos", i.productoId)?.nombre ?? "El producto"} no está en la lista congelada del acopio.`);
      precio = pc.precio;
      costo = pc.costoSnapshot;
    }
    const desc = acopio ? 0 : i.descuentoPct ?? 0;
    const prev = previos.find((p) => p.id === i.id);
    return {
      id: prev?.id ?? newId("inp"),
      productoId: i.productoId,
      obraId: i.obraId,
      cantidad: i.cantidad,
      entregados: prev?.entregados ?? 0,
      devueltos: prev?.devueltos,
      precioUnitario: precio,
      costoUnitarioSnapshot: costo,
      descuentoPct: desc || undefined,
      subtotal: round2(i.cantidad * precio * (1 - desc / 100)),
      unidadVenta: i.unidadVenta,
    };
  });
  const monto = round2(its.reduce((a, i) => a + i.subtotal, 0));
  const desc = acopio ? 0 : data.descuentoPct || 0;
  const iva = acopio || data.circuito === 2 ? 0 : tx.config.ivaPct;
  const t = calcularTotales(its.map((i) => ({ cantidad: i.cantidad, precioUnitario: i.precioUnitario, descuentoPct: i.descuentoPct })), desc, iva);
  return { its, monto, desc, iva: t.iva, total: acopio ? monto : t.total, acopio };
}

/** Ventas: notas de pedido (venta nueva y retiro de acopio), remitos, facturación, devoluciones y cotizaciones. */
export function crearSliceVentas(set: SetFn, get: GetFn) {
  const guardar = (tx: Tx, data: NotaPedidoInput, id?: string): NotaPedido => {
    exigir(tx, data.origen === "ACOPIO" ? "acopios.editar" : "ventas.editar");
    if (!data.clienteId) throw new ErrorNegocio("Elegí un cliente.");
    const c = tx.must("clientes", data.clienteId);
    const { its, monto, desc, iva, total, acopio } = armarNP(tx, data, id ? tx.must("notasPedido", id).items : []);
    const formaPago: FormaPagoVenta = data.origen === "ACOPIO" ? "ACOPIO" : data.formaPago === "ACOPIO" ? "CONTADO" : data.formaPago;
    const base = {
      circuito: acopio?.circuito ?? data.circuito,
      tipo: (data.origen === "ACOPIO" ? "RETIRO_ACOPIO" : "VENTA") as NotaPedido["tipo"],
      origen: data.origen,
      acopioId: acopio?.id,
      cotizacionId: data.cotizacionId,
      clienteId: c.id,
      sucursalId: data.sucursalId,
      depositoId: acopio?.depositoId ?? data.depositoId,
      vendedorId: data.vendedorId ?? c.vendedorId ?? tx.usuarioId,
      fecha: data.fecha,
      items: its,
      monto,
      descuentoPct: desc,
      iva,
      total,
      formaPago,
      condicionPago: formaPago === "CONTADO" ? ("CONTADO" as const) : formaPago === "ACOPIO" ? ("ANTICIPO" as const) : c.condicionPago,
      pendienteEntrega: data.pendienteEntrega,
      modalidadEntrega: data.modalidadEntrega,
      fechaEntregaProgramada: data.fechaEntregaProgramada,
      direccionEntrega: data.direccionEntrega,
      observaciones: data.observaciones,
      moneda: monedaDocumento(c, data.moneda, data.origen === "ACOPIO"),
      tipoCambioAplicado: undefined,
      tipoCambioFecha: undefined,
    };
    if (id) {
      const np = tx.must("notasPedido", id);
      if (np.estado !== "BORRADOR") throw new ErrorNegocio("Solo se pueden editar notas de pedido en borrador.");
      tx.patch("notasPedido", id, base);
      tx.auditar("Editó nota de pedido", "NotaPedido", id, "Borrador");
      return tx.must("notasPedido", id);
    }
    const np: NotaPedido = { id: newId("np"), numero: "", ...base, estado: "BORRADOR", remitoIds: [], comprobanteIds: [], ...tx.meta() };
    tx.insert("notasPedido", np);
    tx.auditar("Creó borrador de nota de pedido", "NotaPedido", np.id, c.razonSocial);
    return np;
  };

  const confirmar = (tx: Tx, id: string, opts: OpcionesConfirmacion = {}): NotaPedido => {
    const np = tx.must("notasPedido", id);
    exigir(tx, np.origen === "ACOPIO" ? "acopios.editar" : "ventas.confirmar");
    if (np.estado !== "BORRADOR") throw new ErrorNegocio("La nota de pedido ya está confirmada.");
    const u = tx.find("usuarios", tx.usuarioId);
    // Control de sobreventa: contra disponible (físico − pendiente de entrega − reservado).
    const porProducto = new Map<string, number>();
    for (const it of np.items) porProducto.set(it.productoId, (porProducto.get(it.productoId) ?? 0) + it.cantidad);
    const faltantes: string[] = [];
    for (const [pid, q] of porProducto) if (q > disponible(tx, pid, np.depositoId) + 1e-9) faltantes.push(pid);
    if (faltantes.length) {
      if (!opts.forzarSinDisponible) throw new ErrorNegocio(mensajeSinDisponible(tx, faltantes[0], np.depositoId, porProducto.get(faltantes[0])!), "SIN_DISPONIBLE");
      if (!puede(u, "stock.forzarVenta")) throw new ErrorNegocio("Solo Dueño o Administración pueden forzar una venta sin disponible.", "PERMISO");
      tx.auditar("Forzó venta sin disponible", "NotaPedido", np.id, faltantes.map((p) => tx.find("productos", p)?.codigo).join(", "));
    }
    // Acopio: el retiro no puede superar el saldo.
    if (np.acopioId) {
      const a = tx.must("acopios", np.acopioId);
      if (a.estado === "CANCELADO") throw new ErrorNegocio("El acopio está cancelado.");
      const v = validarRetiro(saldoAcopio(tx, a.id), np.monto);
      if (!v.ok) {
        if (!opts.autorizarSaldoNegativo) throw new ErrorNegocio(`El retiro (${formatMoney(np.monto)}) supera el saldo disponible del acopio (${formatMoney(v.saldoAntes)}).`, "SALDO_ACOPIO");
        if (!puede(u, "acopios.autorizar")) throw new ErrorNegocio("Solo Dueño o Administración pueden autorizar un retiro sin saldo.", "PERMISO");
        tx.auditar("Autorizó retiro sin saldo", "Acopio", a.id, `${np.numero || "NP"} · saldo luego ${formatMoney(v.saldoDespues)}`);
      }
      if (a.formaPago === "CUENTA_CORRIENTE") {
        const pagado = pagadoAcopio(a, tx.get("comprobantes"));
        const retirado = retiradoAcopio(a.id, tx.get("notasPedido"), tx.get("devoluciones"));
        if (retirado + np.monto > pagado + 0.01 && !opts.autorizarSaldoNegativo && !puede(u, "acopios.autorizar"))
          throw new ErrorNegocio(`El cliente pagó ${formatMoney(pagado)} y con este retiro llevaría ${formatMoney(retirado + np.monto)} retirado. Necesita autorización.`, "IMPAGO");
      }
    }
    // Crédito para cuenta corriente.
    if (np.formaPago === "CUENTA_CORRIENTE") {
      const c = tx.must("clientes", np.clienteId);
      if (c.limiteCredito > 0) {
        const saldo = saldoCliente(c.id, tx.get("comprobantes"));
        if (saldo + np.total > c.limiteCredito && !opts.excepcionCredito)
          throw new ErrorNegocio(`Supera el límite de crédito de ${c.razonSocial} (${formatMoney(c.limiteCredito)}; saldo actual ${formatMoney(saldo)}).`, "CREDITO");
        if (saldo + np.total > c.limiteCredito) {
          if (!puede(u, "credito.autorizar")) throw new ErrorNegocio("No tenés permiso para autorizar excepciones de crédito.", "PERMISO");
          tx.auditar("Autorizó excepción de crédito", "NotaPedido", np.id, c.razonSocial);
        }
      }
    }
    const tc = np.moneda === "USD" ? tipoCambioVigente(tx) : undefined;
    const numero = tx.numero("NP", np.circuito, puntoVentaDe(tx, np.sucursalId));
    tx.patch("notasPedido", np.id, {
      numero,
      ...(tc ? { tipoCambioAplicado: tc.valor, tipoCambioFecha: tc.fecha } : {}),
      estado: "PENDIENTE",
      fechaConfirmacion: tx.ahora,
      forzadoSinDisponible: faltantes.length > 0 || undefined,
      autorizadoSaldoNegativo: opts.autorizarSaldoNegativo || undefined,
      excepcionCredito: opts.excepcionCredito || undefined,
    });
    if (np.cotizacionId) tx.patch("cotizaciones", np.cotizacionId, { estado: "ACEPTADA", notaPedidoId: np.id });
    const c = tx.must("clientes", np.clienteId);
    tx.auditar("Confirmó nota de pedido", "NotaPedido", np.id, `${numero} · ${c.razonSocial} · ${formatMoney(np.total)}${np.acopioId ? " · retiro de acopio" : ""}`);
    if (np.acopioId) actualizarEstadoAcopio(tx, np.acopioId);
    return tx.must("notasPedido", np.id);
  };

  /** Factura de una NP confirmada (F1 o F2 según el circuito). */
  const facturarNP = (tx: Tx, npId: string, datosFactura?: ExtrasVenta["datosFactura"]): Comprobante => {
    const np = tx.must("notasPedido", npId);
    if (np.origen === "ACOPIO") throw new ErrorNegocio("Los retiros de acopio no se facturan: el acopio ya está facturado.");
    if (np.estado === "BORRADOR" || np.estado === "ANULADA") throw new ErrorNegocio("La nota de pedido no está confirmada.");
    if (tx.get("comprobantes").some((c) => np.comprobanteIds.includes(c.id) && c.tipo === "FACTURA" && c.estado !== "ANULADO")) throw new ErrorNegocio("La nota de pedido ya está facturada.");
    const neto = r2(np.total - np.iva);
    const fac = crearFacturaVenta(tx, {
      clienteId: np.clienteId,
      sucursalId: np.sucursalId,
      circuito: np.circuito,
      total: np.total,
      neto,
      npId: np.id,
      vencimientoDias: np.formaPago === "CONTADO" ? 0 : undefined,
      items: np.items.map((i) => ({ id: i.id, productoId: i.productoId, obraId: i.obraId, cantidad: i.cantidad, precioUnitario: i.precioUnitario, costoUnitarioSnapshot: i.costoUnitarioSnapshot, descuentoPct: i.descuentoPct ?? 0, unidadVenta: i.unidadVenta })),
      observaciones: np.observaciones,
      datosFactura,
    });
    tx.patch("notasPedido", np.id, (x) => ({ ...x, comprobanteIds: [...x.comprobanteIds, fac.id] }));
    for (const rid of tx.must("notasPedido", np.id).remitoIds) {
      const r = tx.find("remitos", rid);
      if (r) tx.patch("remitos", rid, { facturado: true, facturasRef: [...(r.facturasRef ?? []), fac.numero] });
    }
    tx.auditar("Facturó nota de pedido", "Comprobante", fac.id, `${fac.numero} · ${np.numero} · ${formatMoney(fac.total)}`);
    return fac;
  };

  /** Lo que se hace después de confirmar la NP en el mismo paso: remito, comprobante y cobro. */
  const completarVenta = (tx: Tx, npId: string, extras: ExtrasVenta): ResultadoVenta => {
    const np = tx.must("notasPedido", npId);
    const out: ResultadoVenta = { npId: np.id, numero: np.numero, clienteId: np.clienteId };
    if (extras.retiraAhora) {
      const r = crearRemitoNP(tx, np.id, null, "HECHO");
      out.remitoId = r.id;
      out.remitoNumero = r.numero;
    }
    const medios = extras.cobro?.medios.filter((m) => m.importe > 0 || (m.importeME ?? 0) > 0) ?? [];
    let fac: Comprobante | undefined;
    if (np.origen !== "ACOPIO" && (extras.facturar || medios.length)) {
      exigir(tx, "ventas.facturar");
      fac = facturarNP(tx, np.id, extras.datosFactura);
      out.facturaId = fac.id;
      out.facturaNumero = fac.numero;
    }
    if (medios.length) {
      exigir(tx, "ctacte.cobrar");
      const recibido = medios.reduce((a, m) => a + (m.medio === "EFECTIVO" && m.moneda === "USD" ? (m.importeME ?? 0) * (m.tipoCambio ?? 0) : m.importe), 0);
      const cob = registrarCobro(tx, {
        clienteId: np.clienteId,
        circuito: np.circuito,
        fecha: tx.ahora,
        sucursalId: np.sucursalId,
        medios,
        imputaciones: fac ? [{ comprobanteId: fac.id, importe: r2(Math.min(recibido, fac.saldoPendiente)) }] : [],
      });
      out.reciboId = cob.id;
      out.reciboNumero = cob.numero;
    }
    return out;
  };

  /** Anula una factura: con CAE de ARCA lleva nota de crédito; si no, se anula directamente. */
  const anularFacturaTx = (tx: Tx, facturaId: string, motivo: string) => {
    const f = tx.must("comprobantes", facturaId);
    if (f.estado === "ANULADO") return;
    if (f.tipo !== "FACTURA") throw new ErrorNegocio("Solo se anulan facturas.");
    // Recibos imputados: si cubren solo esta factura se anulan; si no, se libera lo imputado como saldo a favor.
    for (const cob of tx.get("cobranzas").filter((c) => !c.anulado && c.imputaciones.some((i) => i.comprobanteId === f.id))) {
      if (cob.imputaciones.every((i) => i.comprobanteId === f.id)) anularRecibo(tx, cob.id, `Anulación de ${f.numero}: ${motivo}`);
      else {
        const imp = cob.imputaciones.find((i) => i.comprobanteId === f.id)!;
        tx.patch("cobranzas", cob.id, { imputaciones: cob.imputaciones.filter((i) => i.comprobanteId !== f.id), saldoAFavor: r2((cob.saldoAFavor ?? 0) + imp.importe) });
        tx.insert("comprobantes", { id: newId("cmp"), tipo: "SALDO_A_FAVOR", circuito: cob.circuito, numero: `${cob.numero} (a favor por anulación de ${f.numero})`, clienteId: cob.clienteId, sucursalId: cob.sucursalId, fecha: tx.ahora, subtotal: imp.importe, iva: 0, total: imp.importe, saldoPendiente: -imp.importe, estado: "PENDIENTE", observaciones: `Pago liberado al anular ${f.numero}`, ...tx.meta() });
      }
    }
    // Saldos a favor / NC aplicados a esta factura: vuelven a quedar disponibles.
    for (const cr of tx.get("comprobantes").filter((c) => c.id !== f.id && c.aplicadoA?.some((a) => a.comprobanteId === f.id) && c.estado !== "ANULADO")) {
      if (cr.tipo === "NOTA_CREDITO" && cr.comprobanteOrigenId === f.id) continue;
      const imp = cr.aplicadoA!.filter((a) => a.comprobanteId === f.id).reduce((a, x) => a + x.importe, 0);
      tx.patch("comprobantes", cr.id, { aplicadoA: cr.aplicadoA!.filter((a) => a.comprobanteId !== f.id), saldoPendiente: r2(cr.saldoPendiente - imp), estado: "PENDIENTE" });
    }
    const actual = tx.must("comprobantes", f.id);
    if (f.arcaEstado === "AUTORIZADO") {
      const nc: Comprobante = {
        id: newId("cmp"),
        tipo: "NOTA_CREDITO",
        letra: f.letra,
        circuito: f.circuito,
        numero: tx.numero("NC", f.circuito, puntoVentaDe(tx, f.sucursalId ?? tx.get("sucursales")[0]?.id ?? "")),
        clienteId: f.clienteId,
        notaPedidoId: f.notaPedidoId,
        comprobanteOrigenId: f.id,
        aplicadoA: [{ comprobanteId: f.id, importe: f.total }],
        sucursalId: f.sucursalId,
        fecha: tx.ahora,
        subtotal: f.subtotal,
        iva: f.iva,
        total: f.total,
        saldoPendiente: 0,
        estado: "PAGADO",
        items: f.items,
        observaciones: `Anulación de ${f.numero}: ${motivo}`,
        arcaEstado: "PENDIENTE",
        compradorNombre: f.compradorNombre,
        compradorDoc: f.compradorDoc,
        ...tx.meta(),
      };
      tx.insert("comprobantes", nc);
      if (f.notaPedidoId) tx.patch("notasPedido", f.notaPedidoId, (x) => ({ ...x, comprobanteIds: [...x.comprobanteIds, nc.id] }));
      tx.patch("comprobantes", f.id, { estado: "ANULADO", saldoPendiente: 0, motivoAnulacion: motivo });
      tx.auditar("Anuló factura con nota de crédito", "Comprobante", f.id, `${f.numero} · ${nc.numero} · ${motivo}`);
    } else {
      tx.patch("comprobantes", f.id, { estado: "ANULADO", saldoPendiente: 0, motivoAnulacion: motivo, arcaEstado: actual.arcaEstado === "PENDIENTE" ? "NO_APLICA" : actual.arcaEstado });
      tx.auditar("Anuló factura", "Comprobante", f.id, `${f.numero} · ${motivo}`);
    }
  };

  const anularVentaTx = (tx: Tx, npId: string, motivo: string) => {
    const np = tx.must("notasPedido", npId);
    if (np.estado === "ANULADA") throw new ErrorNegocio("La venta ya está anulada.");
    if (np.estado === "BORRADOR") throw new ErrorNegocio("Es un borrador: eliminalo.");
    if (!motivo.trim()) throw new ErrorNegocio("Indicá el motivo de la anulación.");
    // 1. Comprobantes (y con ellos los cobros).
    for (const c of tx.get("comprobantes").filter((x) => np.comprobanteIds.includes(x.id) && x.tipo === "FACTURA" && x.estado !== "ANULADO")) anularFacturaTx(tx, c.id, motivo.trim());
    // 2. Remitos: los abiertos se anulan; lo entregado vuelve al stock con un remito de devolución.
    const entregado = np.items.filter((i) => i.entregados > 0);
    for (const rid of np.remitoIds) {
      const r = tx.find("remitos", rid);
      if (r && r.estado !== "HECHO" && r.estado !== "ANULADO") tx.patch("remitos", rid, { estado: "ANULADO" });
    }
    if (entregado.length) {
      const rd: Remito = {
        id: newId("rem"),
        numero: tx.numero("RD", np.circuito, puntoVentaDe(tx, np.sucursalId)),
        circuito: np.circuito,
        tipo: "DEVOLUCION",
        notaPedidoId: np.id,
        acopioId: np.acopioId,
        clienteId: np.clienteId,
        sucursalId: np.sucursalId,
        depositoId: np.depositoId,
        fecha: tx.ahora,
        items: entregado.map((i) => ({ productoId: i.productoId, cantidad: i.entregados, itemNPId: i.id, obraId: i.obraId })),
        cantidadTotal: entregado.reduce((a, i) => a + i.entregados, 0),
        pesoTotalKg: Math.round(entregado.reduce((a, i) => a + i.entregados * (tx.find("productos", i.productoId)?.pesoKg ?? 0), 0)),
        valorDeclarado: r2(entregado.reduce((a, i) => a + i.entregados * i.precioUnitario, 0)),
        estado: "INICIAL",
        facturado: true,
        comentario: `Anulación de la venta ${np.numero}`,
        ...tx.meta(),
      };
      tx.insert("remitos", rd);
      marcarHecho(tx, rd.id);
      tx.patch("notasPedido", np.id, (x) => ({ ...x, remitoIds: [...x.remitoIds, rd.id], items: x.items.map((i) => (i.entregados > 0 ? { ...i, devueltos: (i.devueltos ?? 0) + i.entregados, entregados: 0 } : i)) }));
    }
    // 3. Despachos pendientes.
    for (const d of tx.get("despachos")) if (d.notaPedidoId === np.id && d.estado !== "ENTREGADO" && d.estado !== "CANCELADO" && d.estado !== "FINALIZADO") tx.patch("despachos", d.id, { estado: "CANCELADO" });
    tx.patch("notasPedido", np.id, { estado: "ANULADA", pendienteEntrega: false, motivoAnulacion: motivo.trim(), anuladaEn: tx.ahora });
    tx.auditar("Anuló venta", "NotaPedido", np.id, `${np.numero} · ${motivo.trim()}`);
    if (np.acopioId) actualizarEstadoAcopio(tx, np.acopioId);
  };

  /** Arma la cotización (ítems, totales, moneda) a partir del input. */
  const armarCotizacion = (tx: Tx, data: CotizacionInput) => {
    const cliente = data.clienteId ? tx.must("clientes", data.clienteId) : undefined;
    if (!cliente && !data.prospectoNombre?.trim()) throw new ErrorNegocio("Elegí un cliente o cargá el nombre de quien consulta.");
    const items = data.items.filter((i) => i.productoId && i.cantidad > 0).map((i) => ({ ...i, id: i.id || newId("icot"), costoUnitarioSnapshot: tx.find("productos", i.productoId)?.costoPromedio ?? 0 }));
    if (!items.length) throw new ErrorNegocio("Agregá al menos un producto con cantidad.");
    const t = calcularTotales(items, data.descuentoPct, data.circuito === 1 ? tx.config.ivaPct : 0);
    const moneda = cliente ? monedaDocumento(cliente, data.moneda) : "ARS";
    const tc = moneda === "USD" ? tipoCambioVigente(tx) : undefined;
    const { estado: _e, ...resto } = data;
    void _e;
    return {
      ...resto,
      clienteId: cliente?.id,
      prospectoNombre: cliente ? undefined : data.prospectoNombre?.trim(),
      prospectoTelefono: cliente ? undefined : data.prospectoTelefono?.trim() || undefined,
      observaciones: data.observaciones?.trim() || undefined,
      items,
      subtotal: t.subtotal,
      iva: t.iva,
      total: t.total,
      moneda,
      tipoCambioAplicado: tc?.valor,
      tipoCambioFecha: tc?.fecha,
    };
  };

  return {
    guardarNotaPedido: (data: NotaPedidoInput, id?: string) => ejecutar(get, set, (tx) => guardar(tx, data, id).id),

    confirmarNotaPedido: (id: string, opts?: OpcionesConfirmacion) => ejecutar(get, set, (tx) => confirmar(tx, id, opts).numero),

    /** Guarda y confirma en un paso. Devuelve el id de la NP. */
    crearNotaPedido: (data: NotaPedidoInput, opts?: OpcionesConfirmacion, id?: string) =>
      ejecutar(get, set, (tx) => {
        const np = guardar(tx, data, id);
        return confirmar(tx, np.id, opts).id;
      }),

    eliminarBorradorNP: (id: string) =>
      ejecutar(get, set, (tx) => {
        const np = tx.must("notasPedido", id);
        if (np.estado !== "BORRADOR") throw new ErrorNegocio("Solo se pueden eliminar borradores.");
        tx.remove("notasPedido", id);
      }),

    anularNotaPedido: (id: string, motivo: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.anular");
        const np = tx.must("notasPedido", id);
        if (np.estado === "ANULADA") throw new ErrorNegocio("Ya está anulada.");
        if (np.items.some((i) => i.entregados > 0)) throw new ErrorNegocio("Tiene mercadería entregada: registrá una devolución en lugar de anular.");
        for (const rid of np.remitoIds) {
          const r = tx.find("remitos", rid);
          if (r && r.estado !== "HECHO" && r.estado !== "ANULADO") tx.patch("remitos", rid, { estado: "ANULADO" });
        }
        for (const d of tx.get("despachos")) if (d.notaPedidoId === id && (d.estado === "ESPERA" || d.estado === "PREPARACION")) tx.patch("despachos", d.id, { estado: "CANCELADO" });
        tx.patch("notasPedido", id, { estado: "ANULADA", pendienteEntrega: false, observaciones: [np.observaciones, `Anulada: ${motivo}`].filter(Boolean).join(" · ") });
        tx.auditar("Anuló nota de pedido", "NotaPedido", id, `${np.numero} · ${motivo}`);
        if (np.acopioId) actualizarEstadoAcopio(tx, np.acopioId);
      }),

    /** Genera un remito. Entrega inmediata → PICKING; cliente retira → HECHO directo. */
    generarRemito: (npId: string, opts: { lineas?: { itemId: string; cantidad: number }[]; estado?: "INICIAL" | "PICKING" | "HECHO" } = {}) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const np = tx.must("notasPedido", npId);
        // Entrega inmediata → picking; pendiente con "cliente retira" → hecho directo cuando viene a buscarlo.
        const estado = opts.estado ?? (np.pendienteEntrega && np.modalidadEntrega === "RETIRA" ? "HECHO" : "PICKING");
        const r = crearRemitoNP(tx, npId, opts.lineas ?? null, estado);
        return { id: r.id, numero: r.numero, estado: r.estado };
      }),

    /** Retiro en mostrador: remito HECHO con lo pendiente (o las líneas indicadas). */
    retiroEnMostrador: (npId: string, lineas?: { itemId: string; cantidad: number }[]) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const r = crearRemitoNP(tx, npId, lineas ?? null, "HECHO");
        return { id: r.id, numero: r.numero };
      }),

    facturarNotaPedido: (npId: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.facturar");
        const fac = facturarNP(tx, npId);
        return { id: fac.id, numero: fac.numero };
      }),

    /**
     * Venta en un solo paso (como el sistema anterior): nota de pedido confirmada y, en la misma
     * operación, remito si se lo lleva, comprobante y cobro imputado a ese comprobante.
     */
    crearVenta: (data: NotaPedidoInput, opts: OpcionesConfirmacion | undefined, extras: ExtrasVenta, id?: string) =>
      ejecutar(get, set, (tx) => {
        const datos = data.clienteId === CLIENTE_MELI ? { ...data, clienteId: clienteMercadoLibre(tx).id } : data;
        if (data.clienteId === CLIENTE_MELI && !extras.datosFactura?.compradorNombre?.trim()) throw new ErrorNegocio("Cargá el nombre del comprador.");
        const np = confirmar(tx, guardar(tx, datos, id).id, opts);
        return completarVenta(tx, np.id, extras);
      }),

    /**
     * Anula una venta con todo lo que quedó conectado: recibos (o la parte imputada a esta venta),
     * comprobantes (con nota de crédito si ya estaban autorizados por ARCA), remitos (lo entregado
     * vuelve al stock con un remito de devolución) y despachos. Queda en "Ventas anuladas".
     */
    anularVenta: (npId: string, motivo: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.anular");
        anularVentaTx(tx, npId, motivo);
      }),

    /** Vuelve a dejar pendiente la cotización de una venta anulada (para aceptarla de nuevo). */
    recuperarVenta: (npId: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const np = tx.must("notasPedido", npId);
        if (np.estado !== "ANULADA") throw new ErrorNegocio("Solo se recuperan ventas anuladas.");
        const cot = np.cotizacionId ? tx.find("cotizaciones", np.cotizacionId) : undefined;
        if (cot && cot.estado === "ACEPTADA" && cot.notaPedidoId === np.id) {
          tx.patch("cotizaciones", cot.id, { estado: "PENDIENTE", notaPedidoId: undefined, fechaRespuesta: undefined, motivoRechazo: undefined });
          tx.auditar("Recuperó venta anulada", "Cotizacion", cot.id, `${np.numero} → ${cot.numero} pendiente`);
          return cot.id;
        }
        if (cot && cot.estado !== "RECHAZADA") throw new ErrorNegocio(`Esta venta ya se recuperó en la cotización ${cot.numero}.`);
        const c = tx.must("clientes", np.clienteId);
        const items: ItemVenta[] = np.items.map((i) => ({ id: newId("icot"), productoId: i.productoId, obraId: i.obraId, cantidad: i.cantidad, precioUnitario: i.precioUnitario, costoUnitarioSnapshot: i.costoUnitarioSnapshot, descuentoPct: i.descuentoPct ?? 0, unidadVenta: i.unidadVenta }));
        const t = calcularTotales(items, np.descuentoPct, np.circuito === 1 ? tx.config.ivaPct : 0);
        const nueva: Cotizacion = {
          id: newId("cot"),
          numero: tx.numero("COT", np.circuito, puntoVentaDe(tx, np.sucursalId)),
          circuito: np.circuito,
          clienteId: c.id,
          sucursalId: np.sucursalId,
          vendedorId: np.vendedorId,
          estado: "PENDIENTE",
          fecha: tx.ahora,
          validezDias: tx.config.validezPresupuestoDias,
          items,
          subtotal: t.subtotal,
          descuentoPct: np.descuentoPct,
          iva: t.iva,
          total: t.total,
          observaciones: `Recuperada de la venta anulada ${np.numero}`,
          ...tx.meta(),
        };
        tx.insert("cotizaciones", nueva);
        tx.patch("notasPedido", np.id, { cotizacionId: nueva.id });
        tx.auditar("Recuperó venta anulada", "Cotizacion", nueva.id, `${np.numero} → ${nueva.numero} pendiente`);
        return nueva.id;
      }),

    /** Anula una factura suelta (sin venta asociada, ej. Mercado Libre): ver `anularFacturaTx`. */
    anularFactura: (id: string, motivo: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.anular");
        const f = tx.must("comprobantes", id);
        if (f.notaPedidoId) {
          anularVentaTx(tx, f.notaPedidoId, motivo);
          return;
        }
        anularFacturaTx(tx, id, motivo);
      }),

    /** Resultado de pedir el CAE a ARCA (lo llama el servidor después de emitir la factura). */
    registrarResultadoArca: (comprobanteId: string, r: { ok: true; cae: string; caeVencimiento: string; puntoVenta: number; numero: number; tipo: number } | { ok: false; error: string }) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.ver");
        const c = tx.must("comprobantes", comprobanteId);
        if (c.arcaEstado === "AUTORIZADO") return;
        if (!r.ok && c.estado === "ANULADO") return;
        if (r.ok) {
          tx.patch("comprobantes", c.id, { arcaEstado: "AUTORIZADO", cae: r.cae, caeVencimiento: r.caeVencimiento, arcaPuntoVenta: r.puntoVenta, arcaNumero: r.numero, arcaTipo: r.tipo, arcaError: undefined });
          tx.auditar("Autorizó comprobante en ARCA", "Comprobante", c.id, `${c.numero} · CAE ${r.cae}`);
          // Se anuló mientras ARCA la autorizaba: ya es fiscal, lleva nota de crédito.
          if (c.tipo === "FACTURA" && c.estado === "ANULADO" && !tx.get("comprobantes").some((n) => n.tipo === "NOTA_CREDITO" && n.comprobanteOrigenId === c.id)) {
            const nc: Comprobante = {
              id: newId("cmp"),
              tipo: "NOTA_CREDITO",
              letra: c.letra,
              circuito: c.circuito,
              numero: tx.numero("NC", c.circuito, puntoVentaDe(tx, c.sucursalId ?? tx.get("sucursales")[0]?.id ?? "")),
              clienteId: c.clienteId,
              notaPedidoId: c.notaPedidoId,
              comprobanteOrigenId: c.id,
              aplicadoA: [{ comprobanteId: c.id, importe: c.total }],
              sucursalId: c.sucursalId,
              fecha: tx.ahora,
              subtotal: c.subtotal,
              iva: c.iva,
              total: c.total,
              saldoPendiente: 0,
              estado: "PAGADO",
              items: c.items,
              observaciones: `Anulación de ${c.numero}${c.motivoAnulacion ? `: ${c.motivoAnulacion}` : ""}`,
              arcaEstado: "PENDIENTE",
              compradorNombre: c.compradorNombre,
              compradorDoc: c.compradorDoc,
              ...tx.meta(),
            };
            tx.insert("comprobantes", nc);
          }
        } else {
          tx.patch("comprobantes", c.id, { arcaEstado: c.arcaEstado === "PENDIENTE" ? "PENDIENTE" : "RECHAZADO", arcaError: r.error.slice(0, 500) });
        }
      }),

    /**
     * Devolución de una NP (DP): baja lo pendiente o reingresa lo entregado con un
     * remito de devolución (RD); si estaba facturada genera NC; si es de acopio el
     * saldo del acopio vuelve a subir.
     */
    registrarDevolucion: (data: { notaPedidoId: string; items: { itemId: string; cantidad: number }[]; motivo: string; fecha?: string }) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const np = tx.must("notasPedido", data.notaPedidoId);
        if (np.estado === "BORRADOR" || np.estado === "ANULADA") throw new ErrorNegocio("La nota de pedido no está confirmada.");
        if (!data.motivo.trim()) throw new ErrorNegocio("Indicá el motivo de la devolución.");
        const lineas = data.items.filter((l) => l.cantidad > 0);
        if (!lineas.length) throw new ErrorNegocio("Indicá al menos una cantidad a devolver.");
        const fecha = data.fecha ?? tx.ahora;
        const previas = tx.get("devoluciones").filter((d) => d.notaPedidoId === np.id).length;
        const dp: DevolucionNP = {
          id: newId("dp"),
          numero: `DP${np.circuito} ${np.numero.split(" ")[1]}-${previas + 1}`,
          circuito: np.circuito,
          notaPedidoId: np.id,
          acopioId: np.acopioId,
          clienteId: np.clienteId,
          fecha,
          items: [],
          monto: 0,
          motivo: data.motivo.trim(),
          usuarioId: tx.usuarioId,
          ...tx.meta(),
        };
        const reingreso: { itemNPId: string; productoId: string; obraId?: string; cantidad: number }[] = [];
        const items = np.items.map((it) => ({ ...it }));
        for (const l of lineas) {
          const it = items.find((i) => i.id === l.itemId);
          if (!it) throw new ErrorNegocio("Línea inexistente.");
          const devolvible = it.cantidad - (it.devueltos ?? 0);
          if (l.cantidad > devolvible + 1e-9) throw new ErrorNegocio(`Se pueden devolver hasta ${devolvible} de ${tx.find("productos", it.productoId)?.nombre}.`);
          // Primero se da de baja lo pendiente; el resto es mercadería entregada que vuelve.
          const dePendiente = Math.min(l.cantidad, pendienteLinea(it));
          const deEntregado = l.cantidad - dePendiente;
          it.devueltos = (it.devueltos ?? 0) + l.cantidad;
          if (deEntregado > 0) {
            it.entregados -= deEntregado;
            reingreso.push({ itemNPId: it.id, productoId: it.productoId, obraId: it.obraId, cantidad: deEntregado });
          }
          const sub = round2(l.cantidad * it.precioUnitario * (1 - (it.descuentoPct ?? 0) / 100));
          dp.items.push({ itemNPId: it.id, productoId: it.productoId, obraId: it.obraId, cantidad: l.cantidad, precioUnitario: it.precioUnitario, subtotal: sub });
        }
        const neto = round2(dp.items.reduce((a, i) => a + (i.subtotal ?? 0), 0) * (1 - np.descuentoPct / 100));
        dp.monto = -neto;
        tx.patch("notasPedido", np.id, { items });
        let rd: Remito | undefined;
        if (reingreso.length) {
          rd = {
            id: newId("rem"),
            numero: tx.numero("RD", np.circuito, puntoVentaDe(tx, np.sucursalId)),
            circuito: np.circuito,
            tipo: "DEVOLUCION",
            notaPedidoId: np.id,
            acopioId: np.acopioId,
            devolucionId: dp.id,
            clienteId: np.clienteId,
            obraId: reingreso[0].obraId,
            sucursalId: np.sucursalId,
            depositoId: np.depositoId,
            fecha,
            items: reingreso.map((r) => ({ productoId: r.productoId, cantidad: r.cantidad, itemNPId: r.itemNPId, obraId: r.obraId })),
            cantidadTotal: reingreso.reduce((a, r) => a + r.cantidad, 0),
            pesoTotalKg: Math.round(reingreso.reduce((a, r) => a + r.cantidad * (tx.find("productos", r.productoId)?.pesoKg ?? 0), 0)),
            valorDeclarado: neto,
            estado: "INICIAL",
            facturado: true,
            ...tx.meta(),
          };
          tx.insert("remitos", rd);
          marcarHecho(tx, rd.id, fecha);
          dp.remitoDevolucionId = rd.id;
        }
        // Nota de crédito si estaba facturado (la NP o el acopio).
        const factura = tx.get("comprobantes").find((c) => c.tipo === "FACTURA" && c.estado !== "ANULADO" && (np.comprobanteIds.includes(c.id) || (np.acopioId && c.acopioId === np.acopioId)));
        if (factura) {
          const ivaPct = np.circuito === 1 && !np.acopioId ? tx.config.ivaPct : 0;
          const total = round2(neto * (1 + ivaPct / 100));
          const aplicable = np.acopioId ? 0 : Math.min(total, factura.saldoPendiente);
          const nc: Comprobante = {
            id: newId("cmp"),
            tipo: "NOTA_CREDITO",
            letra: factura.letra,
            circuito: np.circuito,
            numero: tx.numero("NC", np.circuito, puntoVentaDe(tx, np.sucursalId)),
            clienteId: np.clienteId,
            notaPedidoId: np.id,
            acopioId: np.acopioId,
            devolucionId: dp.id,
            comprobanteOrigenId: factura.id,
            aplicadoA: aplicable > 0 ? [{ comprobanteId: factura.id, importe: aplicable }] : undefined,
            sucursalId: np.sucursalId,
            fecha,
            subtotal: neto,
            iva: round2(total - neto),
            total,
            // Lo que no se aplica a la factura queda como saldo a favor; en acopios vuelve al saldo del acopio.
            saldoPendiente: np.acopioId ? 0 : -round2(total - aplicable),
            estado: np.acopioId || total - aplicable < 0.01 ? "PAGADO" : "PENDIENTE",
            observaciones: np.acopioId ? "Aplicada al saldo del acopio." : undefined,
            ...tx.meta(),
          };
          tx.insert("comprobantes", nc);
          if (aplicable > 0) aplicarAComprobante(tx, factura.id, aplicable);
          dp.notaCreditoId = nc.id;
          tx.patch("notasPedido", np.id, (x) => ({ ...x, comprobanteIds: [...x.comprobanteIds, nc.id] }));
        }
        tx.insert("devoluciones", dp);
        actualizarEstadoNP(tx, np.id);
        if (np.acopioId) actualizarEstadoAcopio(tx, np.acopioId);
        tx.auditar("Registró devolución", "DevolucionNP", dp.id, `${dp.numero} · ${formatMoney(-dp.monto)}${rd ? ` · ${rd.numero}` : ""}`);
        return { id: dp.id, numero: dp.numero, remitoId: rd?.id };
      }),

    // ── Cotizaciones ──
    /** "Crear" (queda pendiente) o "Guardar borrador". También edita las que siguen abiertas. */
    guardarCotizacion: (data: CotizacionInput, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const base = armarCotizacion(tx, data);
        const estado = data.estado ?? "PENDIENTE";
        if (id) {
          const c = tx.must("cotizaciones", id);
          if (c.estado !== "BORRADOR" && c.estado !== "ENVIADA" && c.estado !== "PENDIENTE") throw new ErrorNegocio("La cotización ya no se puede editar.");
          tx.patch("cotizaciones", id, { ...base, estado: c.estado === "BORRADOR" ? estado : c.estado === "ENVIADA" ? "PENDIENTE" : c.estado });
          tx.auditar(c.estado === "BORRADOR" && estado === "PENDIENTE" ? "Creó cotización" : "Editó cotización", "Cotizacion", id, `${c.numero} · ${formatMoney(base.total)}`);
          return id;
        }
        const cot: Cotizacion = {
          id: newId("cot"),
          numero: tx.numero("COT", data.circuito, puntoVentaDe(tx, data.sucursalId)),
          vendedorId: (base.clienteId ? tx.must("clientes", base.clienteId).vendedorId : undefined) ?? tx.usuarioId,
          ...base,
          estado,
          ...tx.meta(),
        };
        tx.insert("cotizaciones", cot);
        tx.auditar(estado === "BORRADOR" ? "Guardó borrador de cotización" : "Creó cotización", "Cotizacion", cot.id, `${cot.numero} · ${cliente(tx, cot)} · ${formatMoney(cot.total)}`);
        return cot.id;
      }),

    /**
     * ✓ Aceptar: la cotización se convierte en venta en un solo paso. Si era rápida, el interesado
     * pasa a ser cliente. Se confirma la nota de pedido y, según lo elegido, se entrega, se factura
     * y se cobra. La cotización sale de la lista de pendientes.
     */
    aceptarCotizacion: (id: string, a: AceptacionCotizacion) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.confirmar");
        const cot = tx.must("cotizaciones", id);
        if (cot.estado !== "PENDIENTE" && cot.estado !== "ENVIADA" && cot.estado !== "BORRADOR") throw new ErrorNegocio(cot.estado === "ACEPTADA" ? "La cotización ya fue aceptada." : "La cotización está anulada: recuperala primero.");
        let cli: Cliente;
        if (cot.clienteId) {
          cli = tx.must("clientes", cot.clienteId);
          // Al facturar se pueden completar o corregir los datos del cliente (nombre, CUIT).
          if (a.cliente) {
            const patch: Partial<Cliente> = {};
            if (a.cliente.razonSocial?.trim() && a.cliente.razonSocial.trim() !== cli.razonSocial) patch.razonSocial = a.cliente.razonSocial.trim();
            if ((a.cliente.cuit ?? "").trim() && a.cliente.cuit!.trim() !== cli.cuit) patch.cuit = a.cliente.cuit!.trim();
            if (a.cliente.condicionIVA && a.cliente.condicionIVA !== cli.condicionIVA) patch.condicionIVA = a.cliente.condicionIVA;
            if (Object.keys(patch).length) {
              tx.patch("clientes", cli.id, patch);
              tx.auditar("Editó cliente", "Cliente", cli.id, `${cli.razonSocial} · datos de facturación`);
              cli = tx.must("clientes", cli.id);
            }
          }
        } else {
          if (!a.cliente) throw new ErrorNegocio("Completá los datos del cliente para convertir la cotización en venta.");
          cli = crearClienteDesdeVenta(tx, { ...a.cliente, telefono: a.cliente.telefono || cot.prospectoTelefono, tipo: a.cliente.tipo || cot.tipoCliente });
        }
        const sucursalId = a.sucursalId ?? cot.sucursalId;
        const depositoId = a.depositoId ?? tx.find("sucursales", sucursalId)?.depositoId ?? tx.get("depositos")[0]?.id ?? "";
        const pendiente = a.entrega !== "RETIRA_AHORA";
        const np = confirmar(
          tx,
          guardar(tx, {
            clienteId: cli.id,
            sucursalId,
            depositoId,
            vendedorId: cot.vendedorId,
            fecha: tx.ahora,
            circuito: a.circuito,
            origen: "NUEVA",
            formaPago: a.formaPago,
            items: cot.items.map((i) => ({ productoId: i.productoId, obraId: i.obraId ?? cot.obraId, cantidad: i.cantidad, precioUnitario: i.precioUnitario, descuentoPct: i.descuentoPct, unidadVenta: i.unidadVenta })),
            descuentoPct: cot.descuentoPct,
            pendienteEntrega: pendiente,
            modalidadEntrega: a.entrega === "ENVIO" ? "ENVIO" : "RETIRA",
            fechaEntregaProgramada: pendiente ? a.fechaEntregaProgramada : undefined,
            direccionEntrega: a.entrega === "ENVIO" ? a.direccionEntrega : undefined,
            observaciones: [cot.observaciones, a.observaciones?.trim()].filter(Boolean).join(" · ") || undefined,
            cotizacionId: cot.id,
            moneda: cot.moneda,
          }).id,
          a.opciones,
        );
        tx.patch("cotizaciones", cot.id, { estado: "ACEPTADA", notaPedidoId: np.id, clienteId: cli.id, fechaRespuesta: tx.ahora, circuito: a.circuito });
        tx.auditar("Aceptó cotización", "Cotizacion", cot.id, `${cot.numero} → ${np.numero} · ${cli.razonSocial}`);
        return completarVenta(tx, np.id, { retiraAhora: a.entrega === "RETIRA_AHORA", facturar: a.facturar, cobro: a.cobro });
      }),

    /** ✗ Anular / rechazada: pasa a "Ventas anuladas" (se puede recuperar). */
    rechazarCotizacion: (id: string, motivo?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const c = tx.must("cotizaciones", id);
        if (c.estado === "ACEPTADA") throw new ErrorNegocio("La cotización ya es una venta: anulá la venta desde Notas de pedido.");
        if (c.estado === "RECHAZADA") throw new ErrorNegocio("La cotización ya está anulada.");
        tx.patch("cotizaciones", id, { estado: "RECHAZADA", motivoRechazo: motivo?.trim() || undefined, fechaRespuesta: tx.ahora });
        tx.auditar("Anuló cotización", "Cotizacion", id, `${c.numero} · ${cliente(tx, c)}${motivo?.trim() ? ` · ${motivo.trim()}` : ""}`);
      }),

    /** Recuperar una cotización anulada: vuelve a pendientes, sin tener que cargarla de nuevo. */
    recuperarCotizacion: (id: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const c = tx.must("cotizaciones", id);
        if (c.estado !== "RECHAZADA" && c.estado !== "VENCIDA") throw new ErrorNegocio("Solo se recuperan cotizaciones anuladas.");
        tx.patch("cotizaciones", id, { estado: "PENDIENTE", motivoRechazo: undefined, fechaRespuesta: undefined, fecha: tx.ahora });
        tx.auditar("Recuperó cotización", "Cotizacion", id, `${c.numero} · ${cliente(tx, c)}`);
      }),

    eliminarCotizacion: (id: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const c = tx.must("cotizaciones", id);
        if (c.estado !== "BORRADOR") throw new ErrorNegocio("Solo se eliminan borradores; las demás se anulan.");
        tx.remove("cotizaciones", id);
        tx.auditar("Eliminó borrador de cotización", "Cotizacion", id, c.numero);
      }),

    cambiarEstadoCotizacion: (id: string, estado: Cotizacion["estado"]) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const c = tx.must("cotizaciones", id);
        tx.patch("cotizaciones", id, { estado });
        tx.auditar("Cambió estado de cotización", "Cotizacion", id, `${c.numero} → ${estado}`);
      }),
  };
}
