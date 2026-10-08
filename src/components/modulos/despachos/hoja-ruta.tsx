"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CheckCheck, CheckCircle2, Play, Printer, Route, X } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useSucursalActiva } from "@/store/selectors";
import type { HojaRuta } from "@/domain/types";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { SelectorChofer, SelectorVehiculo } from "@/components/shared/alta-rapida";
import { PrintLayout, PrintPreview, PrintTable } from "@/components/shared/print-layout";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatNumber } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { pesoDespacho } from "./documentos";
import { useAccionesDespacho } from "./despachos-view";

/** Hoja de ruta: envíos del día por vehículo, conectada a los estados de despacho. */
export function HojaRutaView() {
  const db = useDb();
  const sucursal = useSucursalActiva();
  const puede = usePuede("despachos.operar");
  const { entregar, dialogo } = useAccionesDespacho();
  const [fecha, setFecha] = React.useState(diaLocal(new Date()));
  const [imprimir, setImprimir] = React.useState<HojaRuta | null>(null);
  const fechaISO = () => {
    const [y, m, d] = fecha.split("-").map(Number);
    return new Date(y, m - 1, d, 7).toISOString();
  };
  const hojas = db.hojasRuta.filter((h) => diaLocal(h.fecha) === fecha);
  const asignados = new Set(hojas.flatMap((h) => h.despachoIds));
  const sinAsignar = db.despachos.filter((d) => d.modalidad === "ENVIO" && ["ESPERA", "PREPARACION", "FINALIZADO"].includes(d.estado) && !asignados.has(d.id) && (!sucursal || d.sucursalId === sucursal) && diaLocal(d.fechaProgramada) <= fecha);
  const vehiculos = db.vehiculos.filter((v) => v.activo);
  const cli = (id: string) => db.clientes.find((c) => c.id === id);
  const run = (r: { ok: boolean; error?: string }, msg?: string) => (!r.ok ? toast.error(r.error) : msg && toast.success(msg));

  return (
    <>
      <PageHeader titulo="Hoja de ruta" descripcion="Envíos del día por vehículo: se cargan al finalizar en el depósito y salen en recorrido." acciones={<Input type="date" aria-label="Fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-9 w-[160px]" />} />
      {(!vehiculos.length || (!db.hojasRuta.length && !sinAsignar.length)) && (
        <div className="mb-4 rounded-card border border-border bg-surface">
          <VacioGuiado pagina="hojaRuta" icono={Route} className="py-6" />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader><CardTitle>Envíos sin asignar ({sinAsignar.length})</CardTitle></CardHeader>
          {sinAsignar.length === 0 ? (
            <EmptyState
              icono={Route}
              titulo={db.despachos.some((d) => d.modalidad === "ENVIO") ? "Todo asignado" : "No hay envíos para asignar"}
              descripcion={db.despachos.some((d) => d.modalidad === "ENVIO") ? undefined : "Los envíos a obra aparecen acá cuando una venta tiene entrega con envío o programás una entrega pendiente."}
            />
          ) : (
            <ul className="divide-y divide-border">
              {sinAsignar.map((d) => (
                <li key={d.id} className="px-4 py-2.5 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{cli(d.clienteId)?.nombreFantasia ?? cli(d.clienteId)?.razonSocial}</span>
                    <StatusBadge tipo="DESPACHO" estado={d.estado} />
                  </div>
                  <div className="text-[11px] text-muted">{d.numero} · {d.direccionEntrega} · {formatNumber(pesoDespacho(d, db.productos), 0)} kg</div>
                  {puede && (
                    <div className="mt-1.5 w-[200px]">
                      <SelectorVehiculo aria-label="Asignar a vehículo" value="" placeholder="Asignar a vehículo…" onChange={(v) => v && run(useStore.getState().asignarAHojaRuta(d.id, v, fechaISO()), "Asignado a la hoja de ruta")} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-4">
          {vehiculos.map((v) => {
            const h = hojas.find((x) => x.vehiculoId === v.id);
            const paradas = (h?.despachoIds ?? []).map((id) => db.despachos.find((d) => d.id === id)!).filter(Boolean);
            const carga = paradas.reduce((a, d) => a + pesoDespacho(d, db.productos), 0);
            return (
              <Card key={v.id}>
                <CardHeader className="flex-wrap">
                  <div>
                    <CardTitle>{v.patente} · {v.descripcion}</CardTitle>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-muted">
                      <Progress value={Math.min(1, carga / v.capacidadKg)} className="w-24" tone={carga > v.capacidadKg ? "danger" : "ink"} /> {formatNumber(carga, 0)} / {formatNumber(v.capacidadKg, 0)} kg
                    </div>
                  </div>
                  {h && (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-[190px]"><SelectorChofer aria-label="Chofer" placeholder="Elegí el chofer…" disabled={h.estado !== "PLANIFICADA" || !puede} value={h.choferId} onChange={(c) => c && run(useStore.getState().cambiarChoferHoja(h.id, c), "Chofer asignado")} /></div>
                      <StatusBadge tipo="HOJA" estado={h.estado} />
                      <Button size="sm" variant="ghost" onClick={() => setImprimir(h)}><Printer /> Imprimir</Button>
                      {puede && h.estado === "PLANIFICADA" && <Button size="sm" onClick={() => run(useStore.getState().iniciarRecorrido(h.id), "Recorrido iniciado")}><Play /> Iniciar recorrido</Button>}
                      {puede && h.estado === "EN_CURSO" && <Button size="sm" variant="secondary" onClick={() => run(useStore.getState().cerrarHojaRuta(h.id), "Hoja de ruta cerrada")}><CheckCheck /> Cerrar hoja</Button>}
                    </div>
                  )}
                </CardHeader>
                {paradas.length === 0 ? (
                  <p className="px-4 pb-4 text-[13px] text-muted">Sin paradas asignadas.</p>
                ) : (
                  <ol className="divide-y divide-border">
                    {paradas.map((d, i) => (
                      <li key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-[11px] font-semibold">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{cli(d.clienteId)?.nombreFantasia ?? cli(d.clienteId)?.razonSocial}</span>
                          <span className="block truncate text-[11px] text-muted">{d.numero} · {d.direccionEntrega} · {formatNumber(pesoDespacho(d, db.productos), 0)} kg{d.remitoId && <> · <Link href={`/remitos/${d.remitoId}`} className="hover:underline">{db.remitos.find((r) => r.id === d.remitoId)?.numero}</Link></>}</span>
                        </span>
                        <StatusBadge tipo="DESPACHO" estado={d.estado} />
                        {puede && d.estado === "EN_VIAJE" && <Button size="sm" variant="secondary" onClick={() => entregar(d)}><CheckCircle2 /> Entregado</Button>}
                        {puede && h?.estado === "PLANIFICADA" && (
                          <span className={cn("flex")}>
                            <Button size="icon-sm" variant="ghost" aria-label="Subir" onClick={() => useStore.getState().moverEnHojaRuta(h.id, d.id, -1)}><ArrowUp /></Button>
                            <Button size="icon-sm" variant="ghost" aria-label="Bajar" onClick={() => useStore.getState().moverEnHojaRuta(h.id, d.id, 1)}><ArrowDown /></Button>
                            <Button size="icon-sm" variant="ghost" aria-label="Quitar" onClick={() => run(useStore.getState().quitarDeHojaRuta(d.id))}><X /></Button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            );
          })}
        </div>
      </div>
      {imprimir && (
        <PrintPreview open onOpenChange={(v) => !v && setImprimir(null)} titulo="Hoja de ruta">
          <PrintLayout titulo="Hoja de ruta" fecha={formatDate(imprimir.fecha)} subtitulo={<div className="text-[11px]"><b>Vehículo:</b> {db.vehiculos.find((v) => v.id === imprimir.vehiculoId)?.patente} · <b>Chofer:</b> {db.choferes.find((c) => c.id === imprimir.choferId)?.nombre}</div>} pie="Firmas de recepción en cada remito.">
            <PrintTable head={["#", "Cliente", "Dirección", "Remito", "Kg", "Firma"]} rows={imprimir.despachoIds.map((id, i) => { const d = db.despachos.find((x) => x.id === id)!; return [i + 1, cli(d.clienteId)?.razonSocial, d.direccionEntrega, db.remitos.find((r) => r.id === d.remitoId)?.numero ?? "", formatNumber(pesoDespacho(d, db.productos), 0), ""]; })} />
          </PrintLayout>
        </PrintPreview>
      )}
      {dialogo}
    </>
  );
}
