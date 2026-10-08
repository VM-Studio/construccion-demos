"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Circle, Maximize2, MoreHorizontal, PlayCircle, Truck, XCircle, Flag } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useSucursalActiva } from "@/store/selectors";
import type { Despacho } from "@/domain/types";
import { minutosEspera, minutosPreparacion, minutosTotal, nivelTiempo, promedio } from "@/domain/despachos";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate, formatNumber } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { SubirFirmadoDialog } from "@/components/modulos/remitos/subir-firmado";

/** Reloj que se actualiza cada `ms` para los minutos en curso. */
export function useAhora(ms = 30_000) {
  const [ahora, setAhora] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return ahora;
}

const hora = (iso?: string) => (iso ? formatDate(iso, "HH:mm") : "—");
const Min = ({ v, total }: { v: number | null; total?: boolean }) => {
  if (v === null) return <span className="text-disabled">—</span>;
  const nivel = total ? nivelTiempo(v) : "ok";
  return <span className={cn("tnum", nivel === "critico" ? "font-semibold text-danger" : nivel === "alto" ? "font-semibold text-warning" : "")}>{v}</span>;
};

/** Acciones de un despacho (iniciar preparación, finalizar, entregar…) reutilizadas en lista y en vivo. */
export function useAccionesDespacho() {
  const [firmar, setFirmar] = React.useState<string | null>(null);
  const iniciar = (d: Despacho, posicion?: string) => {
    const r = useStore.getState().iniciarPreparacion(d.id, posicion);
    if (!r.ok) return toast.error(r.error);
    toast.success(`${d.numero} en preparación`, { description: "El remito pasó a picking." });
  };
  const finalizar = (d: Despacho) => {
    const r = useStore.getState().finalizarDespacho(d.id);
    if (!r.ok) return toast.error(r.error);
    if (d.modalidad === "RETIRA") {
      toast.success(`${d.numero} finalizado`, { description: "Remito hecho: subí el remito firmado." });
      if (r.data) setFirmar(r.data);
    } else toast.success(`${d.numero} cargado`, { description: "Pasa a la hoja de ruta; el remito firmado se sube al entregar." });
  };
  const entregar = (d: Despacho) => {
    const r = useStore.getState().marcarEntregado(d.id);
    if (!r.ok) return toast.error(r.error);
    toast.success(`${d.numero} entregado`);
    if (r.data) setFirmar(r.data);
  };
  const dialogo = firmar ? <SubirFirmadoDialog remitoId={firmar} open onOpenChange={(v) => !v && setFirmar(null)} /> : null;
  return { iniciar, finalizar, entregar, dialogo };
}

