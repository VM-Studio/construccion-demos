"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Ban, HardHat, Plus, Receipt, Send, Undo2, Wallet } from "lucide-react";
import { reintentarArca } from "@/server/actions/arca";
import { useStore } from "@/store";
import { useDb, usePuede, useSucursalActiva, useVeCircuito2 } from "@/store/selectors";
import type { Cobranza, Comprobante, DevolucionNP, NotaPedido, Obra } from "@/domain/types";
import { MEDIO_PAGO_LABEL, TIPO_COMPROBANTE_LABEL } from "@/domain/estados";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { Combobox } from "@/components/shared/combobox";
import { SelectorCliente } from "@/components/shared/alta-rapida";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { NuevaObraDialog } from "@/components/shared/obra-select";
import { PrintPreview } from "@/components/shared/print-layout";
import { DateRangePicker } from "@/components/shared/filter-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AvisoAnulado, BotonAnularPago } from "@/components/modulos/cuentas/anular-pago";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { PRESETS_LISTADO, periodoDesdePreset, type Periodo } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { CobranzaDialog } from "@/components/modulos/cuentas/cobranza-dialog";
import { ComprobanteDocumento, ReciboDocumento } from "@/components/modulos/cuentas/documentos";
import { DevolucionDialog } from "./nota-pedido-detalle";

const useCliente = () => {
  const db = useDb();
  const m = React.useMemo(() => new Map(db.clientes.map((c) => [c.id, c])), [db.clientes]);
  return (id?: string) => (id ? m.get(id) : undefined);
};
const circuitoOpts = (veC2: boolean) => [{ value: "", label: "AC1 y AC2" }, { value: "1", label: "AC1 · Fiscal" }, ...(veC2 ? [{ value: "2", label: "AC2 · Interno" }] : [])];

// ───────────────────────── Comprobantes de venta ─────────────────────────

