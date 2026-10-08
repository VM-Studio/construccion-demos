import type { Cheque, Circuito, Cobranza, Comprobante, EstadoCheque, Imputacion, MedioCobro, PagoProveedor } from "@/domain/types";
import { formatMoney } from "@/lib/format";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir, r2 } from "../helpers";
import { aplicarAComprobante, puntoVentaDe } from "../ops";
import type { Tx } from "../tx";
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
  const medios = data.medios.filter((m) => m.importe > 0);
  if (!medios.length) throw new ErrorNegocio("Agregá al menos un medio de pago con importe.");
  for (const m of medios)
    if ((m.medio === "CHEQUE" || m.medio === "ECHEQ") && (!m.banco || !m.numeroCheque || !m.fechaCobro))
      throw new ErrorNegocio("Para cheques completá banco, número y fecha de cobro.");
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
        const medios = data.medios.filter((m) => m.importe > 0);
        if (!medios.length) throw new ErrorNegocio("Agregá al menos un medio de pago con importe.");
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
