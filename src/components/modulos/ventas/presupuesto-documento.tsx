"use client";

import { addDays } from "date-fns";
import { useDb } from "@/store/selectors";
import type { Pedido, Presupuesto } from "@/domain/types";
import { calcularTotales } from "@/domain/ventas";
import { CONDICION_IVA_LABEL, CONDICION_PAGO_LABEL } from "@/domain/estados";
import { PrintLayout, PrintTable } from "@/components/shared/print-layout";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { nombreUsuario } from "@/lib/referencias";

/** Presupuesto / nota de pedido imprimible, profesional y listo para enviar. */
export function PresupuestoDocumento({ doc, tipo }: { doc: Presupuesto | Pedido; tipo: "presupuesto" | "pedido" }) {
  const db = useDb();
  const c = db.clientes.find((x) => x.id === doc.clienteId);
  const prod = (id: string) => db.productos.find((p) => p.id === id);
  const t = calcularTotales(doc.items, doc.descuentoPct, db.config.ivaPct);
  const presupuesto = tipo === "presupuesto" ? (doc as Presupuesto) : undefined;
  const pedido = tipo === "pedido" ? (doc as Pedido) : undefined;
  return (
    <PrintLayout
      titulo={tipo === "presupuesto" ? "Presupuesto" : "Nota de pedido"}
      numero={doc.numero}
      fecha={formatDate(doc.fecha)}
      subtitulo={
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] font-semibold uppercase text-muted">Cliente</div>
            <div className="font-semibold">{c?.razonSocial}</div>
            <div>CUIT {c?.cuit || "—"} · {c ? CONDICION_IVA_LABEL[c.condicionIVA] : ""}</div>
            <div>{c?.direccion}, {c?.localidad}</div>
            <div>{c?.telefono}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-muted">Condiciones</div>
            {presupuesto && <div>Válido hasta el {formatDate(addDays(new Date(presupuesto.fecha), presupuesto.validezDias))}</div>}
            {pedido && <div>Entrega: {pedido.modalidadEntrega === "ENVIO" ? `envío a ${pedido.direccionEntrega ?? ""}` : "retira en mostrador"}{pedido.fechaEntregaComprometida && ` · ${formatDate(pedido.fechaEntregaComprometida)}`}</div>}
            <div>Pago: {CONDICION_PAGO_LABEL[pedido?.condicionPago ?? c?.condicionPago ?? "CONTADO"]}</div>
            <div>Vendedor: {nombreUsuario(db, doc.vendedorId)}</div>
          </div>
        </div>
      }
      pie={tipo === "presupuesto" ? "Precios en pesos, sujetos a disponibilidad de stock. Flete según zona." : "Firma del cliente ______________________"}
    >
      <PrintTable
        head={["Código", "Producto", "Cantidad", "Precio unit.", "Desc.", "Importe"]}
        rows={doc.items.map((i) => {
          const p = prod(i.productoId);
          return [p?.codigo, `${p?.nombre ?? ""}${p?.marca ? ` · ${p.marca}` : ""}`, formatQty(i.cantidad, p?.unidad ?? "UN"), formatMoney(i.precioUnitario), `${i.descuentoPct} %`, formatMoney(i.cantidad * i.precioUnitario * (1 - i.descuentoPct / 100))];
        })}
      />
      <div className="mt-4 ml-auto w-64 space-y-1 text-[12px]">
        <div className="flex justify-between"><span>Subtotal</span><span className="tnum">{formatMoney(t.subtotal)}</span></div>
        {t.descuento > 0 && <div className="flex justify-between"><span>Descuento {doc.descuentoPct} %</span><span className="tnum">− {formatMoney(t.descuento)}</span></div>}
        <div className="flex justify-between"><span>IVA {db.config.ivaPct} %</span><span className="tnum">{formatMoney(t.iva)}</span></div>
        <div className="flex justify-between border-t border-ink pt-1 text-[13px] font-semibold"><span>Total</span><span className="tnum">{formatMoney(t.total)}</span></div>
      </div>
      {doc.observaciones && <p className="mt-4"><b>Observaciones:</b> {doc.observaciones}</p>}
    </PrintLayout>
  );
}