export function ComprobantesView() {
  const db = useDb();
  const params = useSearchParams();
  const veC2 = useVeCircuito2();
  const sucursal = useSucursalActiva();
  const cliente = useCliente();
  const [ver, setVer] = React.useState<Comprobante | null>(() => db.comprobantes.find((c) => c.id === params.get("id")) ?? null);
  const [periodo, setPeriodo] = React.useState<Periodo>(() => periodoDesdePreset("90D"));
  const [circuito, setCircuito] = React.useState("");
  const [tipo, setTipo] = React.useState("");
  const filas = db.comprobantes.filter((c) => c.clienteId && c.tipo !== "SALDO_A_FAVOR" && (veC2 || c.circuito !== 2) && (!sucursal || c.sucursalId === sucursal) && c.fecha >= periodo.desde && c.fecha <= periodo.hasta && (!circuito || String(c.circuito) === circuito) && (!tipo || c.tipo === tipo));
  const tot = filas.reduce((a, c) => ({ f: a.f + (c.tipo === "NOTA_CREDITO" ? -c.total : c.total), s: a.s + c.saldoPendiente }), { f: 0, s: 0 });
  const columnas: Column<Comprobante>[] = [
    { key: "t", header: "Tipo", cell: (c) => <span className="whitespace-nowrap">{TIPO_COMPROBANTE_LABEL[c.tipo]}{c.letra ? ` ${c.letra}` : ""}</span> },
    { key: "n", header: "Número", sortable: true, sortValue: (c) => c.numero, cell: (c) => <span className="whitespace-nowrap font-mono text-[12px]">{c.numero}</span> },
    { key: "ci", header: "Circuito", cell: (c) => <CircuitoBadge circuito={c.circuito} corto /> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (c) => c.fecha, cell: (c) => <span className="text-muted">{formatDate(c.fecha)}</span> },
    { key: "c", header: "Cliente", cell: (c) => <span className="block min-w-[150px]">{cliente(c.clienteId)?.nombreFantasia ?? cliente(c.clienteId)?.razonSocial}</span> },
    { key: "r", header: "Referencia", cell: (c) => <span className="whitespace-nowrap font-mono text-[11px] text-muted">{db.notasPedido.find((n) => n.id === c.notaPedidoId)?.numero ?? db.acopios.find((a) => a.id === c.acopioId)?.numero ?? "—"}</span> },
    { key: "to", header: "Total", align: "right", sortable: true, sortValue: (c) => c.total, footer: <span className="tnum">{formatMoney(tot.f, { decimals: false })}</span>, cell: (c) => <span className={cn("tnum", c.tipo === "NOTA_CREDITO" && "text-success")}>{c.tipo === "NOTA_CREDITO" ? "− " : ""}{formatMoney(c.total, { decimals: false })}</span> },
    { key: "s", header: "Saldo", align: "right", footer: <span className="tnum">{formatMoney(tot.s, { decimals: false })}</span>, cell: (c) => <span className="tnum">{formatMoney(c.saldoPendiente, { decimals: false })}</span> },
    { key: "e", header: "Estado", cell: (c) => <StatusBadge tipo="COMPROBANTE" estado={c.estado} /> },
    {
      key: "arca",
      header: "ARCA",
      cell: (c) =>
        c.circuito !== 1 || c.tipo === "SALDO_INICIAL" ? <span className="text-disabled">—</span> : c.arcaEstado === "AUTORIZADO" ? <Badge variant="success" title={`CAE ${c.cae}`}>Autorizada</Badge> : c.arcaEstado === "PENDIENTE" ? <Badge variant="warning" title={c.arcaError}>Pendiente</Badge> : <span className="text-disabled">—</span>,
      hideOnMobile: true,
    },
  ];
  return (
    <>
      <PageHeader titulo="Comprobantes de venta" descripcion="Facturas F1 (fiscal) y F2 (interno) y notas de crédito, incluida la facturación de acopios." />
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(c) => c.id}
        onRowClick={setVer}
        searchText={(c) => `${c.numero} ${cliente(c.clienteId)?.razonSocial}`}
        initialSort={{ key: "f", dir: "desc" }}
        showFooter
        empty={!db.comprobantes.some((c) => c.clienteId && c.tipo !== "SALDO_A_FAVOR") ? <VacioGuiado pagina="comprobantes" icono={Receipt} /> : { icono: Receipt, titulo: "Sin comprobantes en el período" }}
        filters={
          <>
            <DateRangePicker value={periodo} onChange={setPeriodo} presets={PRESETS_LISTADO} />
            <div className="w-[130px]"><Select size="sm" aria-label="Circuito" value={circuito} onValueChange={setCircuito} options={circuitoOpts(veC2)} /></div>
            <div className="w-[150px]"><Select size="sm" aria-label="Tipo" value={tipo} onValueChange={setTipo} options={[{ value: "", label: "Todos los tipos" }, { value: "FACTURA", label: "Facturas" }, { value: "NOTA_CREDITO", label: "Notas de crédito" }]} /></div>
          </>
        }
      />
      {ver && (
        <PrintPreview
          open
          onOpenChange={(v) => !v && setVer(null)}
          titulo={`${TIPO_COMPROBANTE_LABEL[ver.tipo]} ${ver.numero}`}
          acciones={<AccionesComprobante comprobante={db.comprobantes.find((c) => c.id === ver.id) ?? ver} onAnulado={() => setVer(null)} />}
        >
          <ComprobanteDocumento comprobante={db.comprobantes.find((c) => c.id === ver.id) ?? ver} />
        </PrintPreview>
      )}
    </>
  );
}

