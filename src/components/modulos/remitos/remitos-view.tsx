"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Eye, FileText, MoreHorizontal, Plus, Printer, Upload, XCircle } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useSucursalActiva, useVeCircuito2 } from "@/store/selectors";
import type { Remito } from "@/domain/types";
import { TIPO_REMITO_LABEL } from "@/domain/estados";
import { lineasPendientes } from "@/domain/stock";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { Combobox } from "@/components/shared/combobox";
import { DateRangePicker } from "@/components/shared/filter-bar";
import { ClipContador } from "@/components/shared/adjuntos-panel";
import { PrintPreview } from "@/components/shared/print-layout";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Segmented } from "@/components/ui/tabs";
import { formatDate, formatNumber } from "@/lib/format";
import { PRESETS_LISTADO, diaLocal, periodoDesdePreset, type Periodo } from "@/lib/periodos";
import { RemitoDocumento } from "./remito-documento";
import { SubirFirmadoDialog } from "./subir-firmado";

const TIPOS: Record<string, Remito["tipo"]> = { venta: "VENTA", desacopio: "DESACOPIO", devolucion: "DEVOLUCION", transferencia: "TRANSFERENCIA" };

/** Remitos sin firmar que cuentan como "pendientes de cerrar en papel" (últimos 30 días). */
export const sinFirmar = (r: Remito) => r.estado === "HECHO" && r.tipo !== "TRANSFERENCIA" && !r.firmadoAdjuntoId && Date.now() - Date.parse(r.fechaEntrega ?? r.fecha) <= 30 * 86_400_000;

