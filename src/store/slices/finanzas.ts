import type { ArqueoCaja, Caja, Cheque, Circuito, Cobranza, Comprobante, EstadoCheque, Imputacion, MedioCobro, Moneda, MovimientoCaja, PagoProveedor } from "@/domain/types";
import { saldoCaja, prestamosPendientes } from "@/domain/caja";
import { estadoPorSaldo } from "@/domain/cuentasCorrientes";
import { formatMoney } from "@/lib/format";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir, r2 } from "../helpers";
import { anularMovimientosDe, aplicarAComprobante, desaplicarDeComprobante, movimientoCajaDeMedio, normalizarMedios, puntoVentaDe } from "../ops";
import type { Tx } from "../tx";
import { puede } from "@/domain/permisos";

const puedeAjustar = (tx: Tx) => puede(tx.find("usuarios", tx.usuarioId), "caja.administrar");
import type { GetFn, SetFn } from "../types";

export interface CobranzaInput {
  clienteId: string;
  circuito: Circuito;
  fecha: string;
  sucursalId?: string;
  medios: MedioCobro[];
  imputaciones: Imputacion[];
  observaciones?: string;
}

export interface PagoInput {
  proveedorId: string;
  circuito: Circuito;
  fecha: string;
  medios: MedioCobro[];
  imputaciones: Imputacion[];
  observaciones?: string;
}

/**
 * Registra un recibo (RC1/RC2): imputa a comprobantes (facturas de venta o de acopio),
 * actualiza saldos y la cartera de cheques. Lo no imputado queda como saldo a favor.
 */
export function registrarCobro(tx: Tx, data: CobranzaInput): Cobranza {
  const medios = normalizarMedios(data.medios);
  const total = r2(medios.reduce((a, m) => a + m.importe, 0));
  const imputaciones = data.imputaciones.filter((i) => i.importe > 0).map((i) => ({ ...i, importe: r2(i.importe) }));
  const imputado = r2(imputaciones.reduce((a, i) => a + i.importe, 0));
  if (imputado > total + 0.01) throw new ErrorNegocio("Lo imputado supera el total recibido.");
  const cliente = tx.must("clientes", data.clienteId);
  const sucursalId = data.sucursalId ?? cliente.sucursalPreferidaId;
  const cob: Cobranza = {
    id: newId("cob"),
    numero: tx.numero("RC", data.circuito, puntoVentaDe(tx, sucursalId)),
    circuito: data.circuito,
    clienteId: cliente.id,
    sucursalId,
    fecha: data.fecha,
    medios: medios.map((m) => ({ ...m })),
    imputaciones,
    total,
    saldoAFavor: r2(total - imputado) || undefined,
    usuarioId: tx.usuarioId,
    observaciones: data.observaciones,
    ...tx.meta(),
  };
  for (const m of cob.medios)
    if (m.medio === "CHEQUE" || m.medio === "ECHEQ") {
      const ch: Cheque = {
        id: newId("chq"),
        tipo: m.medio,
        banco: m.banco!,
        numero: m.numeroCheque!,
        importe: m.importe,
        fechaCobro: m.fechaCobro!,
        clienteId: cliente.id,
        cobranzaId: cob.id,
        estado: "EN_CARTERA",
        ...tx.meta(),
      };
      tx.insert("cheques", ch);
      m.chequeId = ch.id;
    }
  for (const m of cob.medios) movimientoCajaDeMedio(tx, m, { signo: 1, fecha: data.fecha, concepto: `Cobro ${cob.numero} · ${cliente.nombreFantasia ?? cliente.razonSocial}`, referenciaTipo: "RECIBO", referenciaId: cob.id, sucursalId });
  tx.insert("cobranzas", cob);
  for (const i of imputaciones) {
    const c = tx.must("comprobantes", i.comprobanteId);
    if (c.clienteId !== cliente.id) throw new ErrorNegocio("Hay comprobantes de otro cliente en la imputación.");
    aplicarAComprobante(tx, i.comprobanteId, i.importe);
    if (c.acopioId) {
      const a = tx.find("acopios", c.acopioId);
      if (a && !a.reciboIds.includes(cob.id)) tx.patch("acopios", a.id, { reciboIds: [...a.reciboIds, cob.id] });
    }
  }
  if (cob.saldoAFavor && cob.saldoAFavor > 0) {
    const saf: Comprobante = {
      id: newId("cmp"),
      tipo: "SALDO_A_FAVOR",
      circuito: data.circuito,
      numero: `${cob.numero} (a favor)`,
      clienteId: cliente.id,
      sucursalId,
      fecha: data.fecha,
      subtotal: cob.saldoAFavor,
      iva: 0,
      total: cob.saldoAFavor,
      saldoPendiente: -cob.saldoAFavor,
      estado: "PENDIENTE",
      observaciones: `Saldo a favor del recibo ${cob.numero}`,
      ...tx.meta(),
    };
    tx.insert("comprobantes", saf);
  }
  tx.auditar("Registró recibo", "Cobranza", cob.id, `${cob.numero} · ${cliente.razonSocial} · ${formatMoney(total)}`);
  return cob;
}

