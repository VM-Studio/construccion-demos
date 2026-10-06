"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Ban, CalendarPlus, PackageMinus, Plus, Printer, Repeat, Wallet } from "lucide-react";
import { useStore } from "@/store";
import { useAcopiosConSaldo, useDb, usePosiciones, usePuede } from "@/store/selectors";
import type { Acopio } from "@/domain/types";
import { pendienteItem } from "@/domain/acopios";
import { obtenerPrecio } from "@/domain/precios";
import { TIPO_COMPROBANTE_LABEL, MEDIO_PAGO_LABEL } from "@/domain/estados";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Timeline, type EventoTimeline } from "@/components/shared/timeline";
import { ItemsGrid, type LineaBase } from "@/components/shared/items-grid";
import { PrintLayout, PrintPreview, PrintTable } from "@/components/shared/print-layout";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Combobox } from "@/components/shared/combobox";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NumberInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatDateTime, formatMoney, formatPercent, formatQty, unidadCorta } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { nombreUsuario } from "@/lib/referencias";
import { cn, newId } from "@/lib/utils";
import { CobranzaDialog } from "@/components/modulos/cuentas/cobranza-dialog";

const deInput = (v: string, h = 12) => {
  const [y, m, d] = v.split("-").map(Number);
  const n = new Date();
  return new Date(y, m - 1, d, h === -1 ? n.getHours() : h, h === -1 ? n.getMinutes() : 0).toISOString();
};

