"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Ban, CalendarClock, ClipboardList, PackageCheck, Printer, Store, Truck } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePosiciones, usePuede } from "@/store/selectors";
import type { Despacho } from "@/domain/types";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline, type EventoTimeline } from "@/components/shared/timeline";
import { PrintPreview } from "@/components/shared/print-layout";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NumberInput } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, formatDateTime, formatNumber, formatQty, unidadCorta } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { nombreUsuario } from "@/lib/referencias";
import { cn } from "@/lib/utils";
import { OrdenPreparacionDocumento, RemitoDocumento, origenLabel, pesoDespacho } from "./documentos";

const esMostrador = (d: Despacho) => d.direccionEntrega === "Retira en mostrador";

/** Ficha de despacho: datos de entrega, ítems con stock, asignación y acciones por estado. */
export function DespachoSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const db = useDb();
  const posiciones = usePosiciones();
  const puede = usePuede("despachos.operar");
  const { confirmar, dialog } = useConfirm();
  const [imprimir, setImprimir] = React.useState<"remito" | "preparacion" | null>(null);
  const [entregar, setEntregar] = React.useState(false);
  const [reprogramar, setReprogramar] = React.useState(false);
  const [mostrador, setMostrador] = React.useState(false);
  const d = id ? db.despachos.find((x) => x.id === id) : undefined;
  if (!d) return null;
  const s = useStore.getState();
  const cliente = db.clientes.find((c) => c.id === d.clienteId);
  const origen = origenLabel(db, d);
  const peso = pesoDespacho(d, db.productos);
  const veh = db.vehiculos.find((v) => v.id === d.vehiculoId);
  const run = (r: { ok: boolean; error?: string }, msg: string) => (r.ok ? toast.success(msg) : toast.error(r.error));

  const eventos: EventoTimeline[] = [{ id: "c", fecha: d.creadoEn, accion: `Remito ${d.numero} generado`, detalle: `Origen ${origen.label}` }];
  if (d.fechaSalida && !esMostrador(d)) eventos.push({ id: "s", fecha: d.fechaSalida, accion: "Salió en viaje", detalle: veh ? `${veh.patente} · ${db.choferes.find((c) => c.id === d.choferId)?.nombre ?? ""}` : undefined });
  if (d.fechaEntrega) eventos.push({ id: "e", fecha: d.fechaEntrega, accion: d.estado === "RETIRADO_EN_MOSTRADOR" ? "Retirado en mostrador" : "Entregado", detalle: d.firmaRecibido ? `Recibió: ${d.firmaRecibido}` : undefined, destacado: true });
  for (const a of db.auditoria.filter((x) => x.entidadId === d.id)) eventos.push({ id: a.id, fecha: a.fecha, accion: a.accion, detalle: a.detalle, usuario: nombreUsuario(db, a.usuarioId) });

  const abierto = d.estado === "PENDIENTE" || d.estado === "EN_PREPARACION";

  return (
    <>
      <EntitySheet
        open
        onOpenChange={(v) => !v && onClose()}
        width={640}
        titulo={`Remito ${d.numero}`}
        estado={<StatusBadge tipo="DESPACHO" estado={d.estado} />}
        subtitulo={
          <>
            {cliente?.razonSocial} · <Link href={origen.href} className="underline-offset-2 hover:underline">{origen.label}</Link> · programado {formatDate(d.fechaProgramada)}
            {!!d.reprogramaciones && <Badge variant="warning" className="ml-2">Reprogramado {d.reprogramaciones}×</Badge>}
          </>
        }
        acciones={
          <>
            {puede && d.estado === "PENDIENTE" && !esMostrador(d) && (
              <Button size="sm" onClick={() => { const r = s.prepararDespacho(d.id); if (r.ok) { toast.success("En preparación: imprimí la orden para el depósito"); setImprimir("preparacion"); } else toast.error(r.error); }}>
                <ClipboardList /> Preparar
              </Button>
            )}
            {puede && abierto && esMostrador(d) && (
              <Button size="sm" onClick={() => setMostrador(true)}>
                <Store /> Entregar en mostrador
              </Button>
            )}
            {puede && d.estado === "EN_PREPARACION" && (
              <Button size="sm" disabled={!d.vehiculoId || !d.choferId} onClick={() => { const r = s.despacharDespacho(d.id); if (r.ok) { toast.success("Despacho en viaje: stock descontado del depósito"); setImprimir("remito"); } else toast.error(r.error); }}>
                <Truck /> Despachar
              </Button>
            )}
            {puede && d.estado === "EN_VIAJE" && (
              <Button size="sm" onClick={() => setEntregar(true)}>
                <PackageCheck /> Marcar entregado
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setImprimir("remito")}><Printer /> Remito</Button>
            {abierto && <Button size="sm" variant="ghost" onClick={() => setImprimir("preparacion")}><ClipboardList /> Orden de preparación</Button>}
            {puede && abierto && <Button size="sm" variant="ghost" onClick={() => setReprogramar(true)}><CalendarClock /> Reprogramar</Button>}
            {puede && abierto && (
              <Button size="sm" variant="ghost" onClick={() => confirmar({ titulo: `Cancelar ${d.numero}`, descripcion: `Los ítems vuelven al ${d.origenTipo === "PEDIDO" ? "pedido" : "acopio"} como pendientes.`, confirmLabel: "Cancelar despacho", variant: "danger", onConfirm: () => { run(s.cancelarDespacho(d.id), "Despacho cancelado"); } })}>
                <Ban /> Cancelar
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-5">
          <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-[13px]">
            <dt className="text-muted">Entrega</dt>
            <dd>{d.direccionEntrega}{d.localidad && !esMostrador(d) ? ` · ${d.localidad}` : ""}</dd>
            <dt className="text-muted">Contacto</dt>
            <dd>{cliente?.telefono}</dd>
            <dt className="text-muted">Depósito</dt>
            <dd>{db.depositos.find((x) => x.id === d.depositoId)?.nombre}</dd>
            <dt className="text-muted">Peso estimado</dt>
            <dd className="tnum">{formatNumber(peso, 0)} kg{veh && <span className={cn("ml-2 text-[12px]", peso > veh.capacidadKg ? "text-danger" : "text-muted")}>({Math.round((peso / veh.capacidadKg) * 100)} % de la capacidad)</span>}</dd>
            {d.fechaSalida && (<><dt className="text-muted">Salida</dt><dd>{formatDateTime(d.fechaSalida)}</dd></>)}
            {d.fechaEntrega && (<><dt className="text-muted">Entrega</dt><dd>{formatDateTime(d.fechaEntrega)} · {d.firmaRecibido}</dd></>)}
            {d.observaciones && (<><dt className="text-muted">Observaciones</dt><dd>{d.observaciones}</dd></>)}
          </dl>

          {!esMostrador(d) && (
            <div className="grid gap-3 rounded-card border border-border p-3 sm:grid-cols-2">
              <FormField label="Vehículo">
                <Select
                  size="sm"
                  disabled={!puede || !abierto}
                  value={d.vehiculoId ?? ""}
                  onValueChange={(v) => {
                    const ve = db.vehiculos.find((x) => x.id === v);
                    run(s.asignarVehiculo(d.id, v, ve?.choferId ?? d.choferId ?? ""), "Vehículo asignado");
                  }}
                  options={[{ value: "", label: "Sin asignar" }, ...db.vehiculos.filter((v) => v.activo).map((v) => ({ value: v.id, label: `${v.patente} · ${formatNumber(v.capacidadKg, 0)} kg` }))]}
                />
              </FormField>
              <FormField label="Chofer">
                <Select size="sm" disabled={!puede || !abierto} value={d.choferId ?? ""} onValueChange={(v) => run(s.asignarVehiculo(d.id, d.vehiculoId ?? "", v), "Chofer asignado")} options={[{ value: "", label: "Sin asignar" }, ...db.choferes.filter((c) => c.activo).map((c) => ({ value: c.id, label: c.nombre }))]} />
              </FormField>
              {d.estado === "EN_PREPARACION" && (!d.vehiculoId || !d.choferId) && <p className="text-[12px] text-warning sm:col-span-2">Asigná vehículo y chofer para poder despachar.</p>}
            </div>
          )}

          <table className="w-full text-table">
            <thead>
              <tr className="border-b border-border text-[12px] text-muted">
                <th className="py-2 text-left font-medium">Producto</th>
                <th className="py-2 text-right font-medium">Cantidad</th>
                {abierto && <th className="py-2 text-right font-medium">Físico en depósito</th>}
                {d.estado === "ENTREGADO" && <th className="py-2 text-right font-medium">Entregado</th>}
              </tr>
            </thead>
            <tbody>
              {d.items.map((i, k) => {
                const p = db.productos.find((x) => x.id === i.productoId)!;
                const fis = posiciones.get(p.id)?.porDeposito[d.depositoId]?.fisico ?? 0;
                return (
                  <tr key={k} className="border-b border-border">
                    <td className="py-2"><span className="mr-2 whitespace-nowrap font-mono text-[11px] text-muted">{p.codigo}</span>{p.nombre}</td>
                    <td className="py-2 text-right tnum">{formatQty(i.cantidad, p.unidad)}</td>
                    {abierto && <td className={cn("py-2 text-right tnum", fis < i.cantidad ? "font-medium text-danger" : "text-muted")}>{formatQty(fis, p.unidad)}</td>}
                    {d.estado === "ENTREGADO" && <td className={cn("py-2 text-right tnum", (i.cantidadEntregada ?? i.cantidad) < i.cantidad && "text-warning")}>{formatQty(i.cantidadEntregada ?? i.cantidad, p.unidad)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div>
            <h4 className="mb-2 text-[13px] font-semibold">Historial</h4>
            <Timeline eventos={eventos} />
          </div>
        </div>
      </EntitySheet>

      <PrintPreview open={!!imprimir} onOpenChange={(v) => !v && setImprimir(null)} titulo={imprimir === "remito" ? `Remito ${d.numero}` : `Orden de preparación ${d.numero}`}>
        {imprimir === "remito" ? <RemitoDocumento despacho={d} /> : <OrdenPreparacionDocumento despacho={d} />}
      </PrintPreview>
      <EntregaDialog despacho={d} open={entregar} onOpenChange={setEntregar} />
      <ReprogramarDialog despacho={d} open={reprogramar} onOpenChange={setReprogramar} />
      <MostradorDialog despacho={d} open={mostrador} onOpenChange={setMostrador} />
      {dialog}
    </>
  );
}

/** Marcar entregado (total o parcial). */
export function EntregaDialog({ despacho: d, open, onOpenChange }: { despacho: Despacho; open: boolean; onOpenChange: (v: boolean) => void }) {
  const db = useDb();
  const [fecha, setFecha] = React.useState("");
  const [hora, setHora] = React.useState("");
  const [recibio, setRecibio] = React.useState("");
  const [obs, setObs] = React.useState("");
  const [parcial, setParcial] = React.useState(false);
  const [cant, setCant] = React.useState<number[]>([]);
  React.useEffect(() => {
    if (!open) return;
    const n = new Date();
    setFecha(diaLocal(n));
    setHora(`${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`);
    setRecibio("");
    setObs("");
    setParcial(false);
    setCant(d.items.map((i) => i.cantidad));
  }, [open, d.items]);
  const confirmar = () => {
    const [y, m, dd] = fecha.split("-").map(Number);
    const [hh, mm] = hora.split(":").map(Number);
    const r = useStore.getState().marcarEntregado(d.id, { fecha: new Date(y, m - 1, dd, hh, mm).toISOString(), recibio, observaciones: obs || undefined, cantidades: parcial ? cant : undefined });
    if (!r.ok) return toast.error(r.error);
    toast.success(r.data ? "Entrega parcial registrada" : "Despacho entregado", { description: r.data ? "El resto volvió al depósito y se creó un nuevo despacho pendiente." : "Se actualizó el estado del pedido / acopio." });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title={`Marcar entregado · ${d.numero}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={confirmar} disabled={!recibio.trim()}><PackageCheck /> Confirmar entrega</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Fecha" htmlFor="e-f"><Input id="e-f" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></FormField>
            <FormField label="Hora" htmlFor="e-h"><Input id="e-h" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></FormField>
            <FormField label="Recibió (nombre)" required htmlFor="e-r"><Input id="e-r" value={recibio} onChange={(e) => setRecibio(e.target.value)} placeholder="Ej. Capataz de obra" autoFocus /></FormField>
          </div>
          <FormField label="Observaciones" htmlFor="e-o"><Input id="e-o" value={obs} onChange={(e) => setObs(e.target.value)} /></FormField>
          <label className="flex items-center gap-2 text-[13px]">
            <Checkbox checked={parcial} onCheckedChange={(v) => setParcial(!!v)} /> Entrega parcial (no entró todo / el cliente rechazó parte)
          </label>
          {parcial && (
            <div className="rounded-card border border-border">
              {d.items.map((i, k) => {
                const p = db.productos.find((x) => x.id === i.productoId)!;
                return (
                  <div key={k} className="flex items-center gap-3 border-b border-border px-3 py-2 text-[13px] last:border-b-0">
                    <span className="flex-1">{p.nombre} <span className="text-muted">· salió {formatQty(i.cantidad, p.unidad)}</span></span>
                    <span className="text-[12px] text-muted">Entregado</span>
                    <NumberInput aria-label={`Entregado de ${p.nombre}`} value={cant[k] ?? 0} min={0} className="h-8 w-28" onValueChange={(v) => setCant((c) => c.map((x, j) => (j === k ? Math.min(v, i.cantidad) : x)))} />
                    <span className="w-8 text-[11px] text-muted">{unidadCorta(p.unidad)}</span>
                  </div>
                );
              })}
              <p className="border-t border-border bg-subtle px-3 py-2 text-[12px] text-muted">Lo no entregado reingresa al depósito y se genera automáticamente un nuevo despacho pendiente para mañana.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReprogramarDialog({ despacho: d, open, onOpenChange }: { despacho: Despacho; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [fecha, setFecha] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setFecha(diaLocal(new Date(Date.now() + 86_400_000)));
      setMotivo("");
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        title={`Reprogramar ${d.numero}`}
        description={`Programado para el ${formatDate(d.fechaProgramada)}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                const [y, m, dd] = fecha.split("-").map(Number);
                const r = useStore.getState().reprogramarDespacho(d.id, new Date(y, m - 1, dd, 12).toISOString(), motivo || undefined);
                if (r.ok) {
                  toast.success(`Reprogramado para el ${formatDate(new Date(y, m - 1, dd))}`);
                  onOpenChange(false);
                } else toast.error(r.error);
              }}
            >
              Reprogramar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Nueva fecha" htmlFor="rp-f"><Input id="rp-f" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></FormField>
          <FormField label="Motivo" htmlFor="rp-m"><Input id="rp-m" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Lluvia, obra sin acceso" /></FormField>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MostradorDialog({ despacho: d, open, onOpenChange }: { despacho: Despacho; open: boolean; onOpenChange: (v: boolean) => void }) {
  const db = useDb();
  const [recibio, setRecibio] = React.useState("");
  React.useEffect(() => {
    if (open) setRecibio(db.clientes.find((c) => c.id === d.clienteId)?.razonSocial ?? "");
  }, [open, d.clienteId, db.clientes]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        title={`Entregar en mostrador · ${d.numero}`}
        description="Se descuenta el stock del depósito en este momento."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              disabled={!recibio.trim()}
              onClick={() => {
                const r = useStore.getState().entregarEnMostrador(d.id, recibio);
                if (r.ok) {
                  toast.success("Retirado en mostrador");
                  onOpenChange(false);
                } else toast.error(r.error);
              }}
            >
              <Store /> Confirmar retiro
            </Button>
          </>
        }
      >
        <FormField label="Retiró (nombre y DNI)" htmlFor="m-r"><Input id="m-r" value={recibio} onChange={(e) => setRecibio(e.target.value)} /></FormField>
      </DialogContent>
    </Dialog>
  );
}