/**
 * Anula un recibo: las facturas imputadas vuelven a tener saldo, el saldo a favor que generó se
 * anula (también lo que se había aplicado de él), sus cheques salen de cartera y el efectivo sale
 * de la caja chica. El recibo queda visible como anulado.
 */
export function anularRecibo(tx: Tx, id: string, motivo: string) {
  const cob = tx.must("cobranzas", id);
  if (cob.anulado) throw new ErrorNegocio("El recibo ya está anulado.");
  if (!motivo.trim()) throw new ErrorNegocio("Indicá el motivo de la anulación.");
  const cheques = tx.get("cheques").filter((ch) => ch.cobranzaId === cob.id);
  const usado = cheques.find((ch) => ch.estado !== "EN_CARTERA");
  if (usado) throw new ErrorNegocio(`El cheque ${usado.banco} Nº ${usado.numero} ya no está en cartera: anulá primero la orden de pago o revertí su estado.`);
  const saf = tx.get("comprobantes").find((c) => c.tipo === "SALDO_A_FAVOR" && c.clienteId === cob.clienteId && c.numero === `${cob.numero} (a favor)` && c.estado !== "ANULADO");
  if (saf) {
    // Lo que ya se había aplicado de ese saldo a favor vuelve a quedar adeudado.
    for (const ap of saf.aplicadoA ?? []) desaplicarDeComprobante(tx, ap.comprobanteId, ap.importe);
    tx.patch("comprobantes", saf.id, { estado: "ANULADO", saldoPendiente: 0 });
  }
  for (const ch of cheques) tx.remove("cheques", ch.id);
  for (const i of cob.imputaciones) {
    desaplicarDeComprobante(tx, i.comprobanteId, i.importe);
    const c = tx.find("comprobantes", i.comprobanteId);
    const a = c?.acopioId ? tx.find("acopios", c.acopioId) : undefined;
    if (a?.reciboIds.includes(cob.id)) tx.patch("acopios", a.id, { reciboIds: a.reciboIds.filter((x) => x !== cob.id) });
  }
  anularMovimientosDe(tx, cob.id, `Recibo anulado: ${motivo.trim()}`);
  tx.patch("cobranzas", cob.id, { anulado: true, motivoAnulacion: motivo.trim() });
  const cliente = tx.find("clientes", cob.clienteId);
  tx.auditar("Anuló recibo", "Cobranza", cob.id, `${cob.numero} · ${cliente?.razonSocial ?? ""} · ${formatMoney(cob.total)} · ${motivo.trim()}`);
}

/**
 * Aplica un saldo a favor (pago a cuenta sin imputar, nota de crédito o saldo inicial a favor) a
 * facturas pendientes del mismo cliente: la factura deja de figurar como adeudada.
 */