export function AcopioDetalle({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const info = useAcopiosConSaldo().find((a) => a.acopio.id === id);
  const verMargen = usePuede("margenes.ver");
  const puedeEditar = usePuede("acopios.editar");
  const puedeAutorizar = usePuede("acopios.autorizar");
  const puedeCobrar = usePuede("ctacte.cobrar");
  const { confirmar, dialog } = useConfirm();
  const [retiro, setRetiro] = React.useState<{ itemId?: string } | null>(null);
  const [ampliar, setAmpliar] = React.useState(false);
  const [canje, setCanje] = React.useState(false);
  const [extender, setExtender] = React.useState(false);
  const [cobrar, setCobrar] = React.useState(false);
  const [imprimir, setImprimir] = React.useState(false);
  const [retiroImpreso, setRetiroImpreso] = React.useState<string | null>(null);

  if (!info)
    return (
      <div className="rounded-card border border-border bg-surface">
        <EmptyState titulo="El acopio no existe" accion={<Button onClick={() => router.push("/acopios")}>Volver a acopios</Button>} />
      </div>
    );
  const a = info.acopio;
  const cliente = db.clientes.find((c) => c.id === a.clienteId);
  const activo = ["VIGENTE", "RETIRADO_PARCIAL", "VENCIDO"].includes(info.estado);
  const comprobantes = db.comprobantes.filter((c) => (a.comprobanteIds ?? [a.comprobanteId]).includes(c.id) || (c.acopioId === a.id && c.tipo === "NOTA_CREDITO"));
  const saldoFacturas = comprobantes.filter((c) => c.tipo !== "NOTA_CREDITO").reduce((s, c) => s + Math.max(0, c.saldoPendiente), 0);

  return (
    <div>
      <Link href="/acopios" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Acopios
      </Link>
      <PageHeader
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            Acopio {a.numero} <StatusBadge tipo="ACOPIO" estado={info.estado} />
            {info.pagadoPct >= 0.999 ? <Badge variant="success">Pagado</Badge> : <Badge variant="warning">Pagado {formatPercent(info.pagadoPct, { decimals: 0 })}</Badge>}
          </span>
        }
        descripcion={
          <>
            <Link href={`/ventas?tab=clientes&cliente=${a.clienteId}`} className="hover:underline">{cliente?.razonSocial}</Link> · inicio {formatDate(a.fechaInicio)} ·{" "}
            <span className={cn(activo && info.diasParaVencer < 0 && "font-medium text-danger", activo && info.diasParaVencer >= 0 && info.diasParaVencer <= 15 && "font-medium text-warning")}>
              vence {formatDate(a.fechaVencimiento)}
              {activo && (info.diasParaVencer < 0 ? ` (venció hace ${-info.diasParaVencer} días)` : ` (en ${info.diasParaVencer} días)`)}
            </span>
          </>
        }
        acciones={
          <>
            <Button variant="secondary" onClick={() => setImprimir(true)}><Printer /> Estado de acopio</Button>
            {activo && puedeEditar && <Button onClick={() => setRetiro({})}><PackageMinus /> Registrar retiro</Button>}
          </>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Card className="p-4 md:col-span-2">
          <div className="flex justify-between text-[12px] text-muted">
            <span>Avance de retiros (en $ a precio pactado)</span>
            <span className="tnum">{formatPercent(info.retiradoPct, { decimals: 0 })}</span>
          </div>
          <Progress value={info.retiradoPct} tone="accent" className="mt-2 h-2" />
          <div className="mt-2 flex justify-between text-[12px] text-muted">
            <span>Total pactado {formatMoney(a.total, { decimals: false })} c/IVA</span>
            <span>Pagado {formatMoney(a.montoPagado, { decimals: false })}</span>
          </div>
        </Card>
        <Card className="border-t-2 border-t-accent p-4">
          <div className="text-[12px] text-muted">Deuda de mercadería</div>
          <div className="mt-1 text-[22px] font-semibold tnum">{formatMoney(info.deuda.aPrecioPactado, { decimals: false })}</div>
          <div className="text-[12px] text-muted">a precio pactado, sin IVA</div>
        </Card>
        {verMargen ? (
          <Card className="p-4">
            <div className="text-[12px] text-muted">Exposición por suba de costos</div>
            <div className={cn("mt-1 text-[22px] font-semibold tnum", info.deuda.exposicion > 0 ? "text-danger" : "text-success")}>{formatMoney(info.deuda.exposicion, { decimals: false })}</div>
            <div className="text-[12px] text-muted">margen actual {formatPercent(info.deuda.margenActualPct)}</div>
          </Card>
        ) : (
          <Card className="p-4">
            <div className="text-[12px] text-muted">Productos con saldo</div>
            <div className="mt-1 text-[22px] font-semibold tnum">{a.items.filter((i) => pendienteItem(i) > 0).length}</div>
          </Card>
        )}
      </div>

      {activo && (
        <div className="mb-4 flex flex-wrap gap-2">
          {puedeEditar && <Button size="sm" variant="secondary" onClick={() => setAmpliar(true)}><Plus /> Ampliar acopio</Button>}
          {puedeEditar && <Button size="sm" variant="secondary" onClick={() => setCanje(true)}><Repeat /> Canjear producto</Button>}
          {puedeCobrar && saldoFacturas > 0.009 && <Button size="sm" variant="secondary" onClick={() => setCobrar(true)}><Wallet /> Registrar cobro</Button>}
          {puedeAutorizar && <Button size="sm" variant="secondary" onClick={() => setExtender(true)}><CalendarPlus /> Extender vencimiento</Button>}
          {puedeAutorizar && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                confirmar({
                  titulo: `Cancelar saldo de ${a.numero}`,
                  descripcion: "Se libera el stock comprometido. Si el saldo no retirado estaba pagado, se genera una nota de crédito a favor del cliente.",
                  confirmLabel: "Cancelar saldo",
                  variant: "danger",
                  onConfirm: () => {
                    const r = useStore.getState().cancelarSaldoAcopio(a.id);
                    if (r.ok) toast.success("Saldo del acopio cancelado", { description: r.data ? "Se emitió la nota de crédito correspondiente." : undefined });
                    else toast.error(r.error);
                  },
                })
              }
            >
              <Ban /> Cancelar saldo
            </Button>
          )}
        </div>
      )}

      <Tabs defaultValue="saldo">
        <TabsList>
          <TabsTrigger value="saldo">Saldo por producto</TabsTrigger>
          <TabsTrigger value="retiros">Retiros</TabsTrigger>
          <TabsTrigger value="cobros">Cobros</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="saldo" className="pt-3">
          <SaldoPorProducto acopio={a} verMargen={verMargen} onRetirar={activo && puedeEditar ? (itemId) => setRetiro({ itemId }) : undefined} />
        </TabsContent>
        <TabsContent value="retiros" className="pt-3">
          <Retiros acopio={a} onImprimir={setRetiroImpreso} />
        </TabsContent>
        <TabsContent value="cobros" className="pt-3">
          <Card>
            <ul className="divide-y divide-border text-[13px]">
              {comprobantes.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>{TIPO_COMPROBANTE_LABEL[c.tipo]} <span className="font-mono text-[12px]">{c.numero}</span> <span className="text-muted">· {formatDate(c.fecha)}</span></span>
                  <span className="flex items-center gap-3"><span className="tnum">{formatMoney(c.tipo === "NOTA_CREDITO" ? -c.total : c.total)}</span><StatusBadge tipo="COMPROBANTE" estado={c.estado} /></span>
                </li>
              ))}
              {db.cobranzas
                .filter((cob) => cob.imputaciones.some((i) => comprobantes.some((c) => c.id === i.comprobanteId)))
                .map((cob) => (
                  <li key={cob.id} className="flex items-center justify-between gap-3 bg-[#FAFAF8] px-4 py-2.5">
                    <span className="text-muted">Recibo <span className="font-mono text-[12px] text-ink">{cob.numero}</span> · {formatDate(cob.fecha)} · {cob.medios.map((m) => MEDIO_PAGO_LABEL[m.medio]).join(", ")}</span>
                    <span className="font-medium text-success tnum">{formatMoney(cob.imputaciones.filter((i) => comprobantes.some((c) => c.id === i.comprobanteId)).reduce((s, i) => s + i.importe, 0))}</span>
                  </li>
                ))}
            </ul>
          </Card>
        </TabsContent>
        <TabsContent value="historial" className="pt-3">
          <Card><CardContent><Timeline eventos={eventosAcopio(db, a)} /></CardContent></Card>
        </TabsContent>
      </Tabs>

      <RetiroDialog acopio={a} abierto={retiro} onClose={() => setRetiro(null)} onHecho={(rid) => setRetiroImpreso(rid)} />
      <AmpliarDialog acopio={a} open={ampliar} onOpenChange={setAmpliar} />
      <CanjeDialog acopio={a} open={canje} onOpenChange={setCanje} />
      <ExtenderDialog acopio={a} open={extender} onOpenChange={setExtender} />
      <CobranzaDialog open={cobrar} onOpenChange={setCobrar} clienteId={a.clienteId} comprobanteId={comprobantes.find((c) => c.saldoPendiente > 0.009 && c.tipo !== "NOTA_CREDITO")?.id} />
      <PrintPreview open={imprimir} onOpenChange={setImprimir} titulo={`Estado de acopio ${a.numero}`}>
        <EstadoAcopioDocumento acopio={a} />
      </PrintPreview>
      <PrintPreview open={!!retiroImpreso} onOpenChange={(v) => !v && setRetiroImpreso(null)} titulo="Comprobante de retiro">
        {retiroImpreso && <ComprobanteRetiroDocumento retiroId={retiroImpreso} />}
      </PrintPreview>
      {dialog}
    </div>
  );
}

