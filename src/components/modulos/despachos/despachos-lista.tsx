"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Plus, Truck } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useSucursalActiva } from "@/store/selectors";
import type { Despacho } from "@/domain/types";
import { ESTADOS } from "@/domain/estados";
import { pendienteItem } from "@/domain/acopios";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Combobox } from "@/components/shared/combobox";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { NumberInput, Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { formatDate, formatNumber, formatQty } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { RetiroDialog } from "@/components/modulos/acopios/acopio-detalle";
import { origenLabel, pesoDespacho } from "./documentos";

const ABIERTOS = new Set(["PENDIENTE", "EN_PREPARACION"]);

export function DespachosLista({ fechaFiltro, onAbrir }: { fechaFiltro?: string | null; onAbrir: (id: string) => void }) {
  const db = useDb();
  const sucursalId = useSucursalActiva();
  const puede = usePuede("despachos.operar");
  const puedeVentas = usePuede("ventas.editar");
  const [vista, setVista] = React.useState<"agrupada" | "tabla">("agrupada");
  const [estado, setEstado] = React.useState("");
  const [deposito, setDeposito] = React.useState("");
  const [vehiculo, setVehiculo] = React.useState("");
  const [modalidad, setModalidad] = React.useState("");
  const [soloHoy, setSoloHoy] = React.useState(fechaFiltro === "hoy");
  const [nuevo, setNuevo] = React.useState(false);
  React.useEffect(() => setSoloHoy(fechaFiltro === "hoy"), [fechaFiltro]);

  const hoy = diaLocal(new Date());
  const manana = diaLocal(new Date(Date.now() + 86_400_000));
  const base = db.despachos.filter((d) => !sucursalId || d.sucursalId === sucursalId);
  const filtrados = base.filter(
    (d) =>
      (!estado || d.estado === estado) &&
      (!deposito || d.depositoId === deposito) &&
      (!vehiculo || d.vehiculoId === vehiculo) &&
      (!modalidad || (modalidad === "RETIRA") === (d.direccionEntrega === "Retira en mostrador")) &&
      (!soloHoy || diaLocal(d.fechaProgramada) === hoy || (ABIERTOS.has(d.estado) && diaLocal(d.fechaProgramada) < hoy)),
  );
  const cli = (id: string) => db.clientes.find((c) => c.id === id);

  const pendHoy = base.filter((d) => ABIERTOS.has(d.estado) && diaLocal(d.fechaProgramada) <= hoy).length;
  const enViaje = base.filter((d) => d.estado === "EN_VIAJE").length;
  const entregadosHoy = base.filter((d) => (d.estado === "ENTREGADO" || d.estado === "RETIRADO_EN_MOSTRADOR") && d.fechaEntrega && diaLocal(d.fechaEntrega) === hoy).length;
  const sinVehiculo = base.filter((d) => ABIERTOS.has(d.estado) && !d.vehiculoId && d.direccionEntrega !== "Retira en mostrador").length;

  const grupos = [
    { titulo: "Atrasados", tono: "danger", items: filtrados.filter((d) => ABIERTOS.has(d.estado) && diaLocal(d.fechaProgramada) < hoy) },
    { titulo: "Hoy", tono: "accent", items: filtrados.filter((d) => diaLocal(d.fechaProgramada) === hoy && d.estado !== "CANCELADO") },
    { titulo: "Mañana", tono: "neutral", items: filtrados.filter((d) => diaLocal(d.fechaProgramada) === manana && d.estado !== "CANCELADO") },
    { titulo: "Próximos", tono: "neutral", items: filtrados.filter((d) => diaLocal(d.fechaProgramada) > manana && d.estado !== "CANCELADO") },
  ];

  const columnas: Column<Despacho>[] = [
    { key: "numero", header: "Remito", sortable: true, sortValue: (d) => d.numero, cell: (d) => <span className="whitespace-nowrap font-mono text-[12px]">{d.numero}</span> },
    { key: "cliente", header: "Cliente", sortable: true, sortValue: (d) => cli(d.clienteId)?.razonSocial ?? "", cell: (d) => <span className="block min-w-[150px]">{cli(d.clienteId)?.nombreFantasia ?? cli(d.clienteId)?.razonSocial}</span> },
    { key: "dir", header: "Dirección", hideOnMobile: true, cell: (d) => <span className="block max-w-[220px] truncate text-muted">{d.direccionEntrega}{d.localidad && d.direccionEntrega !== "Retira en mostrador" ? ` · ${d.localidad}` : ""}</span> },
    { key: "origen", header: "Origen", cell: (d) => { const o = origenLabel(db, d); return <Link href={o.href} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap font-mono text-[12px] hover:underline">{o.label}</Link>; } },
    { key: "fecha", header: "Programado", sortable: true, sortValue: (d) => d.fechaProgramada, cell: (d) => <span className={cn("whitespace-nowrap", ABIERTOS.has(d.estado) && diaLocal(d.fechaProgramada) < hoy ? "font-medium text-danger" : "text-muted")}>{formatDate(d.fechaProgramada)}</span> },
    { key: "items", header: "Carga", align: "right", hideOnMobile: true, cell: (d) => <span className="text-muted tnum">{d.items.length} ítems · {formatNumber(pesoDespacho(d, db.productos), 0)} kg</span> },
    { key: "estado", header: "Estado", sortable: true, sortValue: (d) => d.estado, cell: (d) => <StatusBadge tipo="DESPACHO" estado={d.estado} /> },
    { key: "veh", header: "Vehículo", hideOnMobile: true, cell: (d) => (d.direccionEntrega === "Retira en mostrador" ? <span className="text-muted">Mostrador</span> : d.vehiculoId ? <span className="whitespace-nowrap">{db.vehiculos.find((v) => v.id === d.vehiculoId)?.patente} <span className="text-muted">· {db.choferes.find((c) => c.id === d.choferId)?.nombre.split(" ")[0]}</span></span> : <span className="text-warning">Sin asignar</span>) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Pendientes hoy" valor={String(pendHoy)} acento subtexto="incluye atrasados" />
        <KpiCard label="En viaje" valor={String(enViaje)} />
        <KpiCard label="Entregados hoy" valor={String(entregadosHoy)} />
        <KpiCard label="Sin vehículo asignado" valor={String(sinVehiculo)} subtexto={sinVehiculo ? <span className="text-warning">asignalos en la hoja de ruta</span> : "todo asignado"} />
      </div>

      <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={vista} onChange={setVista} options={[{ value: "agrupada", label: "Por fecha" }, { value: "tabla", label: "Tabla" }]} />
          <Button size="sm" variant={soloHoy ? "primary" : "secondary"} onClick={() => setSoloHoy(!soloHoy)}><CalendarDays /> Hoy</Button>
          <Select size="sm" className="w-[150px]" aria-label="Estado" value={estado} onValueChange={setEstado} options={[{ value: "", label: "Todos los estados" }, ...Object.keys(ESTADOS).filter((k) => k.startsWith("DESPACHO.")).map((k) => ({ value: k.slice(9), label: ESTADOS[k].label }))]} />
          <Select size="sm" className="w-[150px]" aria-label="Depósito" value={deposito} onValueChange={setDeposito} options={[{ value: "", label: "Todos los depósitos" }, ...db.depositos.map((d) => ({ value: d.id, label: d.nombre }))]} />
          <Select size="sm" className="w-[140px]" aria-label="Vehículo" value={vehiculo} onValueChange={setVehiculo} options={[{ value: "", label: "Todos los vehículos" }, ...db.vehiculos.map((v) => ({ value: v.id, label: v.patente }))]} />
          <Select size="sm" className="w-[130px]" aria-label="Modalidad" value={modalidad} onValueChange={setModalidad} options={[{ value: "", label: "Envío y retira" }, { value: "ENVIO", label: "Envío" }, { value: "RETIRA", label: "Mostrador" }]} />
        </div>
        {(puede || puedeVentas) && <Button size="sm" onClick={() => setNuevo(true)}><Plus /> Nuevo despacho</Button>}
      </div>

      {vista === "tabla" ? (
        <DataTable rows={filtrados} columns={columnas} getRowId={(d) => d.id} searchText={(d) => `${d.numero} ${cli(d.clienteId)?.razonSocial} ${d.direccionEntrega}`} searchPlaceholder="Remito, cliente o dirección" onRowClick={(d) => onAbrir(d.id)} initialSort={{ key: "fecha", dir: "desc" }} empty={{ icono: Truck, titulo: "Sin despachos" }} />
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <Card key={g.titulo}>
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <h3 className={cn("text-[14px] font-semibold", g.tono === "danger" && g.items.length > 0 && "text-danger")}>{g.titulo}</h3>
                <span className="text-[12px] text-muted tnum">{g.items.length} remitos</span>
              </div>
              {g.items.length === 0 ? (
                <p className="px-4 py-5 text-center text-[13px] text-muted">Sin despachos.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {g.items
                    .sort((a, b) => a.fechaProgramada.localeCompare(b.fechaProgramada))
                    .map((d) => {
                      const o = origenLabel(db, d);
                      const c = cli(d.clienteId);
                      return (
                        <li key={d.id}>
                          <button onClick={() => onAbrir(d.id)} className="grid w-full grid-cols-[80px_1fr_auto] items-center gap-3 px-4 py-2.5 text-left text-[13px] hover:bg-[#FAFAF8] md:grid-cols-[80px_1.3fr_1.5fr_110px_150px_130px]">
                            <span className="font-mono text-[12px]">{d.numero}</span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{c?.nombreFantasia ?? c?.razonSocial}</span>
                              <span className="block truncate text-[11px] text-muted md:hidden">{d.direccionEntrega}</span>
                            </span>
                            <span className="hidden min-w-0 truncate text-muted md:block">{d.direccionEntrega}{d.localidad && d.direccionEntrega !== "Retira en mostrador" ? ` · ${d.localidad}` : ""}</span>
                            <span className="hidden font-mono text-[12px] text-muted md:block">{o.label}</span>
                            <span className="hidden text-[12px] text-muted md:block">
                              {d.items.length} ítems · {formatNumber(pesoDespacho(d, db.productos), 0)} kg
                              <span className="block">{d.direccionEntrega === "Retira en mostrador" ? "Mostrador" : d.vehiculoId ? db.vehiculos.find((v) => v.id === d.vehiculoId)?.patente : <span className="text-warning">Sin vehículo</span>}</span>
                            </span>
                            <span className="justify-self-end"><StatusBadge tipo="DESPACHO" estado={d.estado} /></span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              )}
            </Card>
          ))}
          {!filtrados.length && <Card><EmptyState icono={Truck} titulo="No hay despachos con estos filtros" /></Card>}
        </div>
      )}
      <NuevoDespachoDialog open={nuevo} onOpenChange={setNuevo} onCreado={onAbrir} />
    </div>
  );
}

/** "Nuevo despacho": desde un pedido con saldo a despachar o un acopio con saldo. */
function NuevoDespachoDialog({ open, onOpenChange, onCreado }: { open: boolean; onOpenChange: (v: boolean) => void; onCreado: (id: string) => void }) {
  const db = useDb();
  const router = useRouter();
  const [origen, setOrigen] = React.useState("");
  const [cant, setCant] = React.useState<Record<string, number>>({});
  const [fecha, setFecha] = React.useState(diaLocal(new Date()));
  const [acopioRetiro, setAcopioRetiro] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setOrigen("");
      setCant({});
      setFecha(diaLocal(new Date()));
    }
  }, [open]);
  const pendientes = useStore.getState().pendientesDePedido;
  const pedidos = db.pedidos.filter((p) => !["BORRADOR", "CANCELADO"].includes(p.estado) && pendientes(p.id).some((x) => x.pendiente > 0));
  const acopios = db.acopios.filter((a) => ["VIGENTE", "RETIRADO_PARCIAL", "VENCIDO"].includes(a.estado) && a.items.some((i) => pendienteItem(i) > 0));
  const cli = (id: string) => db.clientes.find((c) => c.id === id);
  const esPedido = origen.startsWith("ped");
  const lineas = esPedido ? pendientes(origen).filter((x) => x.pendiente > 0) : [];
  React.useEffect(() => {
    if (esPedido) setCant(Object.fromEntries(pendientes(origen).filter((x) => x.pendiente > 0).map((x) => [x.item.id, x.pendiente])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origen]);
  const acopio = acopioRetiro ? db.acopios.find((a) => a.id === acopioRetiro) : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          size="lg"
          title="Nuevo despacho"
          description="Elegí un pedido con mercadería pendiente o un acopio con saldo."
          footer={
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                disabled={!origen}
                onClick={() => {
                  if (!esPedido) {
                    onOpenChange(false);
                    setAcopioRetiro(origen);
                    return;
                  }
                  const [y, m, d] = fecha.split("-").map(Number);
                  const r = useStore.getState().generarDespachoPedido(origen, { items: Object.entries(cant).map(([itemId, cantidad]) => ({ itemId, cantidad })), fechaProgramada: new Date(y, m - 1, d, 12).toISOString() });
                  if (r.ok) {
                    toast.success(`Despacho ${r.data.numero} creado`);
                    onOpenChange(false);
                    onCreado(r.data.despachoId);
                  } else toast.error(r.error);
                }}
              >
                {esPedido || !origen ? "Crear despacho" : "Continuar con el retiro"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <FormField label="Origen">
              <Combobox
                aria-label="Pedido o acopio"
                value={origen}
                onChange={setOrigen}
                placeholder="Buscar pedido o acopio…"
                opciones={[
                  ...pedidos.map((p) => ({ value: p.id, label: `${p.numero} · ${cli(p.clienteId)?.razonSocial}`, detalle: "Pedido" })),
                  ...acopios.map((a) => ({ value: a.id, label: `${a.numero} · ${cli(a.clienteId)?.razonSocial}`, detalle: "Acopio" })),
                ]}
              />
            </FormField>
            {esPedido && (
              <>
                <div className="rounded-card border border-border">
                  {lineas.map(({ item, pendiente }) => {
                    const p = db.productos.find((x) => x.id === item.productoId)!;
                    return (
                      <div key={item.id} className="flex items-center gap-3 border-b border-border px-3 py-2 text-[13px] last:border-b-0">
                        <span className="flex-1">{p.nombre} <span className="text-muted">· pendiente {formatQty(pendiente, p.unidad)}</span></span>
                        <NumberInput aria-label={`Cantidad de ${p.nombre}`} value={cant[item.id] ?? 0} min={0} className="h-8 w-28" onValueChange={(v) => setCant((c) => ({ ...c, [item.id]: Math.min(v, pendiente) }))} />
                      </div>
                    );
                  })}
                </div>
                <FormField label="Fecha programada" htmlFor="nd-f" className="max-w-[220px]">
                  <Input id="nd-f" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </FormField>
              </>
            )}
            {origen && !esPedido && <p className="text-[13px] text-muted">Para acopios se registra un retiro: elegí productos, cantidades y modalidad en el siguiente paso.</p>}
          </div>
        </DialogContent>
      </Dialog>
      {acopio && <RetiroDialog acopio={acopio} abierto={acopioRetiro ? {} : null} onClose={() => setAcopioRetiro(null)} onHecho={() => router.refresh()} />}
    </>
  );
}