/** Reintentar ARCA y anular una factura (con todo lo conectado) desde la vista del comprobante. */
export function AccionesComprobante({ comprobante: c, onAnulado }: { comprobante: Comprobante; onAnulado?: () => void }) {
  const puedeAnular = usePuede("ventas.anular");
  const puedeFacturar = usePuede("ventas.facturar");
  const [enviando, setEnviando] = React.useState(false);
  const [anular, setAnular] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const reintentar = async () => {
    setEnviando(true);
    const r = await reintentarArca(c.id);
    setEnviando(false);
    if (!r.ok) return toast.error(r.error);
    if (r.estado !== "AUTORIZADO") toast.error(r.error ?? "ARCA no autorizó el comprobante.");
  };
  return (
    <>
      {c.circuito === 1 && c.arcaEstado === "PENDIENTE" && c.estado !== "ANULADO" && puedeFacturar && (
        <Button variant="secondary" loading={enviando} onClick={reintentar}><Send /> Enviar a ARCA</Button>
      )}
      {c.tipo === "FACTURA" && c.estado !== "ANULADO" && puedeAnular && (
        <Button variant="ghost" className="text-danger" onClick={() => setAnular(true)}><Ban /> Anular</Button>
      )}
      <Dialog open={anular} onOpenChange={setAnular}>
        <DialogContent
          size="sm"
          title={`¿Anular ${c.numero}?`}
          description={c.notaPedidoId ? "Se anula la venta completa: factura, cobros aplicados y entregas (lo entregado vuelve al stock)." : c.arcaEstado === "AUTORIZADO" ? "Se emite una nota de crédito por el total." : "La factura queda anulada y los cobros aplicados se anulan."}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAnular(false)}>Volver</Button>
              <Button
                variant="danger"
                disabled={!motivo.trim()}
                onClick={async () => {
                  const r = await useStore.getState().anularFactura(c.id, motivo.trim());
                  if (!r.ok) return toast.error(r.error);
                  setAnular(false);
                  onAnulado?.();
                }}
              >
                Anular
              </Button>
            </>
          }
        >
          <FormField label="Motivo" required htmlFor="anf-m"><Input id="anf-m" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></FormField>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ───────────────────────── Recibos ─────────────────────────