export function aplicarCredito(tx: Tx, creditoId: string, imputaciones: Imputacion[]) {
  const cr = tx.must("comprobantes", creditoId);
  if (cr.estado === "ANULADO" || cr.saldoPendiente > -0.009) throw new ErrorNegocio("Ese saldo a favor ya está aplicado.");
  const imps = imputaciones.filter((i) => i.importe > 0).map((i) => ({ ...i, importe: r2(i.importe) }));
  if (!imps.length) throw new ErrorNegocio("Indicá a qué factura aplicar el saldo.");
  const total = r2(imps.reduce((a, i) => a + i.importe, 0));
  if (total > -cr.saldoPendiente + 0.01) throw new ErrorNegocio(`Solo hay ${formatMoney(-cr.saldoPendiente)} a favor para aplicar.`);
  for (const i of imps) {
    const f = tx.must("comprobantes", i.comprobanteId);
    if ((f.clienteId ?? f.proveedorId) !== (cr.clienteId ?? cr.proveedorId)) throw new ErrorNegocio("La factura es de otra cuenta.");
    aplicarAComprobante(tx, f.id, i.importe);
  }
  const saldo = r2(cr.saldoPendiente + total);
  const aplicado = [...(cr.aplicadoA ?? [])];
  for (const i of imps) {
    const prev = aplicado.find((a) => a.comprobanteId === i.comprobanteId);
    if (prev) prev.importe = r2(prev.importe + i.importe);
    else aplicado.push({ ...i });
  }
  tx.patch("comprobantes", cr.id, { saldoPendiente: saldo, aplicadoA: aplicado, estado: saldo > -0.009 ? "PAGADO" : estadoPorSaldo(cr.total, -saldo) === "PENDIENTE" ? "PENDIENTE" : "PARCIAL" });
  const nros = imps.map((i) => tx.find("comprobantes", i.comprobanteId)?.numero).join(", ");
  tx.auditar("Aplicó saldo a favor", "Comprobante", cr.id, `${cr.numero} → ${nros} · ${formatMoney(total)}`);
}

export interface MovimientoCajaInput {
  cajaId: string;
  fecha: string;
  tipo: "INGRESO" | "EGRESO" | "APERTURA";
  moneda: Moneda;
  importe: number;
  concepto: string;
  categoria?: string;
  observaciones?: string;
}

export interface TransferenciaCajaInput {
  origenId: string;
  destinoId: string;
  fecha: string;
  moneda: Moneda;
  importe: number;
  tipo: "TRANSFERENCIA" | "PRESTAMO" | "DEVOLUCION_PRESTAMO";
  concepto?: string;
}

