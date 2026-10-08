"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Save, Truck, UserRound, X } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede } from "@/store/selectors";
import type { Chofer, Vehiculo } from "@/domain/types";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { SelectorChofer } from "@/components/shared/alta-rapida";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NumberInput } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { formatDate, formatNumber } from "@/lib/format";
import { pesoDespacho } from "./documentos";

export function FlotaTab({ onAbrirDespacho }: { onAbrirDespacho: (id: string) => void }) {
  const db = useDb();
  const puede = usePuede("vehiculos.editar");
  const [veh, setVeh] = React.useState<string | "nuevo" | null>(null);
  const [cho, setCho] = React.useState<string | "nuevo" | null>(null);

  const colV: Column<Vehiculo>[] = [
    { key: "pat", header: "Patente", sortable: true, sortValue: (v) => v.patente, cell: (v) => <span className="whitespace-nowrap font-mono text-[12px]">{v.patente}</span> },
    { key: "desc", header: "Descripción", cell: (v) => v.descripcion },
    { key: "cap", header: "Capacidad", align: "right", sortable: true, sortValue: (v) => v.capacidadKg, cell: (v) => <span className="tnum">{formatNumber(v.capacidadKg, 0)} kg</span> },
    { key: "cho", header: "Chofer habitual", cell: (v) => <span className="text-muted">{db.choferes.find((c) => c.id === v.choferId)?.nombre ?? "—"}</span> },
    { key: "viajes", header: "Despachos", align: "right", cell: (v) => <span className="tnum">{db.despachos.filter((d) => d.vehiculoId === v.id).length}</span> },
    { key: "act", header: "Estado", cell: (v) => (v.activo ? <Badge variant="success">Activo</Badge> : <Badge>Inactivo</Badge>) },
  ];
  const colC: Column<Chofer>[] = [
    { key: "nom", header: "Nombre", sortable: true, sortValue: (c) => c.nombre, cell: (c) => <span className="font-medium">{c.nombre}</span> },
    { key: "tel", header: "Teléfono", cell: (c) => <span className="text-muted">{c.telefono}</span> },
    { key: "viajes", header: "Despachos", align: "right", cell: (c) => <span className="tnum">{db.despachos.filter((d) => d.choferId === c.id).length}</span> },
    { key: "act", header: "Estado", cell: (c) => (c.activo ? <Badge variant="success">Activo</Badge> : <Badge>Inactivo</Badge>) },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div>
        <h3 className="mb-2 text-[14px] font-semibold">Vehículos</h3>
        <DataTable rows={db.vehiculos} columns={colV} getRowId={(v) => v.id} onRowClick={(v) => setVeh(v.id)} empty={db.vehiculos.length ? { icono: Truck, titulo: "No hay vehículos para la búsqueda" } : <VacioGuiado pagina="vehiculos" icono={Truck} puedeAccion={puede} onAccion={() => setVeh("nuevo")} />} actions={puede && <Button size="sm" onClick={() => setVeh("nuevo")}><Plus /> Nuevo vehículo</Button>} searchText={(v) => `${v.patente} ${v.descripcion}`} />
      </div>
      <div>
        <h3 className="mb-2 text-[14px] font-semibold">Choferes</h3>
        <DataTable rows={db.choferes} columns={colC} getRowId={(c) => c.id} onRowClick={(c) => setCho(c.id)} empty={db.choferes.length ? { icono: UserRound, titulo: "No hay choferes para la búsqueda" } : { icono: UserRound, titulo: "Todavía no hay choferes", descripcion: "Cada vehículo puede tener un chofer habitual, que se propone al armar la hoja de ruta.", accion: puede ? <Button size="sm" onClick={() => setCho("nuevo")}><Plus /> Nuevo chofer</Button> : undefined }} actions={puede && <Button size="sm" onClick={() => setCho("nuevo")}><Plus /> Nuevo chofer</Button>} searchText={(c) => c.nombre} />
      </div>
      {veh && <VehiculoSheet id={veh} onClose={() => setVeh(null)} onAbrirDespacho={onAbrirDespacho} />}
      {cho && <ChoferSheet id={cho} onClose={() => setCho(null)} />}
    </div>
  );
}

