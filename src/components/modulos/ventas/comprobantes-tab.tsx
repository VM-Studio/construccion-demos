"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Ban, Printer, Receipt, Wallet } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useSucursalActiva } from "@/store/selectors";
import type { Comprobante } from "@/domain/types";
import { estaVencido } from "@/domain/cuentasCorrientes";
import { TIPO_COMPROBANTE_LABEL } from "@/domain/estados";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { PrintPreview } from "@/components/shared/print-layout";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { DateRangePicker } from "@/components/shared/filter-bar";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { enPeriodo, periodoDesdePreset, type Periodo } from "@/lib/periodos";
import { nombreUsuario } from "@/lib/referencias";
import { cn } from "@/lib/utils";
import { CobranzaDialog } from "@/components/modulos/cuentas/cobranza-dialog";
import { ComprobanteDocumento } from "@/components/modulos/cuentas/documentos";

/** Listado unificado de comprobantes de venta. */
export function ComprobantesTab() {
  const db = useDb();
  const sucursalId = useSucursalActiva();
  const [periodo, setPeriodo] = React.useState<Periodo>(() => periodoDesdePreset("90D"));
  const [tipo, setTipo] = React.useState("");
  const [estado, setEstado] = React.useState("");
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const cli = (id?: string) => db.clientes.find((c) => c.id === id);
  const filas = db.comprobantes.filter(
    (c) => c.clienteId && (!sucursalId || c.sucursalId === sucursalId) && (enPeriodo(c.fecha, periodo) || c.saldoPendiente > 0.009) && (!tipo || c.tipo === tipo) && (!estado || c.estado === estado),
  );
  const hoy = new Date();

  const columnas: Column<Comprobante>[] = [
    { key: "tipo", header: "Tipo", sortable: true, sortValue: (c) => c.tipo, cell: (c) => <span className="whitespace-nowrap">{TIPO_COMPROBANTE_LABEL[c.tipo]}</span> },
    { key: "numero", header: "Número", sortable: true, sortValue: (c) => c.numero, cell: (c) => <span className="whitespace-nowrap font-mono text-[12px]">{c.numero}</span> },
    { key: "cliente", header: "Cliente", sortable: true, sortValue: (c) => cli(c.clienteId)?.razonSocial ?? "", cell: (c) => <span className="block min-w-[160px]">{cli(c.clienteId)?.razonSocial}</span> },
    { key: "fecha", header: "Fecha", sortable: true, sortValue: (c) => c.fecha, cell: (c) => <span className="text-muted">{formatDate(c.fecha)}</span> },
    { key: "venc", header: "Vencimiento", sortable: true, sortValue: (c) => c.vencimiento ?? "", cell: (c) => <span className={cn("whitespace-nowrap", estaVencido(c, hoy) ? "font-medium text-danger" : "text-muted")}>{formatDate(c.vencimiento)}</span> },
    { key: "total", header: "Total", align: "right", sortable: true, sortValue: (c) => c.total, cell: (c) => <span className="tnum">{formatMoney(c.tipo === "NOTA_CREDITO" ? -c.total : c.total)}</span> },
    { key: "saldo", header: "Saldo pendiente", align: "right", sortable: true, sortValue: (c) => c.saldoPendiente, cell: (c) => <span className={cn("font-medium tnum", c.saldoPendiente < 0 && "text-success")}>{formatMoney(c.saldoPendiente)}</span> },
    { key: "estado", header: "Estado", sortable: true, sortValue: (c) => c.estado, cell: (c) => <StatusBadge tipo="COMPROBANTE" estado={c.estado} /> },
    {
      key: "origen",
      header: "Pedido / acopio",
      hideOnMobile: true,
      cell: (c) =>
        c.pedidoId ? (
          <Link onClick={(e) => e.stopPropagation()} href={`/ventas/pedidos/${c.pedidoId}`} className="whitespace-nowrap font-mono text-[12px] hover:underline">{db.pedidos.find((p) => p.id === c.pedidoId)?.numero}</Link>
        ) : c.acopioId ? (
          <Link onClick={(e) => e.stopPropagation()} href={`/acopios/${c.acopioId}`} className="whitespace-nowrap font-mono text-[12px] hover:underline">{db.acopios.find((a) => a.id === c.acopioId)?.numero}</Link>
        ) : (
          <span className="text-disabled">—</span>
        ),
    },
  ];

  return (
    <>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(c) => c.id}
        searchText={(c) => `${c.numero} ${cli(c.clienteId)?.razonSocial}`}
        searchPlaceholder="Número o cliente"
        onRowClick={(c) => setAbierto(c.id)}
        initialSort={{ key: "fecha", dir: "desc" }}
        empty={{ icono: Receipt, titulo: "Sin comprobantes" }}
        filters={
          <>
            <DateRangePicker value={periodo} onChange={setPeriodo} presets={[{ value: "MES", label: "Este mes" }, { value: "30D", label: "30 días" }, { value: "90D", label: "90 días" }]} />
            <Select size="sm" className="w-[160px]" aria-label="Tipo" value={tipo} onValueChange={setTipo} options={[{ value: "", label: "Todos los tipos" }, ...["FACTURA_A", "FACTURA_B", "NOTA_CREDITO", "RECIBO"].map((t) => ({ value: t, label: TIPO_COMPROBANTE_LABEL[t] }))]} />
            <Select size="sm" className="w-[140px]" aria-label="Estado" value={estado} onValueChange={setEstado} options={[{ value: "", label: "Todos" }, { value: "PENDIENTE", label: "Pendiente" }, { value: "PARCIAL", label: "Parcial" }, { value: "PAGADO", label: "Pagado" }, { value: "ANULADO", label: "Anulado" }]} />
          </>
        }
      />
      <ComprobanteSheet id={abierto} onClose={() => setAbierto(null)} />
    </>
  );
}