function SaldoPorProducto({ acopio, verMargen, onRetirar }: { acopio: Acopio; verMargen: boolean; onRetirar?: (itemId: string) => void }) {
  const db = useDb();
  let tPact = 0, tAct = 0;
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-table">
          <thead className="bg-[#FAFAF8]">
            <tr className="text-[12px] text-muted">
              <th className="h-9 px-3 text-left font-medium">Producto</th>
              <th className="h-9 px-3 text-right font-medium">Acopiado</th>
              <th className="h-9 px-3 text-right font-medium">Retirado</th>
              <th className="h-9 px-3 text-right font-medium">Pendiente</th>
              <th className="h-9 px-3 text-right font-medium">Precio pactado</th>
              {verMargen && <th className="h-9 px-3 text-right font-medium">Costo snapshot</th>}
              {verMargen && <th className="h-9 px-3 text-right font-medium">Costo actual</th>}
              {verMargen && <th className="h-9 px-3 text-right font-medium">Var. costo</th>}
              <th className="h-9 px-3 text-right font-medium">Pendiente a pactado</th>
              {verMargen && <th className="h-9 px-3 text-right font-medium">A costo actual</th>}
            </tr>
          </thead>
          <tbody>
            {acopio.items.map((i) => {
              const p = db.productos.find((x) => x.id === i.productoId)!;
              const pend = pendienteItem(i);
              const varc = i.costoUnitarioSnapshot ? (p.costoUltimo - i.costoUnitarioSnapshot) / i.costoUnitarioSnapshot : 0;
              tPact += pend * i.precioUnitarioPactado;
              tAct += pend * p.costoUltimo;
              return (
                <tr key={i.id} className="h-11 border-t border-border">
                  <td className="min-w-[240px] px-3"><span className="mr-2 whitespace-nowrap font-mono text-[11px] text-muted">{p.codigo}</span>{p.nombre}</td>
                  <td className="px-3 text-right tnum">{formatQty(i.cantidadAcopiada, p.unidad).split(" ")[0]}</td>
                  <td className="px-3 text-right text-muted tnum">{formatQty(i.cantidadRetirada, p.unidad).split(" ")[0]}</td>
                  <td className="px-3 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("font-semibold tnum", pend > 0 && "text-accent")}>{formatQty(pend, p.unidad)}</span>
                      {onRetirar && pend > 0 && <Button size="sm" variant="secondary" className="h-7" onClick={() => onRetirar(i.id)}>Retirar</Button>}
                    </span>
                  </td>
                  <td className="px-3 text-right tnum">{formatMoney(i.precioUnitarioPactado)}</td>
                  {verMargen && <td className="px-3 text-right text-muted tnum">{formatMoney(i.costoUnitarioSnapshot)}</td>}
                  {verMargen && <td className="px-3 text-right tnum">{formatMoney(p.costoUltimo)}</td>}
                  {verMargen && <td className={cn("px-3 text-right tnum", varc > 0.005 ? "text-danger" : varc < -0.005 ? "text-success" : "text-muted")}>{formatPercent(varc, { signo: true })}</td>}
                  <td className="px-3 text-right font-medium tnum">{formatMoney(pend * i.precioUnitarioPactado, { decimals: false })}</td>
                  {verMargen && <td className="px-3 text-right text-muted tnum">{formatMoney(pend * p.costoUltimo, { decimals: false })}</td>}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="h-10 border-t border-border-strong bg-[#FAFAF8] font-semibold">
              <td className="px-3" colSpan={verMargen ? 8 : 5}>Total pendiente</td>
              <td className="px-3 text-right text-accent tnum">{formatMoney(tPact, { decimals: false })}</td>
              {verMargen && <td className="px-3 text-right tnum">{formatMoney(tAct, { decimals: false })}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function Retiros({ acopio, onImprimir }: { acopio: Acopio; onImprimir: (id: string) => void }) {
  const db = useDb();
  const rs = db.retiros.filter((r) => r.acopioId === acopio.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (!rs.length) return <Card><EmptyState icono={PackageMinus} titulo="Todavía no hubo retiros" /></Card>;
  return (
    <Card>
      <ul className="divide-y divide-border">
        {rs.map((r) => {
          const d = db.despachos.find((x) => x.id === r.despachoId);
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
              <span className="font-mono text-[12px]">{r.numero}</span>
              <span className="text-muted">{formatDate(r.fecha)} · {nombreUsuario(db, r.usuarioId)}</span>
              <span className="min-w-0 flex-1 truncate">{r.items.map((i) => { const p = db.productos.find((x) => x.id === i.productoId); return `${formatQty(i.cantidad, p?.unidad ?? "UN")} ${p?.nombre}`; }).join(" · ")}</span>
              {d && (
                <Link href={`/despachos?despacho=${d.id}`} className="flex items-center gap-2 hover:underline">
                  <span className="font-mono text-[12px]">{d.numero}</span>
                  <StatusBadge tipo="DESPACHO" estado={d.estado} />
                </Link>
              )}
              <Button size="icon-sm" variant="ghost" aria-label="Imprimir comprobante de retiro" onClick={() => onImprimir(r.id)}><Printer /></Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function eventosAcopio(db: ReturnType<typeof useDb>, a: Acopio): EventoTimeline[] {
  const ev: EventoTimeline[] = [{ id: "ini", fecha: a.fechaInicio, accion: "Acopio creado y facturado", detalle: formatMoney(a.total), usuario: nombreUsuario(db, a.vendedorId), destacado: true }];
  for (const c of db.comprobantes.filter((x) => x.acopioId === a.id)) if (c.fecha !== a.fechaInicio) ev.push({ id: c.id, fecha: c.fecha, accion: `${TIPO_COMPROBANTE_LABEL[c.tipo]} ${c.numero}`, detalle: c.observaciones });
  for (const cob of db.cobranzas.filter((x) => x.imputaciones.some((i) => db.comprobantes.find((c) => c.id === i.comprobanteId)?.acopioId === a.id)))
    ev.push({ id: cob.id, fecha: cob.fecha, accion: `Cobro recibo ${cob.numero}`, detalle: formatMoney(cob.total), usuario: nombreUsuario(db, cob.usuarioId) });
  for (const r of db.retiros.filter((x) => x.acopioId === a.id)) {
    const d = db.despachos.find((x) => x.id === r.despachoId);
    ev.push({ id: r.id, fecha: r.fecha, accion: `Retiro ${r.numero}`, detalle: `${r.items.length} productos · ${d?.estado === "RETIRADO_EN_MOSTRADOR" ? "en mostrador" : `remito ${d?.numero ?? ""}`}`, usuario: nombreUsuario(db, r.usuarioId) });
    if (d?.fechaEntrega && d.estado === "ENTREGADO") ev.push({ id: `${d.id}-e`, fecha: d.fechaEntrega, accion: `Entregado en obra ${d.numero}`, detalle: d.firmaRecibido ? `Recibió: ${d.firmaRecibido}` : undefined });
  }
  for (const x of db.auditoria.filter((y) => y.entidadId === a.id && !["Creó acopio", "Registró retiro de acopio"].includes(y.accion))) ev.push({ id: x.id, fecha: x.fecha, accion: x.accion, detalle: x.detalle, usuario: nombreUsuario(db, x.usuarioId) });
  return ev;
}

function RetiroDialog({ acopio, abierto, onClose, onHecho }: { acopio: Acopio; abierto: { itemId?: string } | null; onClose: () => void; onHecho: (retiroId: string) => void }) {
  const db = useDb();
  const posiciones = usePosiciones();
  const puedeAutorizar = usePuede("acopios.autorizar");
  const cliente = db.clientes.find((c) => c.id === acopio.clienteId);
  const [fecha, setFecha] = React.useState(diaLocal(new Date()));
  const [cant, setCant] = React.useState<Record<string, number>>({});
  const [modalidad, setModalidad] = React.useState<"ENVIO" | "RETIRA">("ENVIO");
  const [direccion, setDireccion] = React.useState("");
  const [programada, setProgramada] = React.useState(diaLocal(new Date()));
  const [obs, setObs] = React.useState("");
  const [pedirAutorizacion, setPedirAutorizacion] = React.useState(false);
  React.useEffect(() => {
    if (!abierto) return;
    setFecha(diaLocal(new Date()));
    setProgramada(diaLocal(new Date(Date.now() + 86_400_000)));
    setCant(abierto.itemId ? { [abierto.itemId]: pendienteItem(acopio.items.find((i) => i.id === abierto.itemId)!) } : {});
    setDireccion(`${cliente?.direccion ?? ""}, ${cliente?.localidad ?? ""}`);
    setObs("");
    setPedirAutorizacion(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);
  const dep = db.depositos.find((d) => d.id === acopio.depositoId);

  const enviar = (autorizar = false) => {
    const r = useStore.getState().registrarRetiroAcopio({
      acopioId: acopio.id,
      fecha: deInput(fecha, -1),
      items: Object.entries(cant).map(([itemAcopioId, cantidad]) => ({ itemAcopioId, cantidad })),
      modalidad,
      direccionEntrega: modalidad === "ENVIO" ? direccion : undefined,
      fechaProgramada: deInput(programada),
      observaciones: obs || undefined,
      autorizarSinPago: autorizar,
    });
    if (!r.ok) {
      if (r.codigo === "IMPAGO") return setPedirAutorizacion(true);
      return toast.error(r.error);
    }
    toast.success(`Retiro ${r.data.numero} registrado`, { description: modalidad === "ENVIO" ? `Se generó el remito ${r.data.remito} pendiente de despacho.` : "Se entregó en mostrador y se descontó el stock." });
    onClose();
    onHecho(r.data.retiroId);
  };

  return (
    <>
      <Dialog open={!!abierto} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          size="xl"
          title={`Registrar retiro · ${acopio.numero}`}
          description={`${cliente?.razonSocial} · retira de ${dep?.nombre}`}
          footer={
            <>
              <Button variant="secondary" onClick={onClose}>Cancelar</Button>
              <Button onClick={() => enviar()} disabled={!Object.values(cant).some((v) => v > 0)}>
                <PackageMinus /> Registrar retiro
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-card border border-border">
              <table className="w-full min-w-[640px] text-table">
                <thead className="bg-[#FAFAF8]">
                  <tr className="text-[12px] text-muted">
                    <th className="h-9 px-3 text-left font-medium">Producto</th>
                    <th className="h-9 px-3 text-right font-medium">Pendiente</th>
                    <th className="h-9 px-3 text-right font-medium">Físico en depósito</th>
                    <th className="h-9 w-[150px] px-3 text-right font-medium">A retirar</th>
                  </tr>
                </thead>
                <tbody>
                  {acopio.items.filter((i) => pendienteItem(i) > 0).map((i) => {
                    const p = db.productos.find((x) => x.id === i.productoId)!;
                    const pend = pendienteItem(i);
                    const fis = posiciones.get(p.id)?.porDeposito[acopio.depositoId]?.fisico ?? 0;
                    const q = cant[i.id] ?? 0;
                    const sinFisico = q > fis;
                    return (
                      <tr key={i.id} className="border-t border-border align-top">
                        <td className="px-3 py-2">
                          {p.nombre}
                          {sinFisico && (
                            <div className="mt-0.5 text-[11px] text-danger">
                              Sin stock físico en {dep?.nombre}. <Link href={`/stock?tab=transferencias&nuevo=1&producto=${p.id}`} className="font-medium underline">Transferí</Link> o ingresá mercadería primero.
                            </div>
                          )}
                          {q > pend && <div className="mt-0.5 text-[11px] text-danger">No puede superar el pendiente.</div>}
                        </td>
                        <td className="px-3 py-2 text-right tnum">{formatQty(pend, p.unidad)}</td>
                        <td className={cn("px-3 py-2 text-right tnum", fis < pend && "text-warning")}>{formatQty(fis, p.unidad)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <NumberInput aria-label={`Retirar ${p.nombre}`} value={q} min={0} className={cn("h-8", (sinFisico || q > pend) && "border-danger")} onValueChange={(v) => setCant((c) => ({ ...c, [i.id]: v }))} />
                            <span className="w-8 text-[11px] text-muted">{unidadCorta(p.unidad)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Fecha" htmlFor="r-fecha">
                <Input id="r-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </FormField>
              <FormField label="Modalidad">
                <Select value={modalidad} onValueChange={(v) => setModalidad(v as "ENVIO" | "RETIRA")} options={[{ value: "ENVIO", label: "Envío a obra" }, { value: "RETIRA", label: "Retira en mostrador" }]} />
              </FormField>
              {modalidad === "ENVIO" && (
                <FormField label="Entrega programada" htmlFor="r-prog">
                  <Input id="r-prog" type="date" value={programada} onChange={(e) => setProgramada(e.target.value)} />
                </FormField>
              )}
              {modalidad === "ENVIO" && (
                <FormField label="Dirección de entrega" htmlFor="r-dir" className="sm:col-span-3">
                  <Input id="r-dir" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                </FormField>
              )}
              <FormField label="Observaciones" htmlFor="r-obs" className="sm:col-span-3">
                <Input id="r-obs" value={obs} onChange={(e) => setObs(e.target.value)} />
              </FormField>
            </div>
            <p className="text-[12px] text-muted">
              {modalidad === "ENVIO" ? "Se crea un remito pendiente; el stock se descuenta cuando el camión sale (despacho en viaje)." : "El stock se descuenta en el momento y el remito queda como retirado en mostrador."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={pedirAutorizacion} onOpenChange={setPedirAutorizacion}>
        <DialogContent
          size="sm"
          title="Autorizar retiro con saldo impago"
          description={`El cliente pagó ${formatPercent(acopio.total ? acopio.montoPagado / acopio.total : 0, { decimals: 0 })} del acopio y este retiro supera esa proporción.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setPedirAutorizacion(false)}>Volver</Button>
              {puedeAutorizar && (
                <Button
                  onClick={() => {
                    setPedirAutorizacion(false);
                    enviar(true);
                  }}
                >
                  Autorizar y registrar
                </Button>
              )}
            </>
          }
        >
          <p className="text-[13px] text-muted">{puedeAutorizar ? "La autorización queda registrada en la auditoría con tu usuario." : "Tu usuario no puede autorizarlo: pedile a Administración o al Dueño."}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AmpliarDialog({ acopio, open, onOpenChange }: { acopio: Acopio; open: boolean; onOpenChange: (v: boolean) => void }) {
  const db = useDb();
  const cliente = db.clientes.find((c) => c.id === acopio.clienteId);
  const [items, setItems] = React.useState<LineaBase[]>([]);
  React.useEffect(() => {
    if (open) setItems([]);
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        title={`Ampliar acopio ${acopio.numero}`}
        description="Las nuevas líneas se pactan al precio de lista actual del cliente y se emite un comprobante adicional."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              disabled={!items.length}
              onClick={() => {
                const r = useStore.getState().ampliarAcopio(acopio.id, items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, precio: i.precio ?? 0 })));
                if (r.ok) {
                  toast.success("Acopio ampliado y facturado");
                  onOpenChange(false);
                } else toast.error(r.error);
              }}
            >
              Ampliar y facturar
            </Button>
          </>
        }
      >
        <ItemsGrid
          items={items}
          onChange={setItems}
          crearItem={(p) => ({ id: newId("l"), productoId: p.id, cantidad: 1, precio: obtenerPrecio(p.id, cliente?.listaPreciosId ?? "lst_may", db.precios) })}
          depositoId={acopio.depositoId}
          listaId={cliente?.listaPreciosId}
          precioLabel="Precio pactado"
          conDescuento={false}
          totales={{ descuentoPct: 0, ivaPct: db.config.ivaPct }}
        />
      </DialogContent>
    </Dialog>
  );
}

function CanjeDialog({ acopio, open, onOpenChange }: { acopio: Acopio; open: boolean; onOpenChange: (v: boolean) => void }) {
  const db = useDb();
  const cliente = db.clientes.find((c) => c.id === acopio.clienteId);
  const conSaldo = acopio.items.filter((i) => pendienteItem(i) > 0);
  const [itemId, setItemId] = React.useState("");
  const [cantidad, setCantidad] = React.useState(0);
  const [destino, setDestino] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setItemId(conSaldo[0]?.id ?? "");
      setCantidad(0);
      setDestino("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const item = acopio.items.find((i) => i.id === itemId);
  const pOrigen = db.productos.find((p) => p.id === item?.productoId);
  const pDestino = db.productos.find((p) => p.id === destino);
  const precioDestino = destino ? obtenerPrecio(destino, cliente?.listaPreciosId ?? "lst_may", db.precios) : 0;
  const valor = item ? cantidad * item.precioUnitarioPactado : 0;
  const discreta = pDestino && !["M2", "M3", "KG", "LT", "ML"].includes(pDestino.unidad);
  const recibe = precioDestino ? (discreta ? Math.floor(valor / precioDestino) : Math.round((valor / precioDestino) * 100) / 100) : 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title="Canjear producto"
        description="Convierte el valor pendiente de un producto en otro, al precio de lista actual del cliente. Queda en el historial."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              disabled={!item || !destino || cantidad <= 0 || recibe <= 0}
              onClick={() => {
                const r = useStore.getState().canjearProducto(acopio.id, { itemAcopioId: itemId, cantidadOrigen: cantidad, productoDestinoId: destino, precioDestino });
                if (r.ok) {
                  toast.success("Canje registrado", { description: `${formatQty(cantidad, pOrigen!.unidad)} de ${pOrigen!.nombre} → ${formatQty(r.data, pDestino!.unidad)} de ${pDestino!.nombre}` });
                  onOpenChange(false);
                } else toast.error(r.error);
              }}
            >
              <Repeat /> Confirmar canje
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Producto con saldo">
            <Select value={itemId} onValueChange={(v) => { setItemId(v); setCantidad(0); }} options={conSaldo.map((i) => { const p = db.productos.find((x) => x.id === i.productoId)!; return { value: i.id, label: `${p.nombre} · pend. ${formatQty(pendienteItem(i), p.unidad)}` }; })} />
          </FormField>
          <FormField label="Cantidad a canjear" hint={item ? `Máximo ${formatQty(pendienteItem(item), pOrigen?.unidad ?? "UN")} · precio pactado ${formatMoney(item.precioUnitarioPactado)}` : undefined}>
            <NumberInput aria-label="Cantidad a canjear" value={cantidad} min={0} onValueChange={(v) => setCantidad(Math.min(v, item ? pendienteItem(item) : 0))} />
          </FormField>
          <FormField label="Producto que se lleva" className="sm:col-span-2">
            <Combobox aria-label="Producto destino" value={destino} onChange={setDestino} placeholder="Buscar producto…" opciones={db.productos.filter((p) => p.activo && p.id !== item?.productoId).map((p) => ({ value: p.id, label: p.nombre, detalle: p.codigo }))} />
          </FormField>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-card border border-border bg-subtle p-3 text-[13px]">
          <div><div className="text-[11px] text-muted">Valor a canjear</div><div className="font-semibold tnum">{formatMoney(valor)}</div></div>
          <div><div className="text-[11px] text-muted">Precio lista actual</div><div className="font-semibold tnum">{formatMoney(precioDestino)}</div></div>
          <div><div className="text-[11px] text-muted">Se lleva</div><div className="font-semibold text-accent tnum">{pDestino ? formatQty(recibe, pDestino.unidad) : "—"}</div></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExtenderDialog({ acopio, open, onOpenChange }: { acopio: Acopio; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [fecha, setFecha] = React.useState(diaLocal(acopio.fechaVencimiento));
  React.useEffect(() => {
    if (open) setFecha(diaLocal(new Date(Math.max(Date.now(), new Date(acopio.fechaVencimiento).getTime()) + 60 * 86_400_000)));
  }, [open, acopio.fechaVencimiento]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        title="Extender vencimiento"
        description={`Vencimiento actual: ${formatDate(acopio.fechaVencimiento)}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                const r = useStore.getState().extenderVencimiento(acopio.id, deInput(fecha));
                if (r.ok) {
                  toast.success(`Nuevo vencimiento: ${formatDate(deInput(fecha))}`);
                  onOpenChange(false);
                } else toast.error(r.error);
              }}
            >
              Extender
            </Button>
          </>
        }
      >
        <FormField label="Nueva fecha de vencimiento" htmlFor="ext-f">
          <Input id="ext-f" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </FormField>
      </DialogContent>
    </Dialog>
  );
}

/** "Estado de acopio" para entregar al cliente. */
export function EstadoAcopioDocumento({ acopio }: { acopio: Acopio }) {
  const db = useDb();
  const c = db.clientes.find((x) => x.id === acopio.clienteId);
  return (
    <PrintLayout
      titulo="Estado de acopio"
      numero={acopio.numero}
      fecha={formatDate(new Date())}
      subtitulo={
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] font-semibold uppercase text-muted">Cliente</div>
            <div className="font-semibold">{c?.razonSocial}</div>
            <div>CUIT {c?.cuit}</div>
          </div>
          <div>
            <div>Inicio: {formatDate(acopio.fechaInicio)}</div>
            <div>Vencimiento: {formatDate(acopio.fechaVencimiento)}</div>
            <div>Depósito: {db.depositos.find((d) => d.id === acopio.depositoId)?.nombre}</div>
          </div>
        </div>
      }
      pie="Los saldos pendientes se mantienen al precio pactado hasta la fecha de vencimiento."
    >
      <PrintTable
        head={["Producto", "Acopiado", "Retirado", "Pendiente", "Precio pactado", "Saldo"]}
        rows={acopio.items.map((i) => {
          const p = db.productos.find((x) => x.id === i.productoId);
          return [p?.nombre, formatQty(i.cantidadAcopiada, p?.unidad ?? "UN"), formatQty(i.cantidadRetirada, p?.unidad ?? "UN"), formatQty(pendienteItem(i), p?.unidad ?? "UN"), formatMoney(i.precioUnitarioPactado), formatMoney(pendienteItem(i) * i.precioUnitarioPactado)];
        })}
        foot={["Saldo pendiente (sin IVA)", "", "", "", "", formatMoney(acopio.items.reduce((s, i) => s + pendienteItem(i) * i.precioUnitarioPactado, 0))]}
      />
      <h4 className="mb-1 mt-5 text-[11px] font-semibold uppercase">Retiros realizados</h4>
      <PrintTable
        head={["Retiro", "Fecha", "Detalle"]}
        rows={db.retiros.filter((r) => r.acopioId === acopio.id).map((r) => [r.numero, formatDate(r.fecha), r.items.map((i) => { const p = db.productos.find((x) => x.id === i.productoId); return `${formatQty(i.cantidad, p?.unidad ?? "UN")} ${p?.nombre}`; }).join(", ")])}
      />
      <p className="mt-4">Total del acopio: <b>{formatMoney(acopio.total)}</b> · Pagado: <b>{formatMoney(acopio.montoPagado)}</b></p>
    </PrintLayout>
  );
}

/** Comprobante de retiro (lo firma el cliente). */
export function ComprobanteRetiroDocumento({ retiroId }: { retiroId: string }) {
  const db = useDb();
  const r = db.retiros.find((x) => x.id === retiroId);
  if (!r) return null;
  const a = db.acopios.find((x) => x.id === r.acopioId)!;
  const c = db.clientes.find((x) => x.id === a.clienteId);
  const d = db.despachos.find((x) => x.id === r.despachoId);
  return (
    <PrintLayout titulo="Comprobante de retiro" numero={r.numero} fecha={formatDateTime(r.fecha)} subtitulo={<div><b>Cliente:</b> {c?.razonSocial} · <b>Acopio:</b> {a.numero} · <b>Remito:</b> {d?.numero} · {d?.direccionEntrega}</div>} pie="Recibí conforme ______________________   Aclaración ______________________">
      <PrintTable head={["Producto", "Cantidad retirada", "Saldo restante"]} rows={r.items.map((i) => { const p = db.productos.find((x) => x.id === i.productoId); const it = a.items.find((x) => x.id === i.itemAcopioId); return [p?.nombre, formatQty(i.cantidad, p?.unidad ?? "UN"), it ? formatQty(pendienteItem(it), p?.unidad ?? "UN") : ""]; })} />
    </PrintLayout>
  );
}
