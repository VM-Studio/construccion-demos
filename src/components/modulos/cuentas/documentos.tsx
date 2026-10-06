"use client";

import { useDb } from "@/store/selectors";
import type { Cobranza, Comprobante, PagoProveedor } from "@/domain/types";
import { PrintLayout, PrintTable } from "@/components/shared/print-layout";
import { CONDICION_IVA_LABEL, CONDICION_PAGO_LABEL, MEDIO_PAGO_LABEL, TIPO_COMPROBANTE_LABEL } from "@/domain/estados";
import { formatDate, formatMoney, formatQty } from "@/lib/format";

function DatosCliente({ clienteId }: { clienteId?: string }) {
  const db = useDb();
  const c = db.clientes.find((x) => x.id === clienteId);
  if (!c) return null;
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <div className="text-[10px] font-semibold uppercase text-muted">Cliente</div>
        <div className="font-semibold">{c.razonSocial}</div>
        <div>CUIT {c.cuit} · {CONDICION_IVA_LABEL[c.condicionIVA]}</div>
        <div>{c.direccion}, {c.localidad}</div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase text-muted">Condiciones</div>
        <div>{CONDICION_PAGO_LABEL[c.condicionPago]}</div>
        <div>{c.telefono} · {c.email}</div>
      </div>
    </div>
  );
}

function Medios({ medios }: { medios: Cobranza["medios"] }) {
  return (
    <PrintTable
      head={["Medio", "Detalle", "Importe"]}
      rows={medios.map((m) => [
        MEDIO_PAGO_LABEL[m.medio],
        m.medio === "CHEQUE" || m.medio === "ECHEQ" ? `${m.banco ?? ""} Nº ${m.numeroCheque ?? ""} · cobro ${formatDate(m.fechaCobro)}` : m.referencia ?? "",
        formatMoney(m.importe),
      ])}
    />
  );
}

/** Recibo de cobranza. */
export function ReciboDocumento({ cobranza }: { cobranza: Cobranza }) {
  const db = useDb();
  const pv = db.sucursales.find((s) => s.id === cobranza.sucursalId)?.puntoVenta ?? "0001";
  return (
    <PrintLayout titulo="Recibo" numero={`${pv}-${cobranza.numero.replace("REC-", "000")}`} fecha={formatDate(cobranza.fecha)} subtitulo={<DatosCliente clienteId={cobranza.clienteId} />} leyenda="Comprobante no fiscal · Demo" pie="Firma y aclaración ______________________">
      <p className="mb-3">Recibimos la suma de <b>{formatMoney(cobranza.total)}</b> en concepto de pago a cuenta, según el siguiente detalle:</p>
      <Medios medios={cobranza.medios} />
      <h4 className="mb-1 mt-4 text-[11px] font-semibold uppercase">Imputación</h4>
      <PrintTable
        head={["Comprobante", "Fecha", "Importe imputado"]}
        rows={cobranza.imputaciones.map((i) => {
          const c = db.comprobantes.find((x) => x.id === i.comprobanteId);
          return [`${TIPO_COMPROBANTE_LABEL[c?.tipo ?? ""] ?? ""} ${c?.numero ?? ""}`, formatDate(c?.fecha), formatMoney(i.importe)];
        })}
        foot={["Total", "", formatMoney(cobranza.total)]}
      />
      {!!cobranza.saldoAFavor && <p className="mt-3">Saldo a favor del cliente: <b>{formatMoney(cobranza.saldoAFavor)}</b></p>}
      {cobranza.observaciones && <p className="mt-2">{cobranza.observaciones}</p>}
    </PrintLayout>
  );
}

