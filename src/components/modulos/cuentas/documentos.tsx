"use client";

import { useDb } from "@/store/selectors";
import type { Cobranza, Comprobante, PagoProveedor, Unidad } from "@/domain/types";
import { presentarLinea } from "@/lib/lineas";
import { urlQrArca } from "@/lib/arca-qr";
import { QrArca } from "@/components/shared/qr-arca";
import { PrintLayout, PrintTable } from "@/components/shared/print-layout";
import { CONDICION_IVA_LABEL, CONDICION_PAGO_LABEL, MEDIO_PAGO_LABEL, TIPO_COMPROBANTE_LABEL } from "@/domain/estados";
import { formatDate, formatMoney, formatNumber, formatQty } from "@/lib/format";

function DatosCliente({ clienteId, comprador }: { clienteId?: string; comprador?: { nombre?: string; doc?: string } }) {
  const db = useDb();
  const c = db.clientes.find((x) => x.id === clienteId);
  if (!c) return null;
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <div className="text-[10px] font-semibold uppercase text-muted">Cliente</div>
        <div className="font-semibold">{comprador?.nombre || c.razonSocial}</div>
        <div>{comprador?.doc ? `CUIT/DNI ${comprador.doc}` : c.cuit ? `CUIT ${c.cuit}` : "Sin CUIT"} · {comprador?.nombre ? "Consumidor final" : CONDICION_IVA_LABEL[c.condicionIVA]}</div>
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
        m.moneda === "USD" ? "Efectivo en dólares" : MEDIO_PAGO_LABEL[m.medio],
        m.medio === "CHEQUE" || m.medio === "ECHEQ" ? `${m.banco ?? ""} Nº ${m.numeroCheque ?? ""} · cobro ${formatDate(m.fechaCobro)}` : m.moneda === "USD" ? `US$ ${formatNumber(m.importeME ?? 0, 2)} × $ ${formatNumber(m.tipoCambio ?? 0, 2)}` : m.referencia ?? "",
        formatMoney(m.importe),
      ])}
    />
  );
}

