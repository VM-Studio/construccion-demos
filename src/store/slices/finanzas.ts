import type { Cheque, Cobranza, Comprobante, EstadoCheque, Imputacion, MedioCobro, PagoProveedor } from "@/domain/types";
import { formatMoney } from "@/lib/format";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir, r2 } from "../helpers";
import { aplicarAComprobante, puntoVentaDe } from "../ops";
import type { GetFn, SetFn } from "../types";

export interface CobranzaInput {
  clienteId: string;
  fecha: string;
  sucursalId?: string;
  medios: MedioCobro[];
  imputaciones: Imputacion[];
  observaciones?: string;
}

export interface PagoInput {
  proveedorId: string;
  fecha: string;
  medios: MedioCobro[];
  imputaciones: Imputacion[];
  observaciones?: string;
}

/** Cuentas corrientes: cobranzas, pagos a proveedores y cartera de cheques. */
export function crearSliceFinanzas(set: SetFn, get: GetFn) {
  return {
    /**
     * Registra una cobranza: imputa a comprobantes pendientes, actualiza saldos,
     * el monto pagado de acopios y la cartera de cheques. Lo no imputado queda
     * como saldo a favor del cliente (recibo con saldo negativo).
     */
    registrarCobranza: (data: CobranzaInput) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ctacte.cobrar");
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
          numero: tx.numero("REC"),
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
        }
        if (cob.saldoAFavor && cob.saldoAFavor > 0) {
          const rc: Comprobante = {
            id: newId("cmp"),
            tipo: "RECIBO",
            numero: tx.numeroFiscal(puntoVentaDe(tx, sucursalId), "RECIBO"),
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
          tx.insert("comprobantes", rc);
        }
        tx.auditar("Registró cobranza", "Cobranza", cob.id, `${cob.numero} · ${cliente.razonSocial} · ${formatMoney(total)}`);
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
        if (Math.abs(imputado - total) > 0.01) throw new ErrorNegocio("En pagos a proveedores lo imputado debe ser igual al total pagado.");
        const prov = tx.must("proveedores", data.proveedorId);
        const op: PagoProveedor = {
          id: newId("op"),
          numero: tx.numero("OP"),
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
        }
        tx.auditar("Registró pago a proveedor", "PagoProveedor", op.id, `${op.numero} · ${prov.razonSocial} · ${formatMoney(total)}`);
        return { pagoId: op.id, numero: op.numero };
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