function VehiculoSheet({ id, onClose, onAbrirDespacho }: { id: string; onClose: () => void; onAbrirDespacho: (id: string) => void }) {
  const db = useDb();
  const puede = usePuede("vehiculos.editar");
  const v = id === "nuevo" ? undefined : db.vehiculos.find((x) => x.id === id);
  const [f, setF] = React.useState({ patente: v?.patente ?? "", descripcion: v?.descripcion ?? "", capacidadKg: v?.capacidadKg ?? 3500, choferId: v?.choferId ?? "", activo: v?.activo ?? true });
  const historial = v ? db.despachos.filter((d) => d.vehiculoId === v.id).sort((a, b) => b.fechaProgramada.localeCompare(a.fechaProgramada)) : [];
  const guardar = () => {
    const r = useStore.getState().guardarVehiculo({ ...f, patente: f.patente.toUpperCase(), choferId: f.choferId || undefined }, v?.id);
    if (r.ok) {
      toast.success(v ? "Vehículo actualizado" : "Vehículo creado");
      if (!v) onClose();
    } else toast.error(r.error);
  };
  const form = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Patente" required htmlFor="vh-p"><Input id="vh-p" disabled={!puede} value={f.patente} onChange={(e) => setF({ ...f, patente: e.target.value })} placeholder="AE 412 KD" /></FormField>
        <FormField label="Capacidad (kg)" htmlFor="vh-c"><NumberInput id="vh-c" disabled={!puede} value={f.capacidadKg} min={0} onValueChange={(x) => setF({ ...f, capacidadKg: x })} /></FormField>
        <FormField label="Descripción" htmlFor="vh-d" className="sm:col-span-2"><Input id="vh-d" disabled={!puede} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></FormField>
        <FormField label="Chofer habitual">
          <div className="flex items-center gap-1">
            <SelectorChofer className="min-w-0 flex-1" disabled={!puede} value={f.choferId} placeholder="Sin chofer habitual" onChange={(x) => setF((prev) => ({ ...prev, choferId: x }))} />
            {f.choferId && puede && <Button variant="ghost" size="icon-sm" aria-label="Quitar chofer habitual" onClick={() => setF((prev) => ({ ...prev, choferId: "" }))}><X /></Button>}
          </div>
        </FormField>
      </div>
      <label className="flex items-center gap-3 text-[13px]"><Switch disabled={!puede} checked={f.activo} onCheckedChange={(x) => setF({ ...f, activo: x })} /> Vehículo activo</label>
      {puede && <div className="flex justify-end"><Button onClick={guardar}><Save /> Guardar</Button></div>}
    </div>
  );
  return (
    <EntitySheet
      open
      onOpenChange={(o) => !o && onClose()}
      titulo={v ? `${v.patente} · ${v.descripcion}` : "Nuevo vehículo"}
      width={640}
      tabs={
        v
          ? [
              { value: "datos", label: "Datos", content: form },
              {
                value: "hist",
                label: `Historial (${historial.length})`,
                content: (
                  <ul className="divide-y divide-border rounded-card border border-border">
                    {historial.map((d) => (
                      <li key={d.id}>
                        <button onClick={() => onAbrirDespacho(d.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-subtle">
                          <span className="font-mono text-[12px]">{d.numero}</span>
                          <span className="flex-1 truncate text-muted">{formatDate(d.fechaProgramada)} · {db.clientes.find((c) => c.id === d.clienteId)?.razonSocial} · {formatNumber(pesoDespacho(d, db.productos), 0)} kg</span>
                          <StatusBadge tipo="DESPACHO" estado={d.estado} />
                        </button>
                      </li>
                    ))}
                    {!historial.length && <li className="px-3 py-6 text-center text-[13px] text-muted">Sin despachos.</li>}
                  </ul>
                ),
              },
            ]
          : [{ value: "datos", label: "Datos", content: form }]
      }
    />
  );
}

function ChoferSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const db = useDb();
  const puede = usePuede("vehiculos.editar");
  const c = id === "nuevo" ? undefined : db.choferes.find((x) => x.id === id);
  const [f, setF] = React.useState({ nombre: c?.nombre ?? "", telefono: c?.telefono ?? "", activo: c?.activo ?? true });
  return (
    <EntitySheet open onOpenChange={(o) => !o && onClose()} titulo={c?.nombre ?? "Nuevo chofer"} width={480}>
      <div className="space-y-4">
        <FormField label="Nombre" required htmlFor="ch-n"><Input id="ch-n" disabled={!puede} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></FormField>
        <FormField label="Teléfono" htmlFor="ch-t"><Input id="ch-t" disabled={!puede} value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></FormField>
        <label className="flex items-center gap-3 text-[13px]"><Switch disabled={!puede} checked={f.activo} onCheckedChange={(x) => setF({ ...f, activo: x })} /> Chofer activo</label>
        {puede && (
          <div className="flex justify-end">
            <Button
              onClick={() => {
                const r = useStore.getState().guardarChofer(f, c?.id);
                if (r.ok) {
                  toast.success(c ? "Chofer actualizado" : "Chofer creado");
                  onClose();
                } else toast.error(r.error);
              }}
            >
              <Save /> Guardar
            </Button>
          </div>
        )}
      </div>
    </EntitySheet>
  );
}