/** Recibo de cobranza. */
export function ReciboDocumento({ cobranza }: { cobranza: Cobranza }) {
  const db = useDb();
  // Lo imputado en el momento más lo que después se aplicó del saldo a favor de este recibo.
  const saf = db.comprobantes.find((c) => c.tipo === "SALDO_A_FAVOR" && c.clienteId === cobranza.clienteId && c.numero === `${cobranza.numero} (a favor)`);
  const aplicaciones = [...cobranza.imputaciones, ...(saf?.aplicadoA ?? [])].map((i) => {
    const c = db.comprobantes.find((x) => x.id === i.comprobanteId);
    return { numero: c?.numero ?? "", etiqueta: `${TIPO_COMPROBANTE_LABEL[c?.tipo ?? ""] ?? ""} ${c?.numero ?? ""}`, fecha: c?.fecha, total: c?.total ?? 0, importe: i.importe, saldo: c?.saldoPendiente ?? 0 };
  });
  const sinAplicar = Math.round((cobranza.total - aplicaciones.reduce((a, x) => a + x.importe, 0)) * 100) / 100;
  const pv = db.sucursales.find((s) => s.id === cobranza.sucursalId)?.puntoVenta ?? "0001";
  return (
    <PrintLayout titulo="Recibo" numero={cobranza.numero || `${pv}`} fecha={formatDate(cobranza.fecha)} subtitulo={<DatosCliente clienteId={cobranza.clienteId} />} leyenda={cobranza.anulado ? "ANULADO" : "Recibo de pago"} pie="Firma y aclaración ______________________">
      <p className="mb-3">
        Recibimos la suma de <b>{formatMoney(cobranza.total)}</b> {aplicaciones.length ? <>en pago de {aplicaciones.length === 1 ? "la factura" : "las facturas"} {aplicaciones.map((a) => a.numero).join(", ")}</> : <>en concepto de pago a cuenta</>}, según el siguiente detalle:
      </p>
      {aplicaciones.length > 0 && (
        <>
          <h4 className="mb-1 text-[11px] font-semibold uppercase">Facturas que se pagan</h4>
          <PrintTable
            head={["Comprobante", "Fecha", "Total del comprobante", "Pagado con este recibo", "Saldo que queda"]}
            rows={aplicaciones.map((a) => [a.etiqueta, formatDate(a.fecha), formatMoney(a.total), formatMoney(a.importe), formatMoney(a.saldo)])}
            foot={["Total aplicado", "", "", formatMoney(aplicaciones.reduce((x, a) => x + a.importe, 0)), ""]}
          />
        </>
      )}
      <h4 className="mb-1 mt-4 text-[11px] font-semibold uppercase">Forma de pago</h4>
      <Medios medios={cobranza.medios} />
      {sinAplicar > 0.009 && <p className="mt-3">Queda a cuenta (saldo a favor del cliente): <b>{formatMoney(sinAplicar)}</b></p>}
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
          return [`Factura ${c?.numero ?? ""}`, formatDate(c?.fecha), formatMoney(i.importe)];
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
  const pedido = c.notaPedidoId ? db.notasPedido.find((p) => p.id === c.notaPedidoId) : undefined;
  const acopio = c.acopioId ? db.acopios.find((a) => a.id === c.acopioId) : undefined;
  const autorizado = c.circuito === 1 && c.arcaEstado === "AUTORIZADO";
  const leyenda = c.estado === "ANULADO" ? "ANULADO" : c.circuito === 2 ? "Documento interno" : autorizado ? "Factura electrónica" : "Pendiente de autorización ARCA";
  const items: { productoId: string; cantidad: number; precioUnitario: number; descuentoPct?: number; unidadVenta?: Unidad }[] = c.items ?? [];
  const cli = db.clientes.find((x) => x.id === c.clienteId);
  const qr = autorizado && c.cae && c.arcaNumero && c.arcaPuntoVenta && c.arcaTipo
    ? urlQrArca({ fecha: c.fecha, cuitEmisor: db.config.empresa.cuit, puntoVenta: c.arcaPuntoVenta, tipo: c.arcaTipo, numero: c.arcaNumero, importe: c.total, ...docReceptor(c.compradorDoc || cli?.cuit), cae: c.cae })
    : null;
  return (
    <PrintLayout
      titulo={`${TIPO_COMPROBANTE_LABEL[c.tipo]}${c.letra ? ` ${c.letra}` : ""}`}
      numero={c.numero}
      fecha={formatDate(c.fecha)}
      leyenda={leyenda}
      subtitulo={
        <div className="space-y-3">
          <DatosCliente clienteId={c.clienteId} comprador={c.compradorNombre ? { nombre: c.compradorNombre, doc: c.compradorDoc } : undefined} />
          <div className="text-[11px] text-muted">
            {pedido && <>Nota de pedido {pedido.numero} · </>}
            {acopio && <>Acopio {acopio.numero} · </>}
            {c.vencimiento && <>Vencimiento {formatDate(c.vencimiento)}</>}
          </div>
        </div>
      }
      pie={c.circuito === 1 ? (autorizado ? `CAE ${c.cae} · Vto. CAE ${formatDate(c.caeVencimiento)}` : "Factura pendiente de autorización en ARCA.") : "Documento interno. No válido como comprobante fiscal."}
    >
      {items.length > 0 ? (
        <PrintTable
          head={["Código", "Descripción", "Cantidad", "Precio unit.", "Desc.", "Importe"]}
          rows={items.map((i) => {
            const p = prod(i.productoId);
            const l = presentarLinea(i, p);
            return [p?.codigo, p?.nombre, l.texto, formatMoney(l.precio), `${i.descuentoPct ?? 0} %`, formatMoney(i.cantidad * i.precioUnitario * (1 - (i.descuentoPct ?? 0) / 100))];
          })}
        />
      ) : (
        <p>{c.observaciones}</p>
      )}
      <div className="mt-4 ml-auto w-64 space-y-1 text-[12px]">
        <div className="flex justify-between"><span>Neto gravado</span><span className="tnum">{formatMoney(c.subtotal)}</span></div>
        {c.iva > 0 && <div className="flex justify-between"><span>IVA 21 %</span><span className="tnum">{formatMoney(c.iva)}</span></div>}
        <div className="flex justify-between border-t border-ink pt-1 text-[13px] font-semibold"><span>Total</span><span className="tnum">{formatMoney(c.total)}</span></div>
      </div>
      {c.observaciones && items.length > 0 && <p className="mt-3 text-[11px]">{c.observaciones}</p>}
      {c.ventaML && <p className="mt-2 text-[11px]">Venta Mercado Libre Nº {c.ventaML}</p>}
      {c.circuito === 1 ? (
        autorizado ? (
          <div className="mt-6 flex items-center gap-4 border-t border-border pt-3 text-[11px]">
            {qr && <QrArca url={qr} size={88} />}
            <div>
              <div className="font-semibold">Comprobante autorizado por ARCA</div>
              <div>CAE {c.cae} · Vencimiento del CAE {formatDate(c.caeVencimiento)}</div>
              {c.arcaPuntoVenta && c.arcaNumero && <div>Punto de venta {String(c.arcaPuntoVenta).padStart(5, "0")} · Comprobante Nº {String(c.arcaNumero).padStart(8, "0")}</div>}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-center text-[11px] font-semibold uppercase">Pendiente de autorización en ARCA{c.arcaError ? ` · ${c.arcaError}` : ""}</p>
        )
      ) : (
        <p className="mt-6 text-center text-[11px] font-semibold uppercase">Documento interno</p>
      )}
    </PrintLayout>
  );
}

/** Documento del receptor para el QR de ARCA (80 CUIT, 96 DNI, 99 consumidor final). */
function docReceptor(doc?: string): { docTipo: number; docNro: string } {
  const d = (doc ?? "").replace(/\D/g, "");
  if (d.length === 11) return { docTipo: 80, docNro: d };
  if (d.length >= 7 && d.length <= 8) return { docTipo: 96, docNro: d };
  return { docTipo: 99, docNro: "0" };
}