export function ComprobanteSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const db = useDb();
  const puedeAnular = usePuede("ventas.anular");
  const puedeCobrar = usePuede("ctacte.cobrar");
  const [imprimir, setImprimir] = React.useState(false);
  const [cobrar, setCobrar] = React.useState(false);
  const { confirmar, dialog } = useConfirm();
  const c = id ? db.comprobantes.find((x) => x.id === id) : undefined;
  if (!c) return null;
  const cliente = db.clientes.find((x) => x.id === c.clienteId);
  const cobros = db.cobranzas.filter((x) => x.imputaciones.some((i) => i.comprobanteId === c.id));
  const esFactura = c.tipo === "FACTURA_A" || c.tipo === "FACTURA_B";
  return (
    <>
      <EntitySheet
        open
        onOpenChange={(v) => !v && onClose()}
        titulo={`${TIPO_COMPROBANTE_LABEL[c.tipo]} ${c.numero}`}
        estado={<StatusBadge tipo="COMPROBANTE" estado={c.estado} />}
        subtitulo={`${cliente?.razonSocial} · ${formatDate(c.fecha)}${c.vencimiento ? ` · vence ${formatDate(c.vencimiento)}` : ""}`}
        acciones={
          <>
            <Button size="sm" variant="secondary" onClick={() => setImprimir(true)}><Printer /> Ver / imprimir</Button>
            {esFactura && c.saldoPendiente > 0.009 && puedeCobrar && <Button size="sm" onClick={() => setCobrar(true)}><Wallet /> Registrar cobro</Button>}
            {esFactura && c.estado !== "ANULADO" && !c.acopioId && puedeAnular && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  confirmar({
                    titulo: `Anular ${c.numero}`,
                    descripcion: "Se emite una nota de crédito espejo. Lo cobrado queda como saldo a favor y, si el pedido no se despachó, se libera el stock comprometido.",
                    confirmLabel: "Anular con nota de crédito",
                    variant: "danger",
                    onConfirm: () => {
                      const r = useStore.getState().anularComprobante(c.id);
                      if (r.ok) toast.success("Comprobante anulado con nota de crédito");
                      else toast.error(r.error);
                    },
                  })
                }
              >
                <Ban /> Anular
              </Button>
            )}
          </>
        }
      >
        <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
          <dt className="text-muted">Neto</dt>
          <dd className="text-right tnum">{formatMoney(c.subtotal)}</dd>
          <dt className="text-muted">IVA</dt>
          <dd className="text-right tnum">{formatMoney(c.iva)}</dd>
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold tnum">{formatMoney(c.total)}</dd>
          <dt className="text-muted">Saldo pendiente</dt>
          <dd className="text-right font-semibold tnum">{formatMoney(c.saldoPendiente)}</dd>
        </dl>
        {c.observaciones && <p className="mt-4 text-[13px] text-muted">{c.observaciones}</p>}
        <h4 className="mb-2 mt-6 text-[13px] font-semibold">Cobranzas imputadas</h4>
        {cobros.length ? (
          <ul className="divide-y divide-border rounded-card border border-border text-[13px]">
            {cobros.map((x) => (
              <li key={x.id} className="flex justify-between px-3 py-2">
                <span><span className="font-mono text-[12px]">{x.numero}</span> <span className="text-muted">· {formatDate(x.fecha)} · {nombreUsuario(db, x.usuarioId)}</span></span>
                <span className="tnum">{formatMoney(x.imputaciones.find((i) => i.comprobanteId === c.id)?.importe ?? 0)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">Sin cobranzas imputadas.</p>
        )}
      </EntitySheet>
      <PrintPreview open={imprimir} onOpenChange={setImprimir} titulo={`${TIPO_COMPROBANTE_LABEL[c.tipo]} ${c.numero}`}>
        <ComprobanteDocumento comprobante={c} />
      </PrintPreview>
      <CobranzaDialog open={cobrar} onOpenChange={setCobrar} clienteId={c.clienteId} comprobanteId={c.id} />
      {dialog}
    </>
  );
}
