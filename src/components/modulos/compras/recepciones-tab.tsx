"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageCheck, Printer } from "lucide-react";
import { useDb, usePuede } from "@/store/selectors";
import type { RecepcionMercaderia } from "@/domain/types";
import { DIFERENCIA_LABEL } from "@/domain/estados";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { AdjuntosPanel, ClipContador } from "@/components/shared/adjuntos-panel";
import { PrintLayout, PrintPreview, PrintTable } from "@/components/shared/print-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, formatMoney, formatQty } from "@/lib/format";
import { nombreUsuario } from "@/lib/referencias";

export function RecepcionesTab({ abrirId }: { abrirId?: string | null }) {
  const db = useDb();
  const router = useRouter();
  const verCostos = usePuede("margenes.ver");
  const oc = (id: string) => db.ordenesCompra.find((o) => o.id === id);
  const prov = (r: RecepcionMercaderia) => db.proveedores.find((p) => p.id === oc(r.ordenCompraId)?.proveedorId)?.razonSocial ?? "";
  const total = (r: RecepcionMercaderia) => r.items.reduce((a, i) => a + i.cantidadRecibida * i.costoUnitario, 0);

  const columnas: Column<RecepcionMercaderia>[] = [
    { key: "numero", header: "Número", sortable: true, sortValue: (r) => r.numero, cell: (r) => <span className="whitespace-nowrap font-mono text-[12px]">{r.numero}</span> },
    { key: "oc", header: "OC", cell: (r) => <Link href={`/compras/oc/${r.ordenCompraId}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap font-mono text-[12px] hover:underline">{oc(r.ordenCompraId)?.numero}</Link> },
    { key: "proveedor", header: "Proveedor", sortable: true, sortValue: prov, cell: (r) => <span className="block min-w-[160px]">{prov(r)}</span> },
    { key: "remito", header: "Remito", hideOnMobile: true, cell: (r) => <span className="whitespace-nowrap text-muted">{r.remitoProveedor}</span> },
    { key: "deposito", header: "Depósito", hideOnMobile: true, cell: (r) => <span className="whitespace-nowrap text-muted">{db.depositos.find((d) => d.id === r.depositoId)?.nombre}</span> },
    { key: "fecha", header: "Fecha", sortable: true, sortValue: (r) => r.fecha, cell: (r) => <span className="text-muted">{formatDate(r.fecha)}</span> },
    { key: "items", header: "Ítems", align: "right", cell: (r) => <span className="tnum">{r.items.length}</span> },
    { key: "origen", header: "Origen", cell: (r) => (oc(r.ordenCompraId)?.origen === "ACOPIO" ? <Badge variant="accent">Acopio</Badge> : <span className="font-mono text-[11px] text-muted">{db.comprobantes.find((c) => c.id === r.comprobanteId)?.numero ?? "—"}</span>) },
    { key: "adj", header: "Adjuntos", cell: (r) => <ClipContador cantidad={db.adjuntos.filter((a) => a.entidadTipo === "RECEPCION" && a.entidadId === r.id).length} /> },
    ...(verCostos ? [{ key: "total", header: "Total neto", align: "right" as const, sortable: true, sortValue: total, cell: (r: RecepcionMercaderia) => <span className="tnum">{formatMoney(total(r), { decimals: false })}</span> }] : []),
    { key: "usuario", header: "Usuario", hideOnMobile: true, cell: (r) => <span className="whitespace-nowrap text-muted">{nombreUsuario(db, r.usuarioId)}</span> },
  ];

  return (
    <>
      <DataTable
        rows={db.recepciones}
        columns={columnas}
        getRowId={(r) => r.id}
        searchText={(r) => `${r.numero} ${oc(r.ordenCompraId)?.numero} ${prov(r)} ${r.remitoProveedor}`}
        searchPlaceholder="Número, OC, proveedor o remito"
        onRowClick={(r) => router.replace(`/compras/recepciones?id=${r.id}`, { scroll: false })}
        initialSort={{ key: "fecha", dir: "desc" }}
        empty={{ icono: PackageCheck, titulo: "Todavía no hay recepciones" }}
      />
      <DetalleRecepcion id={abrirId} onClose={() => router.replace("/compras/recepciones", { scroll: false })} />
    </>
  );
}

function DetalleRecepcion({ id, onClose }: { id?: string | null; onClose: () => void }) {
  const db = useDb();
  const verCostos = usePuede("margenes.ver");
  const [imprimir, setImprimir] = React.useState(false);
  const r = id ? db.recepciones.find((x) => x.id === id) : undefined;
  if (!r) return null;
  const oc = db.ordenesCompra.find((o) => o.id === r.ordenCompraId);
  const prov = db.proveedores.find((p) => p.id === oc?.proveedorId);
  const prod = (pid: string) => db.productos.find((p) => p.id === pid);
  const dep = db.depositos.find((d) => d.id === r.depositoId)?.nombre;
  return (
    <>
      <EntitySheet
        open
        onOpenChange={(v) => !v && onClose()}
        titulo={`Recepción ${r.numero}`}
        subtitulo={`${prov?.razonSocial} · ${oc?.numero} · remito ${r.remitoProveedor} · ${formatDateTime(r.fecha)}`}
        acciones={<Button size="sm" variant="secondary" onClick={() => setImprimir(true)}><Printer /> Imprimir</Button>}
      >
        <table className="w-full text-table">
          <thead>
            <tr className="border-b border-border text-[12px] text-muted">
              <th className="py-2 text-left font-medium">Producto</th>
              <th className="py-2 text-right font-medium">Recibido</th>
              {verCostos && <th className="py-2 text-right font-medium">Costo</th>}
              <th className="py-2 pl-3 text-left font-medium">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {r.items.map((i) => (
              <tr key={i.itemOCId} className="border-b border-border">
                <td className="py-2">{prod(i.productoId)?.nombre}</td>
                <td className="py-2 text-right tnum">{formatQty(i.cantidadRecibida, prod(i.productoId)?.unidad ?? "UN")}</td>
                {verCostos && <td className="py-2 text-right tnum">{formatMoney(i.costoUnitario)}</td>}
                <td className="py-2 pl-3"><Badge variant={i.diferencia && i.diferencia !== "OK" ? "warning" : "success"}>{DIFERENCIA_LABEL[i.diferencia ?? "OK"]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-[13px] text-muted">Depósito: {dep} · Recibió: {nombreUsuario(db, r.usuarioId)}</p>
        {r.observaciones && <p className="mt-1 text-[13px]">{r.observaciones}</p>}
        <p className="mt-2 text-[13px] text-muted">{oc?.origen === "ACOPIO" ? "Retiro de acopio con proveedor: no genera deuda nueva." : `Factura del proveedor: ${db.comprobantes.find((c) => c.id === r.comprobanteId)?.numero ?? "—"}`}</p>
        <h3 className="mb-2 mt-5 text-[13px] font-semibold">Remito y factura del proveedor</h3>
        <AdjuntosPanel entidadTipo="RECEPCION" entidadId={r.id} categoriaDefecto="FACTURA_PROVEEDOR" />
      </EntitySheet>
      <PrintPreview open={imprimir} onOpenChange={setImprimir} titulo={`Recepción ${r.numero}`}>
        <PrintLayout titulo="Ingreso de mercadería" numero={r.numero} fecha={formatDate(r.fecha)} subtitulo={<div className="grid grid-cols-2 gap-4"><div><b>Proveedor:</b> {prov?.razonSocial}<br /><b>Remito:</b> {r.remitoProveedor}</div><div><b>OC:</b> {oc?.numero}<br /><b>Depósito:</b> {dep}</div></div>} pie="Recibió conforme ______________________">
          <PrintTable head={["Código", "Producto", "Cantidad", "Diferencia"]} rows={r.items.map((i) => [prod(i.productoId)?.codigo, prod(i.productoId)?.nombre, formatQty(i.cantidadRecibida, prod(i.productoId)?.unidad ?? "UN"), DIFERENCIA_LABEL[i.diferencia ?? "OK"]])} />
        </PrintLayout>
      </PrintPreview>
    </>
  );
}