export function RecibosView() {
  const db = useDb();
  const params = useSearchParams();
  const veC2 = useVeCircuito2();
  const sucursal = useSucursalActiva();
  const cliente = useCliente();
  const puede = usePuede("ctacte.cobrar");
  const [nuevo, setNuevo] = React.useState(params.get("nuevo") === "1");
  const [verId, setVerId] = React.useState<string | null>(params.get("id"));
  const ver = verId ? db.cobranzas.find((c) => c.id === verId) ?? null : null;
  const setVer = (c: Cobranza | null) => setVerId(c?.id ?? null);
  const [periodo, setPeriodo] = React.useState<Periodo>(() => periodoDesdePreset("90D"));
  const [circuito, setCircuito] = React.useState("");
  const filas = db.cobranzas.filter((c) => (veC2 || c.circuito !== 2) && (!sucursal || c.sucursalId === sucursal) && c.fecha >= periodo.desde && c.fecha <= periodo.hasta && (!circuito || String(c.circuito) === circuito));
  const vigentes = filas.filter((c) => !c.anulado);
  const total = vigentes.reduce((a, c) => a + c.total, 0);
  const imputadoA = (c: Cobranza) =>
    c.imputaciones
      .map((i) => {
        const cmp = db.comprobantes.find((x) => x.id === i.comprobanteId);
        const aco = cmp?.acopioId ? db.acopios.find((a) => a.id === cmp.acopioId) : undefined;
        return aco ? `Acopio ${aco.numero}` : cmp?.numero;
      })
      .join(", ");
  const columnas: Column<Cobranza>[] = [
    { key: "n", header: "Número", sortable: true, sortValue: (c) => c.numero, cell: (c) => <span className="flex items-center gap-2 whitespace-nowrap font-mono text-[12px]"><span className={c.anulado ? "text-muted line-through" : undefined}>{c.numero}</span>{c.anulado && <Badge variant="neutral">Anulado</Badge>}</span> },
    { key: "ci", header: "Circuito", cell: (c) => <CircuitoBadge circuito={c.circuito} corto /> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (c) => c.fecha, cell: (c) => <span className="text-muted">{formatDate(c.fecha)}</span> },
    { key: "c", header: "Cliente", cell: (c) => <span className="block min-w-[150px]">{cliente(c.clienteId)?.nombreFantasia ?? cliente(c.clienteId)?.razonSocial}</span> },
    { key: "m", header: "Medios", cell: (c) => <span className="text-[12px] text-muted">{c.medios.map((m) => MEDIO_PAGO_LABEL[m.medio]).join(", ")}</span> },
    { key: "i", header: "Imputado a", cell: (c) => <span className="block max-w-[260px] truncate font-mono text-[11px] text-muted" title={imputadoA(c)}>{imputadoA(c) || "—"}</span> },
    { key: "t", header: "Total", align: "right", sortable: true, sortValue: (c) => c.total, footer: <span className="tnum">{formatMoney(total, { decimals: false })}</span>, cell: (c) => <span className={cn("tnum", c.anulado && "text-muted line-through")}>{formatMoney(c.total, { decimals: false })}</span> },
    { key: "af", header: "A favor", align: "right", cell: (c) => (c.saldoAFavor ? <span className="tnum text-success">{formatMoney(c.saldoAFavor, { decimals: false })}</span> : <span className="text-disabled">—</span>) },
  ];
  return (
    <>
      <PageHeader titulo="Recibos" descripcion="Entrada de fondos: cobros imputados a facturas y a acopios en cuenta corriente." acciones={puede && <Button onClick={() => setNuevo(true)}><Wallet /> Nuevo recibo</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Cobrado en el período" valor={formatMoney(total, { compact: true })} acento subtexto={`${vigentes.length} recibos`} />
        <KpiCard label="Cobros de acopios" valor={formatMoney(vigentes.filter((c) => c.imputaciones.some((i) => db.comprobantes.find((x) => x.id === i.comprobanteId)?.acopioId)).reduce((a, c) => a + c.total, 0), { compact: true })} />
        <KpiCard label="Cheques en cartera" valor={String(db.cheques.filter((c) => c.estado === "EN_CARTERA").length)} subtexto={formatMoney(db.cheques.filter((c) => c.estado === "EN_CARTERA").reduce((a, c) => a + c.importe, 0), { compact: true })} />
      </div>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(c) => c.id}
        onRowClick={setVer}
        searchText={(c) => `${c.numero} ${cliente(c.clienteId)?.razonSocial} ${imputadoA(c)}`}
        initialSort={{ key: "f", dir: "desc" }}
        showFooter
        empty={db.cobranzas.length === 0 ? <VacioGuiado pagina="recibos" icono={Wallet} onAccion={() => setNuevo(true)} puedeAccion={puede} /> : { icono: Wallet, titulo: "Sin recibos en el período" }}
        filters={
          <>
            <DateRangePicker value={periodo} onChange={setPeriodo} presets={PRESETS_LISTADO} />
            <div className="w-[130px]"><Select size="sm" aria-label="Circuito" value={circuito} onValueChange={setCircuito} options={circuitoOpts(veC2)} /></div>
          </>
        }
      />
      <CobranzaDialog open={nuevo} onOpenChange={setNuevo} />
      {ver && (
        <PrintPreview open onOpenChange={(v) => !v && setVer(null)} titulo={`Recibo ${ver.numero}${ver.anulado ? " · ANULADO" : ""}`} acciones={<BotonAnularPago tipo="recibo" doc={ver} onAnulado={() => setVer(null)} />}>
          {ver.anulado && <AvisoAnulado motivo={ver.motivoAnulacion} />}
          <ReciboDocumento cobranza={ver} />
        </PrintPreview>
      )}
    </>
  );
}

// ───────────────────────── Devoluciones ─────────────────────────

