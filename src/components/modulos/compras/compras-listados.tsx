"use client";
import * as React from "react";
import { Receipt, Wallet } from "lucide-react";
import { useDb, usePuede, useVeCircuito2 } from "@/store/selectors";
import type { Comprobante, PagoProveedor } from "@/domain/types";
import { MEDIO_PAGO_LABEL, TIPO_COMPROBANTE_LABEL } from "@/domain/estados";
import { estaVencido } from "@/domain/cuentasCorrientes";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { SelectorProveedor } from "@/components/shared/alta-rapida";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { AdjuntosPanel, ClipContador } from "@/components/shared/adjuntos-panel";
import { PrintPreview } from "@/components/shared/print-layout";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PagoDialog } from "@/components/modulos/cuentas/pago-dialog";
import { OrdenPagoDocumento } from "@/components/modulos/cuentas/documentos";

export function ComprobantesCompraView() {
  const db = useDb();
  const veC2 = useVeCircuito2();
  const [circuito, setCircuito] = React.useState("");
  const [ver, setVer] = React.useState<Comprobante | null>(null);
  const hoy = new Date();
  const filas = db.comprobantes.filter((c) => c.proveedorId && (veC2 || c.circuito !== 2) && (!circuito || String(c.circuito) === circuito));
  const prov = (id?: string) => db.proveedores.find((p) => p.id === id)?.razonSocial;
  const t = filas.reduce((a, c) => ({ t: a.t + c.total, s: a.s + c.saldoPendiente }), { t: 0, s: 0 });
  const columnas: Column<Comprobante>[] = [
    { key: "t", header: "Tipo", cell: (c) => <span className="whitespace-nowrap">{TIPO_COMPROBANTE_LABEL[c.tipo]}{c.letra ? ` ${c.letra}` : ""}</span> },
    { key: "n", header: "Número", sortable: true, sortValue: (c) => c.numero, cell: (c) => <span className="whitespace-nowrap font-mono text-[12px]">{c.numero}</span> },
    { key: "ci", header: "Circuito", cell: (c) => <CircuitoBadge circuito={c.circuito} corto /> },
    { key: "p", header: "Proveedor", cell: (c) => <span className="block min-w-[170px]">{prov(c.proveedorId)}</span> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (c) => c.fecha, cell: (c) => <span className="text-muted">{formatDate(c.fecha)}</span> },
    { key: "v", header: "Vence", cell: (c) => <span className={cn(estaVencido(c, hoy) ? "font-medium text-danger" : "text-muted")}>{formatDate(c.vencimiento)}</span> },
    { key: "r", header: "Origen", cell: (c) => <span className="whitespace-nowrap font-mono text-[11px] text-muted">{c.acopioProveedorId ? `Acopio ${db.acopiosProveedor.find((a) => a.id === c.acopioProveedorId)?.numero}` : db.recepciones.find((r) => r.id === c.recepcionId)?.numero ?? "—"}</span> },
    { key: "to", header: "Total", align: "right", footer: <span className="tnum">{formatMoney(t.t, { decimals: false })}</span>, cell: (c) => <span className="tnum">{formatMoney(c.total, { decimals: false })}</span> },
    { key: "s", header: "Saldo", align: "right", footer: <span className="tnum">{formatMoney(t.s, { decimals: false })}</span>, cell: (c) => <span className="tnum">{formatMoney(c.saldoPendiente, { decimals: false })}</span> },
    { key: "a", header: "Adjuntos", cell: (c) => <ClipContador cantidad={db.adjuntos.filter((a) => a.entidadTipo === "COMPROBANTE" && a.entidadId === c.id).length} /> },
    { key: "e", header: "Estado", cell: (c) => <StatusBadge tipo="COMPROBANTE" estado={c.estado} /> },
  ];
  return (
    <>
      <PageHeader titulo="Comprobantes de compra" descripcion="Facturas de proveedores (compras y acopios) y notas de crédito, por circuito." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Saldo a pagar" valor={formatMoney(t.s, { compact: true })} acento />
        <KpiCard label="Vencido" valor={formatMoney(filas.filter((c) => estaVencido(c, hoy)).reduce((a, c) => a + c.saldoPendiente, 0), { compact: true })} />
        <KpiCard label="Comprobantes" valor={String(filas.length)} />
      </div>
      <DataTable rows={filas} columns={columnas} getRowId={(c) => c.id} onRowClick={setVer} searchText={(c) => `${c.numero} ${prov(c.proveedorId)}`} initialSort={{ key: "f", dir: "desc" }} showFooter empty={db.comprobantes.some((c) => c.proveedorId) ? { icono: Receipt, titulo: "No hay comprobantes de compra para el filtro" } : <VacioGuiado pagina="comprobantesCompra" icono={Receipt} />} filters={<div className="w-[140px]"><Select size="sm" aria-label="Circuito" value={circuito} onValueChange={setCircuito} options={[{ value: "", label: "AC1 y AC2" }, { value: "1", label: "AC1 · Fiscal" }, ...(veC2 ? [{ value: "2", label: "AC2 · Interno" }] : [])]} /></div>} />
      <Dialog open={!!ver} onOpenChange={(v) => !v && setVer(null)}>
        {ver && (
          <DialogContent size="lg" title={`${TIPO_COMPROBANTE_LABEL[ver.tipo]} ${ver.numero}`} description={`${prov(ver.proveedorId)} · ${formatDate(ver.fecha)} · total ${formatMoney(ver.total)} · saldo ${formatMoney(ver.saldoPendiente)}`}>
            <AdjuntosPanel entidadTipo="COMPROBANTE" entidadId={ver.id} categoriaDefecto="FACTURA_PROVEEDOR" />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

export function OrdenesPagoView() {
  const db = useDb();
  const veC2 = useVeCircuito2();
  const puede = usePuede("ctacte.pagar");
  const [elegir, setElegir] = React.useState(false);
  const [provId, setProvId] = React.useState("");
  const [pagar, setPagar] = React.useState<string | null>(null);
  const [ver, setVer] = React.useState<PagoProveedor | null>(null);
  const filas = db.pagosProveedores.filter((o) => veC2 || o.circuito !== 2);
  const prov = (id: string) => db.proveedores.find((p) => p.id === id)?.razonSocial;
  const imputado = (o: PagoProveedor) => o.imputaciones.map((i) => { const c = db.comprobantes.find((x) => x.id === i.comprobanteId); return c?.acopioProveedorId ? `Acopio ${db.acopiosProveedor.find((a) => a.id === c.acopioProveedorId)?.numero}` : c?.numero; }).join(", ");
  const columnas: Column<PagoProveedor>[] = [
    { key: "n", header: "Número", sortable: true, sortValue: (o) => o.numero, cell: (o) => <span className="whitespace-nowrap font-mono text-[12px]">{o.numero}</span> },
    { key: "ci", header: "Circuito", cell: (o) => <CircuitoBadge circuito={o.circuito} corto /> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (o) => o.fecha, cell: (o) => <span className="text-muted">{formatDate(o.fecha)}</span> },
    { key: "p", header: "Proveedor", cell: (o) => <span className="block min-w-[170px]">{prov(o.proveedorId)}</span> },
    { key: "m", header: "Medios", cell: (o) => <span className="text-[12px] text-muted">{o.medios.map((m) => (m.chequeId ? "Cheque de terceros" : MEDIO_PAGO_LABEL[m.medio])).join(", ")}</span> },
    { key: "i", header: "Imputado a", cell: (o) => <span className="block max-w-[260px] truncate font-mono text-[11px] text-muted" title={imputado(o)}>{imputado(o)}</span> },
    { key: "t", header: "Total", align: "right", sortable: true, sortValue: (o) => o.total, footer: <span className="tnum">{formatMoney(filas.reduce((a, o) => a + o.total, 0), { decimals: false })}</span>, cell: (o) => <span className="tnum">{formatMoney(o.total, { decimals: false })}</span> },
  ];
  return (
    <>
      <PageHeader titulo="Órdenes de pago" descripcion="Salida de fondos: pagos a proveedores imputados a facturas de compra y a acopios en cuenta corriente." acciones={puede && <Button onClick={() => setElegir(true)}><Wallet /> Nueva orden de pago</Button>} />
      <DataTable rows={filas} columns={columnas} getRowId={(o) => o.id} onRowClick={setVer} searchText={(o) => `${o.numero} ${prov(o.proveedorId)} ${imputado(o)}`} initialSort={{ key: "f", dir: "desc" }} showFooter empty={db.pagosProveedores.length ? { icono: Wallet, titulo: "No hay órdenes de pago para el filtro" } : <VacioGuiado pagina="ordenesPago" icono={Wallet} extra={puede && db.proveedores.some((p) => p.activo) ? <Button size="sm" onClick={() => setElegir(true)}><Wallet /> Nueva orden de pago</Button> : undefined} />} />
      <Dialog open={elegir} onOpenChange={setElegir}>
        <DialogContent size="sm" title="Nueva orden de pago" description="Elegí el proveedor." footer={<><Button variant="secondary" onClick={() => setElegir(false)}>Cancelar</Button><Button disabled={!provId} onClick={() => { setPagar(provId); setElegir(false); }}>Continuar</Button></>}>
          <SelectorProveedor aria-label="Proveedor" value={provId} onChange={setProvId} />
        </DialogContent>
      </Dialog>
      {pagar && <PagoDialog open onOpenChange={(v) => !v && setPagar(null)} proveedorId={pagar} />}
      {ver && (
        <PrintPreview open onOpenChange={(v) => !v && setVer(null)} titulo={`Orden de pago ${ver.numero}`}>
          <OrdenPagoDocumento pago={ver} />
        </PrintPreview>
      )}
    </>
  );
}
