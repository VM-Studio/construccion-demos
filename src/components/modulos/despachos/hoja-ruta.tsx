"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowRight, ArrowUp, CheckCheck, PackageCheck, Play, Printer, Route, X } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useSucursalActiva } from "@/store/selectors";
import type { Despacho, HojaRuta } from "@/domain/types";
import { StatusBadge } from "@/components/shared/status-badge";
import { PrintPreview } from "@/components/shared/print-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate, formatNumber } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { HojaRutaDocumento, pesoDespacho } from "./documentos";
import { EntregaDialog } from "./despacho-sheet";

/**
 * Hoja de ruta del día: despachos sin asignar a la izquierda y una card por
 * vehículo con su carga, chofer y paradas ordenadas.
 */
export function HojaRutaTab({ onAbrir }: { onAbrir: (id: string) => void }) {
  const db = useDb();
  const sucursalId = useSucursalActiva();
  const puede = usePuede("despachos.operar");
  const [fecha, setFecha] = React.useState(diaLocal(new Date()));
  const [imprimir, setImprimir] = React.useState<HojaRuta | null>(null);
  const [entregar, setEntregar] = React.useState<Despacho | null>(null);
  const s = useStore.getState();
  const fechaISO = () => {
    const [y, m, d] = fecha.split("-").map(Number);
    return new Date(y, m - 1, d, 7).toISOString();
  };

  const hojas = db.hojasRuta.filter((h) => diaLocal(h.fecha) === fecha);
  const asignados = new Set(hojas.flatMap((h) => h.despachoIds));
  const sinAsignar = db.despachos.filter(
    (d) =>
      (d.estado === "PENDIENTE" || d.estado === "EN_PREPARACION") &&
      d.direccionEntrega !== "Retira en mostrador" &&
      !asignados.has(d.id) &&
      (!sucursalId || d.sucursalId === sucursalId) &&
      (diaLocal(d.fechaProgramada) === fecha || (fecha === diaLocal(new Date()) && diaLocal(d.fechaProgramada) < fecha)),
  );
  const cli = (id: string) => db.clientes.find((c) => c.id === id);
  const run = (r: { ok: boolean; error?: string }, msg?: string) => {
    if (!r.ok) toast.error(r.error);
    else if (msg) toast.success(msg);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Fecha
          <Input type="date" aria-label="Fecha de la hoja de ruta" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-8 w-[160px]" />
        </label>
        <span className="text-[13px] text-muted">{formatDate(fechaISO(), "EEEE d 'de' MMMM")}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Sin asignar</CardTitle>
            <span className="text-[12px] text-muted tnum">{sinAsignar.length}</span>
          </CardHeader>
          {sinAsignar.length === 0 ? (
            <EmptyState icono={CheckCheck} titulo="Todo asignado" descripcion="No quedan despachos del día sin vehículo." />
          ) : (
            <ul className="divide-y divide-border">
              {sinAsignar.map((d) => (
                <li key={d.id} className="flex items-center gap-2 px-3 py-2.5 text-[13px]">
                  <button className="min-w-0 flex-1 text-left" onClick={() => onAbrir(d.id)}>
                    <span className="flex items-center gap-2"><span className="font-mono text-[12px]">{d.numero}</span>{diaLocal(d.fechaProgramada) < fecha && <span className="text-[11px] font-medium text-danger">atrasado</span>}</span>
                    <span className="block truncate font-medium">{cli(d.clienteId)?.nombreFantasia ?? cli(d.clienteId)?.razonSocial}</span>
                    <span className="block truncate text-[11px] text-muted">{d.localidad} · {formatNumber(pesoDespacho(d, db.productos), 0)} kg</span>
                  </button>
                  {puede && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="secondary">Agregar a <ArrowRight /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Vehículo</DropdownMenuLabel>
                        {db.vehiculos.filter((v) => v.activo).map((v) => (
                          <DropdownMenuItem key={v.id} onSelect={() => run(s.asignarAHojaRuta(d.id, v.id, fechaISO()), `${d.numero} asignado a ${v.patente}`)}>
                            {v.patente} · {formatNumber(v.capacidadKg, 0)} kg
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          {db.vehiculos
            .filter((v) => v.activo)
            .map((v) => {
              const hoja = hojas.find((h) => h.vehiculoId === v.id && h.estado !== "CERRADA") ?? hojas.find((h) => h.vehiculoId === v.id);
              const paradas = (hoja?.despachoIds ?? []).map((id) => db.despachos.find((d) => d.id === id)).filter((d): d is Despacho => !!d);
              const carga = paradas.reduce((a, d) => a + pesoDespacho(d, db.productos), 0);
              const pct = carga / v.capacidadKg;
              const choferId = hoja?.choferId || v.choferId || "";
              const enCurso = hoja?.estado === "EN_CURSO";
              return (
                <Card key={v.id} className={cn(enCurso && "border-warning/40")}>
                  <div className="border-b border-border px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[14px] font-semibold">{v.patente}</div>
                        <div className="text-[12px] text-muted">{v.descripcion}</div>
                      </div>
                      {hoja && <StatusBadge tipo="HOJA" estado={hoja.estado} />}
                    </div>
                    <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
                      <div>
                        <div className="mb-1 flex justify-between text-[11px] text-muted">
                          <span>Carga</span>
                          <span className={cn("tnum", pct > 1 && "font-medium text-danger")}>{formatNumber(carga, 0)} / {formatNumber(v.capacidadKg, 0)} kg</span>
                        </div>
                        <Progress value={pct} tone={pct > 1 ? "danger" : pct > 0.85 ? "accent" : "ink"} />
                      </div>
                      <Select
                        size="sm"
                        className="w-[150px]"
                        aria-label="Chofer"
                        disabled={!puede || !hoja || hoja.estado !== "PLANIFICADA"}
                        value={choferId}
                        onValueChange={(c) => hoja && run(s.cambiarChoferHoja(hoja.id, c), "Chofer actualizado")}
                        options={db.choferes.filter((c) => c.activo).map((c) => ({ value: c.id, label: c.nombre }))}
                      />
                    </div>
                    {pct > 1 && <p className="mt-2 text-[12px] text-danger">Excede la capacidad del vehículo: pasá algún remito a otro camión.</p>}
                  </div>
                  {paradas.length === 0 ? (
                    <p className="px-4 py-6 text-center text-[13px] text-muted">Sin paradas para este día.</p>
                  ) : (
                    <ol className="divide-y divide-border">
                      {paradas.map((d, i) => (
                        <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-[11px] font-semibold tnum">{i + 1}</span>
                          <button className="min-w-0 flex-1 text-left" onClick={() => onAbrir(d.id)}>
                            <span className="block truncate font-medium">{cli(d.clienteId)?.nombreFantasia ?? cli(d.clienteId)?.razonSocial}</span>
                            <span className="block truncate text-[11px] text-muted">{d.numero} · {d.direccionEntrega} · {formatNumber(pesoDespacho(d, db.productos), 0)} kg</span>
                          </button>
                          <StatusBadge tipo="DESPACHO" estado={d.estado} />
                          {puede && hoja?.estado === "PLANIFICADA" && (
                            <span className="flex shrink-0">
                              <Button size="icon-sm" variant="ghost" aria-label="Subir parada" disabled={i === 0} onClick={() => run(s.moverEnHojaRuta(hoja.id, d.id, -1))}><ArrowUp /></Button>
                              <Button size="icon-sm" variant="ghost" aria-label="Bajar parada" disabled={i === paradas.length - 1} onClick={() => run(s.moverEnHojaRuta(hoja.id, d.id, 1))}><ArrowDown /></Button>
                              <Button size="icon-sm" variant="ghost" aria-label="Quitar de la hoja" onClick={() => run(s.quitarDeHojaRuta(d.id))}><X /></Button>
                            </span>
                          )}
                          {puede && d.estado === "EN_VIAJE" && (
                            <Button size="sm" variant="secondary" onClick={() => setEntregar(d)}><PackageCheck /> Entregado</Button>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                  {hoja && (
                    <div className="flex flex-wrap justify-end gap-2 border-t border-border px-3 py-2.5">
                      <Button size="sm" variant="ghost" onClick={() => setImprimir(hoja)}><Printer /> Imprimir hoja de ruta</Button>
                      {puede && hoja.estado === "PLANIFICADA" && paradas.length > 0 && (
                        <Button size="sm" onClick={() => run(s.iniciarRecorrido(hoja.id), `Recorrido iniciado: ${paradas.length} remitos en viaje y stock descontado`)}>
                          <Play /> Iniciar recorrido
                        </Button>
                      )}
                      {puede && hoja.estado === "EN_CURSO" && (
                        <Button size="sm" onClick={() => run(s.cerrarHojaRuta(hoja.id), "Hoja de ruta cerrada")}>
                          <CheckCheck /> Cerrar hoja
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          {db.vehiculos.filter((v) => v.activo).length === 0 && <Card><EmptyState icono={Route} titulo="No hay vehículos activos" /></Card>}
        </div>
      </div>
      <PrintPreview open={!!imprimir} onOpenChange={(v) => !v && setImprimir(null)} titulo="Hoja de ruta">
        {imprimir && <HojaRutaDocumento hoja={imprimir} />}
      </PrintPreview>
      {entregar && <EntregaDialog despacho={entregar} open={!!entregar} onOpenChange={(v) => !v && setEntregar(null)} />}
    </div>
  );
}