export function RemitosView() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const sucursal = useSucursalActiva();
  const veC2 = useVeCircuito2();
  const puedeOperar = usePuede("remitos.operar");
  const puedeVender = usePuede("ventas.editar");
  const puedeAnular = usePuede("ventas.anular");
  const { confirmar, dialog } = useConfirm();
  const tipoParam = TIPOS[params.get("tipo") ?? ""] ?? "";
  const [tipo, setTipo] = React.useState<string>(tipoParam);
  const [estado, setEstado] = React.useState("");
  const [facturado, setFacturado] = React.useState("");
  const [firmados, setFirmados] = React.useState(params.get("firmados") === "1" ? "SI" : params.get("firmados") === "0" ? "NO" : "");
  const [deposito, setDeposito] = React.useState("");
  const [circuito, setCircuito] = React.useState("");
  const [periodo, setPeriodo] = React.useState<Periodo>(() => periodoDesdePreset(params.get("firmados") === "0" ? "30D" : "90D"));
  const [imprimir, setImprimir] = React.useState<Remito | null>(null);
  const [subir, setSubir] = React.useState<string | null>(null);
  const [nuevo, setNuevo] = React.useState(params.get("nuevo") === "1");
  React.useEffect(() => setTipo(TIPOS[params.get("tipo") ?? ""] ?? ""), [params]);
  React.useEffect(() => {
    if (params.get("nuevo") === "1") setNuevo(true);
  }, [params]);
  React.useEffect(() => setFirmados(params.get("firmados") === "1" ? "SI" : params.get("firmados") === "0" ? "NO" : ""), [params]);

  const cli = React.useMemo(() => new Map(db.clientes.map((c) => [c.id, c])), [db.clientes]);
  const np = React.useMemo(() => new Map(db.notasPedido.map((n) => [n.id, n])), [db.notasPedido]);
  const adj = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const a of db.adjuntos) if (a.entidadTipo === "REMITO") m.set(a.entidadId, (m.get(a.entidadId) ?? 0) + 1);
    return m;
  }, [db.adjuntos]);
  const base = db.remitos.filter((r) => (veC2 || r.circuito !== 2) && (!sucursal || r.sucursalId === sucursal));
  const filas = base.filter(
    (r) =>
      (!tipo || r.tipo === tipo) &&
      (!estado || r.estado === estado) &&
      (!facturado || (facturado === "SI") === r.facturado) &&
      (!firmados || (firmados === "SI") === !!r.firmadoAdjuntoId) &&
      (!deposito || r.depositoId === deposito) &&
      (!circuito || String(r.circuito) === circuito) &&
      ((r.estado !== "HECHO" && r.estado !== "ANULADO") || (r.fecha >= periodo.desde && r.fecha <= periodo.hasta)),
  );
  const hoy = diaLocal(new Date());
  const productos = (r: Remito) => r.items.map((i) => db.productos.find((p) => p.id === i.productoId)?.nombre).join(" ");

  const columnas: Column<Remito>[] = [
    { key: "fa", header: "Facturado", cell: (r) => (r.facturado ? <Badge variant="success">Sí</Badge> : <Badge>No</Badge>) },
    { key: "ad", header: "Adjuntos", cell: (r) => <ClipContador cantidad={adj.get(r.id) ?? 0} firmado={!!r.firmadoAdjuntoId} /> },
    { key: "n", header: "Nro", sortable: true, sortValue: (r) => r.numero, cell: (r) => <span className="whitespace-nowrap font-mono text-[12px]">{r.numero}</span> },
    { key: "ci", header: "Circuito", cell: (r) => <CircuitoBadge circuito={r.circuito} corto />, hideOnMobile: true },
    { key: "np", header: "Nro nota de pedido", cell: (r) => (r.notaPedidoId ? <Link onClick={(e) => e.stopPropagation()} href={`/ventas/notas-pedido/${r.notaPedidoId}`} className="whitespace-nowrap font-mono text-[12px] hover:underline">{np.get(r.notaPedidoId)?.numero}</Link> : <span className="text-disabled">—</span>) },
    ...(tipo === "DESACOPIO" || !tipo ? [{ key: "ac", header: "Acopio", cell: (r: Remito) => (r.acopioId ? <Link onClick={(e) => e.stopPropagation()} href={`/acopios/${r.acopioId}`} className="whitespace-nowrap font-mono text-[11px] text-muted hover:underline">{db.acopios.find((a) => a.id === r.acopioId)?.numero}</Link> : <span className="text-disabled">—</span>), hideOnMobile: true }] : []),
    { key: "f", header: "Fecha", sortable: true, sortValue: (r) => r.fecha, cell: (r) => <span className="whitespace-nowrap text-muted">{formatDate(r.fecha)}</span> },
    { key: "fe", header: "Fecha entrega", sortable: true, sortValue: (r) => r.fechaEntrega ?? "", cell: (r) => <span className="whitespace-nowrap text-muted">{formatDate(r.fechaEntrega)}</span>, hideOnMobile: true },
    { key: "c", header: "Cliente", sortable: true, sortValue: (r) => cli.get(r.clienteId ?? "")?.razonSocial ?? "", cell: (r) => <span className="block min-w-[160px]"><span className="mr-1 font-mono text-[11px] text-muted">{cli.get(r.clienteId ?? "")?.codigo}</span>{cli.get(r.clienteId ?? "")?.nombreFantasia ?? cli.get(r.clienteId ?? "")?.razonSocial}</span> },
    { key: "o", header: "Obra", cell: (r) => <span className="block max-w-[160px] truncate text-[12px] text-muted">{db.obras.find((o) => o.id === r.obraId)?.nombre ?? "—"}</span>, hideOnMobile: true },
    { key: "su", header: "Sucursal", cell: (r) => <span className="whitespace-nowrap text-muted">{db.sucursales.find((s) => s.id === r.sucursalId)?.nombre}</span>, hideOnMobile: true },
    { key: "e", header: "Estado", cell: (r) => <StatusBadge tipo="REMITO" estado={r.estado} /> },
    { key: "d", header: "Depósito", cell: (r) => <span className="whitespace-nowrap text-muted">{db.depositos.find((d) => d.id === r.depositoId)?.nombre.replace("Depósito ", "")}</span>, hideOnMobile: true },
    { key: "q", header: "Cantidad total", align: "right", cell: (r) => <span className="tnum">{formatNumber(r.cantidadTotal)}</span> },
    { key: "kg", header: "Peso total (kg)", align: "right", cell: (r) => <span className="tnum">{formatNumber(r.pesoTotalKg, 0)}</span> },
    {
      key: "x",
      header: "",
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${r.numero}`}><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => router.push(`/remitos/${r.id}`)}><Eye /> Ver</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setImprimir(r)}><Printer /> Imprimir</DropdownMenuItem>
              {r.estado === "HECHO" && !r.firmadoAdjuntoId && puedeOperar && <DropdownMenuItem onSelect={() => setSubir(r.id)}><Upload /> Subir remito firmado</DropdownMenuItem>}
              {(r.estado === "INICIAL" || r.estado === "PICKING") && puedeAnular && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => confirmar({ titulo: `Anular ${r.numero}`, confirmLabel: "Anular", variant: "danger", onConfirm: () => { const x = useStore.getState().anularRemito(r.id, "Anulado desde el listado"); if (x.ok) toast.success("Remito anulado"); else toast.error(x.error); } })}><XCircle /> Anular</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const titulo = tipo ? `Remitos de ${TIPO_REMITO_LABEL[tipo].toLowerCase()}` : firmados === "SI" ? "Remitos firmados" : "Remitos";
  return (
    <>
      <PageHeader titulo={titulo} descripcion="Buscador global de remitos: picking, entregas, facturación y remito firmado." acciones={puedeVender && <Button onClick={() => setNuevo(true)}><Plus /> Nuevo remito</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="remitos-kpis">
        <KpiCard label="Remitos de hoy" valor={String(base.filter((r) => diaLocal(r.fecha) === hoy).length)} />
        <KpiCard label="En picking" valor={String(base.filter((r) => r.estado === "PICKING").length)} onClick={() => setEstado("PICKING")} />
        <KpiCard label="Hechos sin remito firmado" valor={String(base.filter(sinFirmar).length)} acento subtexto="lo que falta cerrar en papel" onClick={() => { setFirmados("NO"); setEstado("HECHO"); setPeriodo(periodoDesdePreset("30D")); }} />
        <KpiCard label="Sin facturar" valor={String(base.filter((r) => r.estado === "HECHO" && !r.facturado).length)} onClick={() => setFacturado("NO")} />
      </div>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(r) => r.id}
        onRowClick={(r) => router.push(`/remitos/${r.id}`)}
        searchText={(r) => `${r.numero} ${np.get(r.notaPedidoId ?? "")?.numero ?? ""} ${cli.get(r.clienteId ?? "")?.razonSocial ?? ""} ${cli.get(r.clienteId ?? "")?.codigo ?? ""} ${db.obras.find((o) => o.id === r.obraId)?.nombre ?? ""} ${productos(r)}`}
        searchPlaceholder="Remito, nota de pedido, cliente, obra o producto…"
        initialSort={{ key: "f", dir: "desc" }}
        empty={base.length ? { icono: FileText, titulo: "No hay remitos para el filtro" } : <VacioGuiado pagina="remitos" icono={FileText} puedeAccion={puedeVender} onAccion={() => setNuevo(true)} />}
        filters={
          <>
            <DateRangePicker value={periodo} onChange={setPeriodo} presets={PRESETS_LISTADO} />
            <div className="w-[140px]"><Select size="sm" aria-label="Tipo" value={tipo} onValueChange={setTipo} options={[{ value: "", label: "Todos los tipos" }, { value: "VENTA", label: "Venta" }, { value: "DESACOPIO", label: "Desacopio" }, { value: "DEVOLUCION", label: "Devolución" }]} /></div>
            <div className="w-[130px]"><Select size="sm" aria-label="Estado" value={estado} onValueChange={setEstado} options={[{ value: "", label: "Todo estado" }, { value: "INICIAL", label: "Inicial" }, { value: "PICKING", label: "Picking" }, { value: "HECHO", label: "Hecho" }, { value: "ANULADO", label: "Anulado" }]} /></div>
            <div className="w-[130px]"><Select size="sm" aria-label="Facturado" value={facturado} onValueChange={setFacturado} options={[{ value: "", label: "Facturado: todos" }, { value: "SI", label: "Facturados" }, { value: "NO", label: "Sin facturar" }]} /></div>
            <div className="w-[170px]"><Select size="sm" aria-label="Remito firmado" value={firmados} onValueChange={setFirmados} options={[{ value: "", label: "Firmado: todos" }, { value: "SI", label: "Con remito firmado" }, { value: "NO", label: "Sin remito firmado" }]} /></div>
            <div className="w-[160px]"><Select size="sm" aria-label="Depósito" value={deposito} onValueChange={setDeposito} options={[{ value: "", label: "Todos los depósitos" }, ...db.depositos.map((d) => ({ value: d.id, label: d.nombre }))]} /></div>
            <div className="w-[120px]"><Select size="sm" aria-label="Circuito" value={circuito} onValueChange={setCircuito} options={[{ value: "", label: "AC1 y AC2" }, { value: "1", label: "AC1" }, ...(veC2 ? [{ value: "2", label: "AC2" }] : [])]} /></div>
          </>
        }
      />
      {imprimir && (
        <PrintPreview open onOpenChange={(v) => !v && setImprimir(null)} titulo={`Remito ${imprimir.numero}`}>
          <RemitoDocumento remito={imprimir} />
        </PrintPreview>
      )}
      {subir && <SubirFirmadoDialog remitoId={subir} open onOpenChange={(v) => !v && setSubir(null)} />}
      {nuevo && <NuevoRemitoDialog onClose={() => setNuevo(false)} />}
      {dialog}
    </>
  );
}

/** Nuevo remito: elegir una NP con pendiente y generar el remito (picking o hecho). */
function NuevoRemitoDialog({ onClose }: { onClose: () => void }) {
  const db = useDb();
  const router = useRouter();
  const [npId, setNpId] = React.useState("");
  const [estado, setEstado] = React.useState<"PICKING" | "HECHO">("PICKING");
  const pendientes = lineasPendientes(db.notasPedido, db.remitos);
  const nps = [...new Set(pendientes.map((l) => l.notaPedidoId))].map((id) => db.notasPedido.find((n) => n.id === id)!).filter((n) => !db.remitos.some((r) => r.notaPedidoId === n.id && r.estado === "INICIAL"));
  const generar = () => {
    const r = useStore.getState().generarRemito(npId, { estado });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Remito ${r.data.numero} generado`);
    onClose();
    router.push(`/remitos/${r.data.id}`);
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="md" title="Nuevo remito" description="Elegí la nota de pedido con mercadería pendiente de entrega." footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!npId} onClick={generar}>Generar remito</Button></>}>
        <div className="space-y-3">
          {!nps.length && (
            <div className="rounded-card border border-border bg-subtle p-3 text-[13px] text-muted">
              No hay notas de pedido con mercadería pendiente de entrega. Los remitos nacen de las notas de pedido: confirmá una venta y generá su remito.
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={() => router.push("/ventas/notas-pedido/nueva")}><Plus /> Nueva nota de pedido</Button>
              </div>
            </div>
          )}
          <Combobox aria-label="Nota de pedido" value={npId} onChange={setNpId} placeholder="Buscar NP por número o cliente…" opciones={nps.map((n) => ({ value: n.id, label: `${n.numero} · ${db.clientes.find((c) => c.id === n.clienteId)?.nombreFantasia ?? db.clientes.find((c) => c.id === n.clienteId)?.razonSocial}`, detalle: n.origen === "ACOPIO" ? "Acopio" : "Venta" }))} />
          <Segmented value={estado} onChange={setEstado} options={[{ value: "PICKING", label: "Pasa a picking" }, { value: "HECHO", label: "Retira ahora (hecho)" }]} />
          <p className="text-[12px] text-muted">El remito toma todo lo pendiente de la NP. Para entregas parciales usá Pendientes de entrega.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