export function DespachosView() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const sucursal = useSucursalActiva();
  const puede = usePuede("despachos.operar");
  const ahora = useAhora();
  const { iniciar, finalizar, entregar, dialogo } = useAccionesDespacho();
  const { confirmar, dialog } = useConfirm();
  const desdeLink = params.get("despacho") ? db.despachos.find((d) => d.id === params.get("despacho")) : undefined;
  const [fecha, setFecha] = React.useState(desdeLink ? diaLocal(desdeLink.fechaEspera) : diaLocal(new Date()));
  const [deposito, setDeposito] = React.useState("");
  const [posicion, setPosicion] = React.useState("");
  const [estado, setEstado] = React.useState("");
  const [reprogramar, setReprogramar] = React.useState<Despacho | null>(null);
  const cli = (id: string) => db.clientes.find((c) => c.id === id);

  const delDia = db.despachos.filter((d) => (!sucursal || d.sucursalId === sucursal) && (diaLocal(d.fechaEspera) === fecha || (fecha === diaLocal(new Date()) && (d.estado === "ESPERA" || d.estado === "PREPARACION" || d.estado === "EN_VIAJE"))));
  const filas = delDia.filter((d) => (!deposito || d.depositoId === deposito) && (!posicion || d.posicion === posicion) && (!estado || d.estado === estado));
  const posiciones = [...new Set(db.depositos.filter((d) => !deposito || d.id === deposito).flatMap((d) => d.posiciones))];
  const cantidad = (d: Despacho) => d.items.reduce((a, i) => a + i.cantidad, 0);

  const columnas: Column<Despacho>[] = [
    { key: "av", header: "Avance", cell: (d) => (d.estado === "FINALIZADO" || d.estado === "ENTREGADO" || d.estado === "EN_VIAJE" ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-disabled" />) },
    { key: "n", header: "Nro", sortable: true, sortValue: (d) => d.numero, cell: (d) => <span className={cn("whitespace-nowrap font-mono text-[12px]", desdeLink?.id === d.id && "rounded bg-accent-soft px-1")}>{d.numero}</span> },
    { key: "e", header: "Estado", cell: (d) => <StatusBadge tipo="DESPACHO" estado={d.estado} /> },
    { key: "c", header: "Nombre", sortable: true, sortValue: (d) => cli(d.clienteId)?.razonSocial ?? "", cell: (d) => <span className="block min-w-[150px]">{cli(d.clienteId)?.nombreFantasia ?? cli(d.clienteId)?.razonSocial}<span className="block text-[11px] text-muted">{d.modalidad === "ENVIO" ? "Envío a obra" : "Retira"}</span></span> },
    { key: "q", header: "Cantidad", align: "right", cell: (d) => <span className="tnum">{formatNumber(cantidad(d))}</span> },
    {
      key: "p",
      header: "Posición",
      cell: (d) =>
        puede && (d.estado === "ESPERA" || d.estado === "PREPARACION") ? (
          <div className="w-[120px]" onClick={(e) => e.stopPropagation()}>
            <Select size="sm" aria-label="Posición" value={d.posicion} onValueChange={(v) => useStore.getState().asignarPosicion(d.id, v)} options={(db.depositos.find((x) => x.id === d.depositoId)?.posiciones ?? []).map((p) => ({ value: p, label: p }))} />
          </div>
        ) : (
          <span className="whitespace-nowrap text-muted">{d.posicion}</span>
        ),
    },
    { key: "fe", header: "Fecha espera", cell: (d) => <span className="whitespace-nowrap text-muted">{formatDate(d.fechaEspera)}</span>, hideOnMobile: true },
    { key: "he", header: "Hora espera", cell: (d) => <span className="tnum">{hora(d.fechaEspera)}</span> },
    { key: "me", header: "Min. espera", align: "right", cell: (d) => <Min v={minutosEspera(d, ahora)} /> },
    { key: "hp", header: "Hora preparación", cell: (d) => <span className="tnum">{hora(d.fechaInicioPreparacion)}</span> },
    { key: "mp", header: "Min. preparación", align: "right", cell: (d) => <Min v={minutosPreparacion(d, ahora)} /> },
    { key: "hf", header: "Hora final", cell: (d) => <span className="tnum">{hora(d.fechaFin)}</span> },
    { key: "mt", header: "Total min.", align: "right", sortable: true, sortValue: (d) => minutosTotal(d, ahora) ?? 0, cell: (d) => <Min v={minutosTotal(d, ahora)} total /> },
    { key: "r", header: "Remito", cell: (d) => (d.remitoId ? <Link onClick={(e) => e.stopPropagation()} href={`/remitos/${d.remitoId}`} className="whitespace-nowrap font-mono text-[11px] hover:underline">{db.remitos.find((r) => r.id === d.remitoId)?.numero}</Link> : <span className="text-disabled">—</span>) },
    { key: "v", header: "Vehículo", cell: (d) => <span className="whitespace-nowrap text-[12px] text-muted">{db.vehiculos.find((v) => v.id === d.vehiculoId)?.patente ?? (d.modalidad === "RETIRA" ? "Mostrador" : "—")}</span>, hideOnMobile: true },
    {
      key: "x",
      header: "",
      cell: (d) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {puede && d.estado === "ESPERA" && <Button size="sm" variant="secondary" onClick={() => iniciar(d)}><PlayCircle /> Iniciar</Button>}
          {puede && d.estado === "PREPARACION" && <Button size="sm" onClick={() => finalizar(d)}><Flag /> Finalizar</Button>}
          {puede && d.estado === "EN_VIAJE" && <Button size="sm" variant="secondary" onClick={() => entregar(d)}><CheckCircle2 /> Entregado</Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${d.numero}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              {d.notaPedidoId && <DropdownMenuItem onSelect={() => router.push(`/ventas/notas-pedido/${d.notaPedidoId}`)}>Ver nota de pedido</DropdownMenuItem>}
              {d.remitoId && <DropdownMenuItem onSelect={() => router.push(`/remitos/${d.remitoId}`)}>Ver remito</DropdownMenuItem>}
              {puede && d.estado === "ESPERA" && <DropdownMenuItem onSelect={() => setReprogramar(d)}><CalendarClock /> Reprogramar</DropdownMenuItem>}
              {puede && (d.estado === "ESPERA" || d.estado === "PREPARACION") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => confirmar({ titulo: `Cancelar ${d.numero}`, descripcion: "La mercadería vuelve a quedar pendiente de entrega.", confirmLabel: "Cancelar despacho", variant: "danger", onConfirm: () => { const r = useStore.getState().cancelarDespacho(d.id); if (r.ok) toast.success("Despacho cancelado"); else toast.error(r.error); } })}><XCircle /> Cancelar</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const esp = delDia.filter((d) => d.estado === "ESPERA").length;
  const prep = delDia.filter((d) => d.estado === "PREPARACION").length;
  const fin = delDia.filter((d) => ["FINALIZADO", "EN_VIAJE", "ENTREGADO"].includes(d.estado)).length;
  const pPrep = promedio(delDia.filter((d) => d.fechaFin).map((d) => minutosPreparacion(d, ahora)));
  const pTot = promedio(delDia.filter((d) => d.fechaFin).map((d) => minutosTotal(d, ahora)));
  return (
    <>
      <PageHeader
        titulo="Despachos"
        descripcion="Espera, preparación y finalizado con tiempos, por posición de carga del depósito."
        acciones={<Button variant="secondary" onClick={() => router.push("/despachos/en-vivo")}><Maximize2 /> Depósito en vivo</Button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5" data-tour="despachos-kpis">
        <KpiCard label="En espera" valor={String(esp)} onClick={() => setEstado("ESPERA")} />
        <KpiCard label="En preparación" valor={String(prep)} onClick={() => setEstado("PREPARACION")} />
        <KpiCard label="Finalizados" valor={String(fin)} />
        <KpiCard label="Preparación promedio" valor={pPrep === null ? "—" : `${pPrep} min`} acento />
        <KpiCard label="Tiempo total promedio" valor={pTot === null ? "—" : `${pTot} min`} subtexto={<span>ámbar &gt; 45 · rojo &gt; 90 min</span>} />
      </div>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(d) => d.id}
        searchText={(d) => `${d.numero} ${cli(d.clienteId)?.razonSocial} ${cli(d.clienteId)?.nombreFantasia ?? ""}`}
        searchPlaceholder="Despacho o cliente…"
        initialSort={{ key: "he", dir: "asc" }}
        onRowClick={(d) => d.notaPedidoId && router.push(`/ventas/notas-pedido/${d.notaPedidoId}`)}
        empty={db.despachos.length ? { icono: Truck, titulo: "No hay despachos para el día o el filtro" } : <VacioGuiado pagina="despachos" icono={Truck} />}
        filters={
          <>
            <Input type="date" aria-label="Fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-8 w-[150px]" />
            <div className="w-[170px]"><Select size="sm" aria-label="Depósito" value={deposito} onValueChange={(v) => { setDeposito(v); setPosicion(""); }} options={[{ value: "", label: "Todos los depósitos" }, ...db.depositos.map((d) => ({ value: d.id, label: d.nombre }))]} /></div>
            <div className="w-[140px]"><Select size="sm" aria-label="Posición" value={posicion} onValueChange={setPosicion} options={[{ value: "", label: "Toda posición" }, ...posiciones.map((p) => ({ value: p, label: p }))]} /></div>
            <div className="w-[150px]"><Select size="sm" aria-label="Estado" value={estado} onValueChange={setEstado} options={[{ value: "", label: "Todos los estados" }, { value: "ESPERA", label: "Espera" }, { value: "PREPARACION", label: "Preparación" }, { value: "FINALIZADO", label: "Finalizado" }, { value: "EN_VIAJE", label: "En viaje" }, { value: "ENTREGADO", label: "Entregado" }, { value: "CANCELADO", label: "Cancelado" }]} /></div>
          </>
        }
      />
      {reprogramar && <ReprogramarDialog d={reprogramar} onClose={() => setReprogramar(null)} />}
      {dialogo}
      {dialog}
    </>
  );
}

function ReprogramarDialog({ d, onClose }: { d: Despacho; onClose: () => void }) {
  const [fecha, setFecha] = React.useState(diaLocal(new Date(Date.now() + 86_400_000)));
  const [motivo, setMotivo] = React.useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm" title={`Reprogramar ${d.numero}`} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => { const [y, m, dd] = fecha.split("-").map(Number); const r = useStore.getState().reprogramarDespacho(d.id, new Date(y, m - 1, dd, 9).toISOString(), motivo || undefined); if (r.ok) { toast.success("Despacho reprogramado"); onClose(); } else toast.error(r.error); }}>Reprogramar</Button></>}>
        <div className="space-y-3">
          <FormField label="Nueva fecha" htmlFor="rp-f"><Input id="rp-f" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></FormField>
          <FormField label="Motivo" htmlFor="rp-m"><Input id="rp-m" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. lluvia, el cliente pidió otro día" /></FormField>
        </div>
      </DialogContent>
    </Dialog>
  );
}
