"use client";

import { useDb } from "@/store/selectors";
import type { OrdenCompra } from "@/domain/types";
import { PrintLayout, PrintTable } from "@/components/shared/print-layout";
import { CONDICION_PAGO_LABEL } from "@/domain/estados";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { totalesOCUSD } from "@/store/slices/compras";
import { formatUSD, textoTipoCambioAplicado } from "@/lib/tipo-cambio";

/** Documento imprimible de la orden de compra. */
export function OCDocumento({ oc }: { oc: OrdenCompra }) {
  const db = useDb();
  const prov = db.proveedores.find((p) => p.id === oc.proveedorId);
  const dep = db.depositos.find((d) => d.id === oc.depositoDestinoId);
  const prod = (id: string) => db.productos.find((p) => p.id === id);
  // OC en USD: el documento va en dólares (costoUSD) con el tipo de cambio aplicado al confirmar.
  const enUSD = oc.moneda === "USD";
  const m = (n: number) => (enUSD ? formatUSD(n) : formatMoney(n));
  const costo = (i: OrdenCompra["items"][number]) => (enUSD ? (i.costoUSD ?? 0) : i.costoUnitario);
  const tot = enUSD ? totalesOCUSD(oc.items, oc.circuito === 1 ? db.config.ivaPct : 0) : { subtotal: oc.subtotal, iva: oc.iva, total: oc.total };
  return (
    <PrintLayout
      titulo="Orden de compra"
      numero={oc.numero}
      fecha={formatDate(oc.fechaEmision)}
      subtitulo={
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] font-semibold uppercase text-muted">Proveedor</div>
            <div className="font-semibold">{prov?.razonSocial}</div>
            <div>CUIT {prov?.cuit}</div>
            <div>{prov?.direccion}</div>
            <div>{prov?.contacto} · {prov?.telefono}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-muted">Entregar en</div>
            <div className="font-semibold">{dep?.nombre}</div>
            <div>{dep?.direccion}</div>
            <div>Entrega estimada: {formatDate(oc.fechaEntregaEstimada)}</div>
            <div>Condición de pago: {prov ? CONDICION_PAGO_LABEL[prov.condicionPago] : ""}</div>
          </div>
        </div>
      }
      pie="Por favor confirmar recepción de esta orden y fecha de entrega."
    >
      <PrintTable
        head={["Código", "Producto", "Cantidad", enUSD ? "Costo unit. USD" : "Costo unit.", "Desc.", "Subtotal"]}
        rows={oc.items.map((i) => {
          const p = prod(i.productoId);
          return [p?.codigo, p?.nombre, formatQty(i.cantidadPedida, p?.unidad ?? "UN"), m(costo(i)), `${i.descuentoPct} %`, m(i.cantidadPedida * costo(i) * (1 - i.descuentoPct / 100))];
        })}
      />
      <div className="mt-4 ml-auto w-64 space-y-1 text-[12px]">
        <div className="flex justify-between"><span>Subtotal</span><span className="tnum">{m(tot.subtotal)}</span></div>
        <div className="flex justify-between"><span>IVA {oc.circuito === 1 ? db.config.ivaPct : 0} %</span><span className="tnum">{m(tot.iva)}</span></div>
        <div className="flex justify-between border-t border-ink pt-1 text-[13px] font-semibold"><span>Total</span><span className="tnum">{m(tot.total)}</span></div>
        {enUSD && oc.tipoCambioAplicado ? <div className="flex justify-between text-muted"><span>Equivale a</span><span className="tnum">{formatMoney(oc.total)}</span></div> : null}
      </div>
      {enUSD && (
        <p className="mt-3 text-[12px]">
          {oc.tipoCambioAplicado ? textoTipoCambioAplicado(oc.tipoCambioAplicado, oc.tipoCambioFecha) : "Tipo de cambio: se fija al confirmar la orden."}
        </p>
      )}
      {oc.observaciones && <p className="mt-4"><b>Observaciones:</b> {oc.observaciones}</p>}
    </PrintLayout>
  );
}