export function DevolucionesView() {
  const db = useDb();
  const router = useRouter();
  const veC2 = useVeCircuito2();
  const cliente = useCliente();
  const puede = usePuede("ventas.editar");
  const [elegir, setElegir] = React.useState(false);
  const [npId, setNpId] = React.useState("");
  const [np, setNp] = React.useState<NotaPedido | null>(null);
  const filas = db.devoluciones.filter((d) => veC2 || d.circuito !== 2);
  const columnas: Column<DevolucionNP>[] = [
    { key: "n", header: "Número", sortable: true, sortValue: (d) => d.numero, cell: (d) => <span className="whitespace-nowrap font-mono text-[12px]">{d.numero}</span> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (d) => d.fecha, cell: (d) => <span className="text-muted">{formatDate(d.fecha)}</span> },
    { key: "c", header: "Cliente", cell: (d) => <span className="block min-w-[150px]">{cliente(d.clienteId)?.nombreFantasia ?? cliente(d.clienteId)?.razonSocial}</span> },
    { key: "np", header: "Nota de pedido", cell: (d) => <Link onClick={(e) => e.stopPropagation()} href={`/ventas/notas-pedido/${d.notaPedidoId}`} className="whitespace-nowrap font-mono text-[12px] hover:underline">{db.notasPedido.find((n) => n.id === d.notaPedidoId)?.numero}</Link> },
    { key: "a", header: "Acopio", cell: (d) => (d.acopioId ? <Link onClick={(e) => e.stopPropagation()} href={`/acopios/${d.acopioId}`} className="whitespace-nowrap font-mono text-[12px] hover:underline">{db.acopios.find((a) => a.id === d.acopioId)?.numero}</Link> : <span className="text-disabled">—</span>) },
    { key: "m", header: "Monto", align: "right", sortable: true, sortValue: (d) => d.monto, cell: (d) => <span className="tnum">{formatMoney(d.monto)}</span> },
    { key: "rd", header: "RD / NC", cell: (d) => <span className="whitespace-nowrap font-mono text-[11px] text-muted">{[db.remitos.find((r) => r.id === d.remitoDevolucionId)?.numero ?? d.remitosRef?.join(", "), db.comprobantes.find((c) => c.id === d.notaCreditoId)?.numero ?? d.notasCreditoRef?.join(", ")].filter(Boolean).join(" · ") || "—"}</span> },
    { key: "mo", header: "Motivo", cell: (d) => <span className="block min-w-[200px] text-[12px] text-muted">{d.motivo}</span> },
  ];
  const candidatas = db.notasPedido.filter((n) => n.estado !== "BORRADOR" && n.estado !== "ANULADA" && n.items.some((i) => i.cantidad - (i.devueltos ?? 0) > 0));
  return (
    <>
      <PageHeader titulo="Devoluciones" descripcion="Devoluciones de notas de pedido (DP): remito de devolución, nota de crédito y saldo de acopio." acciones={puede && <Button onClick={() => setElegir(true)}><Undo2 /> Nueva devolución</Button>} />
      <DataTable rows={filas} columns={columnas} getRowId={(d) => d.id} onRowClick={(d) => router.push(`/ventas/notas-pedido/${d.notaPedidoId}`)} searchText={(d) => `${d.numero} ${cliente(d.clienteId)?.razonSocial} ${d.motivo}`} initialSort={{ key: "f", dir: "desc" }} empty={db.devoluciones.length === 0 ? <VacioGuiado pagina="devoluciones" icono={Undo2} /> : { icono: Undo2, titulo: "No hay devoluciones para el filtro" }} />
      <Dialog open={elegir} onOpenChange={setElegir}>
        <DialogContent size="md" title="Nueva devolución" description="Elegí la nota de pedido a devolver." footer={<><Button variant="secondary" onClick={() => setElegir(false)}>Cancelar</Button><Button disabled={!npId} onClick={() => { setNp(db.notasPedido.find((n) => n.id === npId) ?? null); setElegir(false); }}>Continuar</Button></>}>
          {candidatas.length === 0 && <p className="mb-3 text-[13px] text-muted">No hay notas de pedido confirmadas con mercadería para devolver.</p>}
          <Combobox aria-label="Nota de pedido" value={npId} onChange={setNpId} placeholder="Buscar NP por número o cliente…" opciones={candidatas.map((n) => ({ value: n.id, label: `${n.numero} · ${cliente(n.clienteId)?.nombreFantasia ?? cliente(n.clienteId)?.razonSocial}`, detalle: formatDate(n.fecha) }))} />
        </DialogContent>
      </Dialog>
      {np && <DevolucionDialog np={np} open onOpenChange={(v) => !v && setNp(null)} />}
    </>
  );
}

