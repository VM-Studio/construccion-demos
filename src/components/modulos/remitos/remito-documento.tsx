"use client";
import { useDb } from "@/store/selectors";
import type { Remito } from "@/domain/types";
import { TIPO_REMITO_LABEL } from "@/domain/estados";
import { PrintLayout, PrintTable } from "@/components/shared/print-layout";
import { formatDate, formatQty } from "@/lib/format";

/** Remito imprimible: numeración, datos según circuito, obra, ítems y "Recibí conforme". */
export function RemitoDocumento({ remito: r, picking }: { remito: Remito; picking?: boolean }) {
  const db = useDb();
  const c = db.clientes.find((x) => x.id === r.clienteId);
  const np = db.notasPedido.find((n) => n.id === r.notaPedidoId);
  const aco = db.acopios.find((a) => a.id === r.acopioId);
  const obra = db.obras.find((o) => o.id === r.obraId);
  return (
    <PrintLayout
      titulo={picking ? "Orden de picking" : `Remito${r.tipo !== "VENTA" ? ` de ${TIPO_REMITO_LABEL[r.tipo].toLowerCase()}` : ""}`}
      numero={r.numero}
      fecha={formatDate(r.fechaEntrega ?? r.fecha)}
      leyenda={picking ? "Uso interno de depósito" : r.circuito === 1 ? "Documento no válido como factura" : "Documento interno"}
      subtitulo={
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <b>Cliente:</b> {c?.razonSocial} ({c?.codigo})<br />
            {r.circuito === 1 && <>CUIT {c?.cuit || "—"} · {c?.condicionIVA === "RI" ? "Responsable inscripto" : c?.condicionIVA === "MONOTRIBUTO" ? "Monotributo" : "Consumidor final"}<br /></>}
            <b>Obra:</b> {obra?.nombre ?? "—"}
          </div>
          <div>
            <b>Entrega:</b> {r.direccionEntrega ?? "Retira en mostrador"}<br />
            <b>Nota de pedido:</b> {np?.numero ?? "—"}{aco && <> · <b>Acopio:</b> {aco.numero}</>}<br />
            <b>Depósito:</b> {db.depositos.find((d) => d.id === r.depositoId)?.nombre} · {r.pesoTotalKg} kg
          </div>
        </div>
      }
      pie={r.comentario}
    >
      <PrintTable
        head={picking ? ["Código", "Artículo", "Cantidad", "Posición", "✓"] : ["Código", "Artículo", "Obra", "Cantidad"]}
        rows={r.items
          .filter((i) => i.cantidad > 0)
          .map((i) => {
            const p = db.productos.find((x) => x.id === i.productoId);
            return picking ? [p?.codigo, p?.nombre, formatQty(i.cantidad, p?.unidad ?? "UN"), db.despachos.find((d) => d.id === r.despachoId)?.posicion ?? "", "☐"] : [p?.codigo, p?.nombre, db.obras.find((o) => o.id === i.obraId)?.nombre ?? "", formatQty(i.cantidad, p?.unidad ?? "UN")];
          })}
      />
      {!picking && (
        <div className="mt-12 grid grid-cols-2 gap-12 text-center text-[11px]">
          <div className="border-t border-ink pt-1">Recibí conforme · firma y aclaración</div>
          <div className="border-t border-ink pt-1">DNI · fecha y hora</div>
        </div>
      )}
    </PrintLayout>
  );
}
