"use client";

import { useDb } from "@/store/selectors";
import type { OrdenCompra } from "@/domain/types";
import { PrintLayout, PrintTable } from "@/components/shared/print-layout";
import { CONDICION_PAGO_LABEL } from "@/domain/estados";
import { formatDate, formatMoney, formatQty } from "@/lib/format";

/** Documento imprimible de la orden de compra. */
export function OCDocumento({ oc }: { oc: OrdenCompra }) {
  const db = useDb();
  const prov = db.proveedores.find((p) => p.id === oc.proveedorId);
  const dep = db.depositos.find((d) => d.id === oc.depositoDestinoId);
  const prod = (id: string) => db.productos.find((p) => p.id === id);
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
        head={["Código", "Producto", "Cantidad", "Costo unit.", "Desc.", "Subtotal"]}
        rows={oc.items.map((i) => {
          const p = prod(i.productoId);
          return [p?.codigo, p?.nombre, formatQty(i.cantidadPedida, p?.unidad ?? "UN"), formatMoney(i.costoUnitario), `${i.descuentoPct} %`, formatMoney(i.cantidadPedida * i.costoUnitario * (1 - i.descuentoPct / 100))];
        })}
      />
      <div className="mt-4 ml-auto w-64 space-y-1 text-[12px]">
        <div className="flex justify-between"><span>Subtotal</span><span className="tnum">{formatMoney(oc.subtotal)}</span></div>
        <div className="flex justify-between"><span>IVA 21 %</span><span className="tnum">{formatMoney(oc.iva)}</span></div>
        <div className="flex justify-between border-t border-ink pt-1 text-[13px] font-semibold"><span>Total</span><span className="tnum">{formatMoney(oc.total)}</span></div>
      </div>
      {oc.observaciones && <p className="mt-4"><b>Observaciones:</b> {oc.observaciones}</p>}
    </PrintLayout>
  );
}