// ───────────────────────── Obras ─────────────────────────

export function ObrasView() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const cliente = useCliente();
  const puede = usePuede("ventas.editar");
  const [nueva, setNueva] = React.useState<string | null>(null);
  const [elegir, setElegir] = React.useState(params.get("nuevo") === "1");
  const [cliId, setCliId] = React.useState(params.get("cliente") ?? "");
  const filas = db.obras;
  const columnas: Column<Obra>[] = [
    { key: "n", header: "Obra", sortable: true, sortValue: (o) => o.nombre, cell: (o) => <span className="block min-w-[180px] font-medium">{o.nombre}</span> },
    { key: "c", header: "Cliente", sortable: true, sortValue: (o) => cliente(o.clienteId)?.razonSocial ?? "", cell: (o) => <span>{cliente(o.clienteId)?.nombreFantasia ?? cliente(o.clienteId)?.razonSocial}</span> },
    { key: "d", header: "Dirección", cell: (o) => <span className="text-muted">{[o.direccion, o.localidad].filter(Boolean).join(", ") || "—"}</span> },
    { key: "a", header: "Acopios", align: "right", cell: (o) => <span className="tnum">{db.acopios.filter((a) => a.obraIds.includes(o.id)).length || "—"}</span> },
    { key: "np", header: "Notas de pedido", align: "right", cell: (o) => <span className="tnum">{db.notasPedido.filter((n) => n.items.some((i) => i.obraId === o.id)).length || "—"}</span> },
    { key: "e", header: "Estado", cell: (o) => (o.activa ? <Badge variant="success">Activa</Badge> : <Badge>Inactiva</Badge>) },
  ];
  return (
    <>
      <PageHeader titulo="Obras" descripcion="Obras de cada cliente: a qué obra va cada línea de venta y cada acopio." acciones={puede && <Button onClick={() => setElegir(true)}><Plus /> Nueva obra</Button>} />
      <DataTable rows={filas} columns={columnas} getRowId={(o) => o.id} onRowClick={(o) => router.push(`/clientes/${o.clienteId}`)} searchText={(o) => `${o.nombre} ${cliente(o.clienteId)?.razonSocial} ${o.localidad ?? ""}`} initialSort={{ key: "c", dir: "asc" }} empty={db.obras.length === 0 ? <VacioGuiado pagina="obras" icono={HardHat} extra={puede && <Button size="sm" onClick={() => setElegir(true)}><Plus /> Nueva obra</Button>} /> : { icono: HardHat, titulo: "No hay obras para el filtro" }} />
      <Dialog open={elegir} onOpenChange={setElegir}>
        <DialogContent size="sm" title="Nueva obra" description="Elegí el cliente (o crealo acá mismo)." footer={<><Button variant="secondary" onClick={() => setElegir(false)}>Cancelar</Button><Button disabled={!cliId} onClick={() => { setNueva(cliId); setElegir(false); }}>Continuar</Button></>}>
          <SelectorCliente value={cliId} onChange={setCliId} />
        </DialogContent>
      </Dialog>
      {nueva && <NuevaObraDialog clienteId={nueva} open onOpenChange={(v) => !v && setNueva(null)} />}
    </>
  );
}