/** Cuentas corrientes: recibos (entrada de fondos), órdenes de pago (salida) y cartera de cheques. */
export function crearSliceFinanzas(set: SetFn, get: GetFn) {
  return {
    registrarCobranza: (data: CobranzaInput) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ctacte.cobrar");
        const cob = registrarCobro(tx, data);
        return { cobranzaId: cob.id, numero: cob.numero };
      }),

    registrarPagoProveedor: (data: PagoInput) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ctacte.pagar");
        // Cheques propios: alcanza con la referencia (banco / número).
        const medios = normalizarMedios(data.medios, false);
        const total = r2(medios.reduce((a, m) => a + m.importe, 0));
        const imputaciones = data.imputaciones.filter((i) => i.importe > 0).map((i) => ({ ...i, importe: r2(i.importe) }));
        const imputado = r2(imputaciones.reduce((a, i) => a + i.importe, 0));
        if (Math.abs(imputado - total) > 0.01) throw new ErrorNegocio("En órdenes de pago lo imputado debe ser igual al total pagado.");
        const prov = tx.must("proveedores", data.proveedorId);
        const op: PagoProveedor = {
          id: newId("op"),
          numero: tx.numero("OP", data.circuito, "0001"),
          circuito: data.circuito,
          proveedorId: prov.id,
          fecha: data.fecha,
          medios,
          imputaciones,
          total,
          usuarioId: tx.usuarioId,
          observaciones: data.observaciones,
          ...tx.meta(),
        };
        for (const m of medios)
          if (m.chequeId) {
            const ch = tx.must("cheques", m.chequeId);
            if (ch.estado !== "EN_CARTERA") throw new ErrorNegocio(`El cheque ${ch.numero} ya no está en cartera.`);
            tx.patch("cheques", ch.id, { estado: "ENTREGADO", proveedorId: prov.id, pagoProveedorId: op.id });
          }
        for (const m of op.medios) {
          if (m.medio !== "EFECTIVO") continue;
          const cajaId = m.cajaId ?? "";
          const caja = tx.find("cajas", cajaId);
          const moneda: Moneda = m.moneda === "USD" ? "USD" : "ARS";
          const imp = moneda === "USD" ? (m.importeME ?? 0) : m.importe;
          if (caja && imp > saldoCaja(caja.id, moneda, tx.get("movimientosCaja")) + 0.009) throw new ErrorNegocio(`No hay efectivo suficiente en ${caja.nombre} para este pago.`);
          movimientoCajaDeMedio(tx, m, { signo: -1, fecha: data.fecha, concepto: `Pago ${op.numero} · ${prov.razonSocial}`, referenciaTipo: "ORDEN_PAGO", referenciaId: op.id });
        }
        tx.insert("pagosProveedores", op);
        for (const i of imputaciones) {
          const c = tx.must("comprobantes", i.comprobanteId);
          if (c.proveedorId !== prov.id) throw new ErrorNegocio("Hay comprobantes de otro proveedor en la imputación.");
          aplicarAComprobante(tx, i.comprobanteId, i.importe);
          if (c.acopioProveedorId) {
            const acp = tx.must("acopiosProveedor", c.acopioProveedorId);
            if (!acp.ordenPagoIds.includes(op.id)) tx.patch("acopiosProveedor", acp.id, { ordenPagoIds: [...acp.ordenPagoIds, op.id] });
          }
        }
        tx.auditar("Registró orden de pago", "PagoProveedor", op.id, `${op.numero} · ${prov.razonSocial} · ${formatMoney(total)}`);
        return { pagoId: op.id, numero: op.numero };
      }),

    /**
     * Anula un recibo: las facturas imputadas vuelven a tener saldo, el saldo a favor que generó
     * se anula y sus cheques salen de cartera. El recibo queda visible como anulado.
     */
    anularCobranza: (id: string, motivo: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ctacte.cobrar");
        anularRecibo(tx, id, motivo);
      }),

    /** Aplica un pago a cuenta / saldo a favor a facturas pendientes. */
    aplicarSaldoAFavor: (creditoId: string, imputaciones: Imputacion[]) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ctacte.cobrar");
        aplicarCredito(tx, creditoId, imputaciones);
      }),

    // ── Caja chica ──
    guardarCaja: (data: { nombre: string; descripcion?: string; sucursalId?: string; activa: boolean }, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "caja.administrar");
        const nombre = data.nombre.trim();
        if (!nombre) throw new ErrorNegocio("Poné un nombre a la caja.");
        if (tx.get("cajas").some((c) => c.id !== id && c.nombre.toLowerCase() === nombre.toLowerCase())) throw new ErrorNegocio("Ya hay una caja con ese nombre.");
        if (id) {
          const c = tx.must("cajas", id);
          if (!data.activa && c.activa) {
            const conSaldo = (["ARS", "USD"] as Moneda[]).some((m) => Math.abs(saldoCaja(id, m, tx.get("movimientosCaja"))) > 0.009);
            if (conSaldo) throw new ErrorNegocio("La caja tiene saldo: pasalo a otra caja antes de desactivarla.");
          }
          tx.patch("cajas", id, { ...data, nombre });
          tx.auditar("Editó caja", "Caja", id, nombre);
          return id;
        }
        const caja: Caja = { id: newId("caja"), ...data, nombre, orden: tx.get("cajas").length, ...tx.meta() };
        tx.insert("cajas", caja);
        tx.auditar("Creó caja", "Caja", caja.id, nombre);
        return caja.id;
      }),

    registrarMovimientoCaja: (data: MovimientoCajaInput) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "caja.operar");
        const caja = tx.must("cajas", data.cajaId);
        if (!caja.activa) throw new ErrorNegocio("La caja está desactivada.");
        const importe = r2(data.importe);
        if (!(importe > 0)) throw new ErrorNegocio("Ingresá un importe mayor a cero.");
        if (!data.concepto.trim()) throw new ErrorNegocio("Escribí el concepto (ej. Flete Gabriel).");
        const signo = data.tipo === "EGRESO" ? -1 : 1;
        if (signo === -1 && importe > saldoCaja(caja.id, data.moneda, tx.get("movimientosCaja")) + 0.009) throw new ErrorNegocio(`No hay ${data.moneda === "USD" ? "dólares" : "pesos"} suficientes en ${caja.nombre}.`);
        const mov: MovimientoCaja = { id: newId("mcj"), cajaId: caja.id, fecha: data.fecha, tipo: data.tipo, signo, moneda: data.moneda, importe, concepto: data.concepto.trim(), categoria: data.categoria || undefined, referenciaTipo: "MANUAL", usuarioId: tx.usuarioId, observaciones: data.observaciones || undefined, ...tx.meta() };
        tx.insert("movimientosCaja", mov);
        tx.auditar(data.tipo === "EGRESO" ? "Registró egreso de caja" : "Registró ingreso de caja", "Caja", caja.id, `${caja.nombre} · ${mov.concepto} · ${data.moneda === "USD" ? `US$ ${importe}` : formatMoney(importe)}`);
        return mov.id;
      }),

    /** Transferencia, préstamo o devolución de préstamo entre dos cajas (dos movimientos unidos). */
    transferirEntreCajas: (data: TransferenciaCajaInput) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "caja.operar");
        if (data.origenId === data.destinoId) throw new ErrorNegocio("Elegí dos cajas distintas.");
        const o = tx.must("cajas", data.origenId);
        const d = tx.must("cajas", data.destinoId);
        if (!o.activa || !d.activa) throw new ErrorNegocio("Las dos cajas tienen que estar activas.");
        const importe = r2(data.importe);
        if (!(importe > 0)) throw new ErrorNegocio("Ingresá un importe mayor a cero.");
        if (importe > saldoCaja(o.id, data.moneda, tx.get("movimientosCaja")) + 0.009) throw new ErrorNegocio(`No hay saldo suficiente en ${o.nombre}.`);
        if (data.tipo === "DEVOLUCION_PRESTAMO") {
          const deuda = prestamosPendientes(tx.get("movimientosCaja")).find((p) => p.deudorId === o.id && p.acreedorId === d.id && p.moneda === data.moneda)?.saldo ?? 0;
          if (importe > deuda + 0.009) throw new ErrorNegocio(`${o.nombre} le debe ${data.moneda === "USD" ? `US$ ${deuda}` : formatMoney(deuda)} a ${d.nombre}.`);
        }
        const texto = data.tipo === "PRESTAMO" ? "Préstamo" : data.tipo === "DEVOLUCION_PRESTAMO" ? "Devolución de préstamo" : "Transferencia";
        const concepto = data.concepto?.trim() || texto;
        const grupoId = newId("grp");
        const base = { fecha: data.fecha, tipo: data.tipo, moneda: data.moneda, importe, grupoId, usuarioId: tx.usuarioId, referenciaTipo: "MANUAL" as const };
        tx.insert("movimientosCaja", { ...base, id: newId("mcj"), cajaId: o.id, signo: -1, cajaRelacionadaId: d.id, concepto: `${concepto} a ${d.nombre}`, ...tx.meta() });
        tx.insert("movimientosCaja", { ...base, id: newId("mcj"), cajaId: d.id, signo: 1, cajaRelacionadaId: o.id, concepto: `${concepto} de ${o.nombre}`, ...tx.meta() });
        tx.auditar(`Registró ${texto.toLowerCase()} entre cajas`, "Caja", o.id, `${o.nombre} → ${d.nombre} · ${data.moneda === "USD" ? `US$ ${importe}` : formatMoney(importe)}`);
        return grupoId;
      }),

    anularMovimientoCaja: (id: string, motivo: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "caja.operar");
        const m = tx.must("movimientosCaja", id);
        if (m.anulado) throw new ErrorNegocio("El movimiento ya está anulado.");
        if (!motivo.trim()) throw new ErrorNegocio("Indicá el motivo.");
        if (m.referenciaTipo === "RECIBO") throw new ErrorNegocio("Este ingreso es de un recibo: anulá el recibo y se corrige solo.");
        if (m.referenciaTipo === "ORDEN_PAGO") throw new ErrorNegocio("Este egreso es de una orden de pago: anulá la orden de pago y se corrige solo.");
        const grupo = m.grupoId ? tx.get("movimientosCaja").filter((x) => x.grupoId === m.grupoId) : [m];
        for (const x of grupo) tx.patch("movimientosCaja", x.id, { anulado: true, motivoAnulacion: motivo.trim() });
        tx.auditar("Anuló movimiento de caja", "Caja", m.cajaId, `${m.concepto} · ${motivo.trim()}`);
      }),

    /** Arqueo: compara lo contado con el saldo del sistema; opcionalmente ajusta la diferencia. */
    registrarArqueo: (data: { cajaId: string; moneda: Moneda; contado: number; billetes?: { denominacion: number; cantidad: number }[]; observaciones?: string; ajustar?: boolean }) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "caja.operar");
        const caja = tx.must("cajas", data.cajaId);
        const saldoSistema = saldoCaja(caja.id, data.moneda, tx.get("movimientosCaja"));
        const contado = r2(data.contado);
        const diferencia = r2(contado - saldoSistema);
        const a: ArqueoCaja = { id: newId("arq"), cajaId: caja.id, fecha: tx.ahora, moneda: data.moneda, saldoSistema, contado, diferencia, billetes: data.billetes?.filter((b) => b.cantidad > 0), usuarioId: tx.usuarioId, observaciones: data.observaciones || undefined, ...tx.meta() };
        tx.insert("arqueosCaja", a);
        if (data.ajustar && Math.abs(diferencia) > 0.009) {
          if (!puedeAjustar(tx)) throw new ErrorNegocio("Solo Dueño o Administración pueden ajustar la caja.");
          tx.insert("movimientosCaja", { id: newId("mcj"), cajaId: caja.id, fecha: tx.ahora, tipo: "AJUSTE", signo: diferencia > 0 ? 1 : -1, moneda: data.moneda, importe: Math.abs(diferencia), concepto: `Ajuste por arqueo (${diferencia > 0 ? "sobrante" : "faltante"})`, referenciaTipo: "ARQUEO", referenciaId: a.id, usuarioId: tx.usuarioId, ...tx.meta() });
        }
        tx.auditar("Hizo arqueo de caja", "Caja", caja.id, `${caja.nombre} · sistema ${formatMoney(saldoSistema)} · contado ${formatMoney(contado)} · diferencia ${formatMoney(diferencia)}`);
        return { arqueoId: a.id, diferencia };
      }),

    /** Anula una orden de pago: las facturas de compra vuelven a tener saldo y los cheques de terceros vuelven a cartera. */
    anularPagoProveedor: (id: string, motivo: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ctacte.pagar");
        const op = tx.must("pagosProveedores", id);
        if (op.anulado) throw new ErrorNegocio("La orden de pago ya está anulada.");
        if (!motivo.trim()) throw new ErrorNegocio("Indicá el motivo de la anulación.");
        for (const ch of tx.get("cheques").filter((x) => x.pagoProveedorId === op.id))
          tx.patch("cheques", ch.id, { estado: "EN_CARTERA", proveedorId: undefined, pagoProveedorId: undefined });
        for (const i of op.imputaciones) {
          desaplicarDeComprobante(tx, i.comprobanteId, i.importe);
          const c = tx.find("comprobantes", i.comprobanteId);
          const acp = c?.acopioProveedorId ? tx.find("acopiosProveedor", c.acopioProveedorId) : undefined;
          if (acp?.ordenPagoIds.includes(op.id)) tx.patch("acopiosProveedor", acp.id, { ordenPagoIds: acp.ordenPagoIds.filter((x) => x !== op.id) });
        }
        anularMovimientosDe(tx, op.id, `Orden de pago anulada: ${motivo.trim()}`);
        tx.patch("pagosProveedores", op.id, { anulado: true, motivoAnulacion: motivo.trim() });
        const prov = tx.find("proveedores", op.proveedorId);
        tx.auditar("Anuló orden de pago", "PagoProveedor", op.id, `${op.numero} · ${prov?.razonSocial ?? ""} · ${formatMoney(op.total)} · ${motivo.trim()}`);
      }),

    /**
     * Saldo inicial de cuenta corriente (migración desde el sistema anterior): comprobante SALDO_INICIAL
     * sin ítems. Si el saldo es a favor del cliente / proveedor, queda como saldo a favor (negativo).
     */
    cargarSaldoInicial: (data: { tipo: "cliente" | "proveedor"; entidadId: string; importe: number; fecha: string; circuito: Circuito; aFavor?: boolean; vencimiento?: string; observaciones?: string }) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, data.tipo === "cliente" ? "ctacte.cobrar" : "ctacte.pagar");
        const importe = r2(data.importe);
        if (!(importe > 0)) throw new ErrorNegocio("Ingresá un importe mayor a cero.");
        const esCliente = data.tipo === "cliente";
        const ent = esCliente ? tx.must("clientes", data.entidadId) : tx.must("proveedores", data.entidadId);
        const sucursalId = esCliente ? (ent as { sucursalPreferidaId: string }).sucursalPreferidaId : tx.get("sucursales")[0]?.id;
        const numero = tx.numero("SI", data.circuito, sucursalId ? puntoVentaDe(tx, sucursalId) : "0001");
        const c: Comprobante = {
          id: newId("cmp"),
          tipo: data.aFavor ? "SALDO_A_FAVOR" : "SALDO_INICIAL",
          circuito: data.circuito,
          numero: data.aFavor ? `${numero} (a favor)` : numero,
          ...(esCliente ? { clienteId: ent.id } : { proveedorId: ent.id }),
          sucursalId,
          fecha: data.fecha,
          vencimiento: data.aFavor ? undefined : (data.vencimiento ?? data.fecha),
          subtotal: importe,
          iva: 0,
          total: importe,
          saldoPendiente: data.aFavor ? -importe : importe,
          estado: "PENDIENTE",
          observaciones: data.observaciones || "Saldo inicial (sistema anterior)",
          ...tx.meta(),
        };
        tx.insert("comprobantes", c);
        tx.auditar("Cargó saldo inicial", esCliente ? "Cliente" : "Proveedor", ent.id, `${c.numero} · ${ent.razonSocial} · ${data.aFavor ? "a favor " : ""}${formatMoney(importe)}`);
        return { comprobanteId: c.id, numero: c.numero };
      }),

    cambiarEstadoCheque: (id: string, estado: EstadoCheque) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ctacte.cobrar");
        const ch = tx.must("cheques", id);
        if (ch.estado === "ENTREGADO") throw new ErrorNegocio("El cheque ya fue entregado a un proveedor.");
        tx.patch("cheques", id, { estado });
        tx.auditar("Cambió estado de cheque", "Cheque", id, `${ch.banco} Nº ${ch.numero} → ${estado}`);
      }),
  };
}
