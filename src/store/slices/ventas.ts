import type { Circuito, Cliente, Comprobante, Cotizacion, DevolucionNP, FormaPagoVenta, ItemNP, ItemVenta, ModalidadEntrega, Moneda, NotaPedido, OrigenVenta, Remito } from "@/domain/types";
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
  crearRemitoNP,
  disponible,
  marcarHecho,
  mensajeSinDisponible,
  puntoVentaDe,
  saldoAcopio,
} from "../ops";
import type { Tx } from "../tx";
import type { GetFn, SetFn } from "../types";
import { tipoCambioVigente } from "./catalogo";

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

export interface CotizacionInput {
  clienteId: string;
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
          items: np.items.map((i) => ({ id: i.id, productoId: i.productoId, obraId: i.obraId, cantidad: i.cantidad, precioUnitario: i.precioUnitario, costoUnitarioSnapshot: i.costoUnitarioSnapshot, descuentoPct: i.descuentoPct ?? 0 })),
        });
        tx.patch("notasPedido", np.id, { comprobanteIds: [...np.comprobanteIds, fac.id] });
        for (const rid of np.remitoIds) {
          const r = tx.find("remitos", rid);
          if (r) tx.patch("remitos", rid, { facturado: true, facturasRef: [...(r.facturasRef ?? []), fac.numero] });
        }
        tx.auditar("Facturó nota de pedido", "Comprobante", fac.id, `${fac.numero} · ${np.numero} · ${formatMoney(fac.total)}`);
        return { id: fac.id, numero: fac.numero };
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
    guardarCotizacion: (data: CotizacionInput, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        if (!data.clienteId) throw new ErrorNegocio("Elegí un cliente.");
        const items = data.items.filter((i) => i.productoId && i.cantidad > 0).map((i) => ({ ...i, id: i.id || newId("icot"), costoUnitarioSnapshot: tx.find("productos", i.productoId)?.costoPromedio ?? 0 }));
        if (!items.length) throw new ErrorNegocio("Agregá al menos un producto con cantidad.");
        const t = calcularTotales(items, data.descuentoPct, data.circuito === 1 ? tx.config.ivaPct : 0);
        const moneda = monedaDocumento(tx.must("clientes", data.clienteId), data.moneda);
        const tc = moneda === "USD" ? tipoCambioVigente(tx) : undefined;
        const base = { ...data, items, subtotal: t.subtotal, iva: t.iva, total: t.total, moneda, tipoCambioAplicado: tc?.valor, tipoCambioFecha: tc?.fecha };
        if (id) {
          const c = tx.must("cotizaciones", id);
          if (c.estado !== "BORRADOR" && c.estado !== "ENVIADA") throw new ErrorNegocio("La cotización ya no se puede editar.");
          tx.patch("cotizaciones", id, base);
          tx.auditar("Editó cotización", "Cotizacion", id, c.numero);
          return id;
        }
        const cot: Cotizacion = {
          id: newId("cot"),
          numero: tx.numero("COT", data.circuito, puntoVentaDe(tx, data.sucursalId)),
          vendedorId: tx.must("clientes", data.clienteId).vendedorId ?? tx.usuarioId,
          estado: "BORRADOR",
          ...base,
          ...tx.meta(),
        };
        tx.insert("cotizaciones", cot);
        tx.auditar("Creó cotización", "Cotizacion", cot.id, `${cot.numero} · ${formatMoney(cot.total)}`);
        return cot.id;
      }),

    cambiarEstadoCotizacion: (id: string, estado: Cotizacion["estado"]) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const c = tx.must("cotizaciones", id);
        tx.patch("cotizaciones", id, { estado });
        tx.auditar(estado === "ENVIADA" ? "Envió cotización" : "Cambió estado de cotización", "Cotizacion", id, `${c.numero} → ${estado}`);
      }),
  };
}