/** Orden de pago a proveedor. */
export function OrdenPagoDocumento({ pago }: { pago: PagoProveedor }) {
  const db = useDb();
  const p = db.proveedores.find((x) => x.id === pago.proveedorId);
  return (
    <PrintLayout
      titulo="Orden de pago"
      numero={pago.numero}
      fecha={formatDate(pago.fecha)}
      subtitulo={
        <div>
          <div className="text-[10px] font-semibold uppercase text-muted">Proveedor</div>
          <div className="font-semibold">{p?.razonSocial}</div>
          <div>CUIT {p?.cuit} · {p?.direccion}</div>
        </div>
      }
      pie="Autorizó ______________________   Recibí conforme ______________________"
    >
      <Medios medios={pago.medios} />
      <h4 className="mb-1 mt-4 text-[11px] font-semibold uppercase">Facturas canceladas</h4>
      <PrintTable
        head={["Factura", "Fecha", "Importe"]}
        rows={pago.imputaciones.map((i) => {
          const c = db.comprobantes.find((x) => x.id === i.comprobanteId);
          return [`Factura A ${c?.numero ?? ""}`, formatDate(c?.fecha), formatMoney(i.importe)];
        })}
        foot={["Total", "", formatMoney(pago.total)]}
      />
    </PrintLayout>
  );
}

/** Factura / nota de crédito de venta (no fiscal en el demo). */
export function ComprobanteDocumento({ comprobante: c }: { comprobante: Comprobante }) {
  const db = useDb();
  const prod = (id: string) => db.productos.find((p) => p.id === id);
  const pedido = c.pedidoId ? db.pedidos.find((p) => p.id === c.pedidoId) : undefined;
  const acopio = c.acopioId ? db.acopios.find((a) => a.id === c.acopioId) : undefined;
  const letra = c.tipo === "FACTURA_A" ? "A" : c.tipo === "FACTURA_B" ? "B" : "";
  const items =
    c.items ??
    acopio?.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidadAcopiada, precioUnitario: i.precioUnitarioPactado, descuentoPct: 0 })) ??
    [];
  return (
    <PrintLayout
      titulo={`${TIPO_COMPROBANTE_LABEL[c.tipo]}${letra ? "" : ""}`}
      numero={c.numero}
      fecha={formatDate(c.fecha)}
      leyenda="Comprobante no fiscal · Demo"
      subtitulo={
        <div className="space-y-3">
          <DatosCliente clienteId={c.clienteId} />
          <div className="text-[11px] text-muted">
            {pedido && <>Pedido {pedido.numero} · </>}
            {acopio && <>Acopio {acopio.numero} · </>}
            {c.vencimiento && <>Vencimiento {formatDate(c.vencimiento)}</>}
          </div>
        </div>
      }
      pie="Documento generado por el sistema de demostración. No válido como factura."
    >
      {items.length > 0 ? (
        <PrintTable
          head={["Código", "Descripción", "Cantidad", "Precio unit.", "Desc.", "Importe"]}
          rows={items.map((i) => {
            const p = prod(i.productoId);
            return [p?.codigo, p?.nombre, formatQty(i.cantidad, p?.unidad ?? "UN"), formatMoney(i.precioUnitario), `${i.descuentoPct ?? 0} %`, formatMoney(i.cantidad * i.precioUnitario * (1 - (i.descuentoPct ?? 0) / 100))];
          })}
        />
      ) : (
        <p>{c.observaciones}</p>
      )}
      <div className="mt-4 ml-auto w-64 space-y-1 text-[12px]">
        <div className="flex justify-between"><span>Neto gravado</span><span className="tnum">{formatMoney(c.subtotal)}</span></div>
        <div className="flex justify-between"><span>IVA 21 %</span><span className="tnum">{formatMoney(c.iva)}</span></div>
        <div className="flex justify-between border-t border-ink pt-1 text-[13px] font-semibold"><span>Total</span><span className="tnum">{formatMoney(c.total)}</span></div>
      </div>
      {c.observaciones && items.length > 0 && <p className="mt-3 text-[11px]">{c.observaciones}</p>}
      <p className="mt-6 text-center text-[11px] font-semibold uppercase">Comprobante no fiscal · Demo — sin validez ante AFIP/ARCA</p>
    </PrintLayout>
  );
}
