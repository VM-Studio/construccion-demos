"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRightLeft, Ban, CalendarClock, PackageOpen, Printer, SlidersHorizontal, Wallet } from "lucide-react";
import { useStore } from "@/store";
import { useAcopiosResumen, useDb, usePendientes, usePuede } from "@/store/selectors";
import type { Acopio } from "@/domain/types";
import { numeroCorto } from "@/domain/numeracion";
import { FORMA_PAGO_LABEL, MEDIO_PAGO_LABEL, TIPO_COMPROBANTE_LABEL } from "@/domain/estados";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { AdjuntosPanel, ClipContador, useAdjuntos } from "@/components/shared/adjuntos-panel";
import { HistorialEntidad } from "@/components/shared/historial-entidad";
import { PrintLayout, PrintPreview, PrintTable } from "@/components/shared/print-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NumberInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { PendientesTabla } from "@/components/modulos/ventas/pendientes-tabla";
import { CobranzaDialog } from "@/components/modulos/cuentas/cobranza-dialog";
import { ArticulosAcopio, MovimientosAcopio } from "./acopio-tablas";
import { DescargarDesacopio } from "./descargar-desacopio";

/** Cabecera estilo documento + KPIs (compartida con el estado de desacopio). */
export function CabeceraAcopio({ acopio, acciones }: { acopio: Acopio; acciones?: React.ReactNode }) {
  const db = useDb();
  const r = useAcopiosResumen().find((x) => x.acopio.id === acopio.id)!;
  const c = db.clientes.find((x) => x.id === acopio.clienteId);
  const adjuntos = useAdjuntos("ACOPIO", acopio.id);
  return (
    <>
      <PageHeader
        titulo={
          <span>
            {acopio.numero} · <Link href={`/clientes/${acopio.clienteId}`} className="hover:underline">{c?.razonSocial}</Link> <span className="font-normal text-muted">({c?.codigo})</span>
          </span>
        }
        descripcion={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <StatusBadge tipo="ACOPIO" estado={r.estado} />
            <CircuitoBadge circuito={acopio.circuito} />
            <span>Creado {formatDate(acopio.fechaCreacion)}</span>·
            <span className={cn(r.estado === "VIGENTE" && r.diasParaVencer <= 30 && "font-medium text-warning", r.estado === "VENCIDO" && "font-medium text-danger")}>
              Vence {formatDate(acopio.fechaVencimiento)}
              {r.estado === "VIGENTE" && ` (${r.diasParaVencer} días)`}
            </span>
            · <span>{FORMA_PAGO_LABEL[acopio.formaPago]}</span>· <span>{db.unidadesNegocio.find((u) => u.id === acopio.unidadNegocioId)?.nombre}</span>
            {db.obras.filter((o) => acopio.obraIds.includes(o.id)).map((o) => (
              <Badge key={o.id}>{o.nombre}</Badge>
            ))}
            <ClipContador cantidad={adjuntos.length} />
          </span>
        }
        acciones={acciones}
      />
      <div className={cn("mb-3 grid grid-cols-2 gap-3", acopio.formaPago === "CUENTA_CORRIENTE" ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
        <KpiCard label="Importe" valor={formatMoney(acopio.importe, { compact: acopio.importe >= 10_000_000 })} subtexto={acopio.alicuotaIIBBPct ? `con IIBB ${formatMoney(acopio.importeConIIBB, { compact: true })}` : undefined} />
        <KpiCard label="Retirado" valor={formatMoney(r.retirado, { compact: r.retirado >= 10_000_000 })} subtexto={`${formatPercent(r.retiradoPct, { decimals: 0 })} del importe`} />
        <KpiCard label="Saldo disponible" valor={<span className={r.saldo < 0 ? "text-danger" : ""}>{formatMoney(r.saldo)}</span>} acento />
        <KpiCard label="Pendiente de entrega" valor={formatMoney(r.pendienteEntrega, { compact: r.pendienteEntrega >= 10_000_000 })} subtexto="retirado sin remitir" />
        {acopio.formaPago === "CUENTA_CORRIENTE" && <KpiCard label="Pagado" valor={formatMoney(r.pagado, { compact: r.pagado >= 10_000_000 })} subtexto={<span className={r.pagado + 0.5 < r.retirado ? "font-medium text-danger" : ""}>{formatPercent(r.pagadoPct, { decimals: 0 })} del total</span>} />}
      </div>
      <div className="mb-4">
        <Progress value={r.retiradoPct} tone={r.saldo <= 0 ? "success" : "ink"} />
      </div>
    </>
  );
}

export function AcopioDetalle({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const acopio = db.acopios.find((a) => a.id === id);
  const res = useAcopiosResumen().find((x) => x.acopio.id === id);
  const pendientes = usePendientes();
  const puedeEditar = usePuede("acopios.editar");
  const puedeTraspasar = usePuede("acopios.traspasar");
  const puedeAutorizar = usePuede("acopios.autorizar");
  const puedeCobrar = usePuede("ctacte.cobrar");
  const [tab, setTab] = React.useState("movimientos");
  const [dialogo, setDialogo] = React.useState<"traspaso" | "ajuste" | "extender" | "cancelar" | "cobro" | "constancia" | null>(null);
  if (!acopio || !res)
    return (
      <Card>
        <EmptyState titulo="Acopio inexistente" accion={<Button onClick={() => router.push("/acopios")}>Volver</Button>} />
      </Card>
    );
  const nps = new Set(db.notasPedido.filter((n) => n.acopioId === id).map((n) => n.id));
  const lineas = pendientes.filter((l) => nps.has(l.notaPedidoId));
  const activo = res.estado !== "CANCELADO";
  return (
    <div>
      <Link href="/acopios" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Acopios de clientes
      </Link>
      <CabeceraAcopio
        acopio={acopio}
        acciones={
          <>
            {activo && puedeEditar && res.saldo > 0 && <Button onClick={() => router.push(`/ventas/notas-pedido/nueva?cliente=${acopio.clienteId}&origen=acopio&acopio=${acopio.id}`)}><PackageOpen /> Registrar retiro</Button>}
            {activo && puedeTraspasar && res.saldo > 0 && <Button variant="secondary" onClick={() => setDialogo("traspaso")}><ArrowRightLeft /> Traspasar saldo</Button>}
            {activo && puedeAutorizar && <Button variant="secondary" onClick={() => setDialogo("ajuste")}><SlidersHorizontal /> Ajustar saldo</Button>}
            {activo && puedeAutorizar && <Button variant="secondary" onClick={() => setDialogo("extender")}><CalendarClock /> Extender vencimiento</Button>}
            <DescargarDesacopio acopioId={acopio.id} />
            <Button variant="ghost" onClick={() => setDialogo("constancia")}><Printer /> Imprimir</Button>
            {activo && puedeAutorizar && <Button variant="ghost" onClick={() => setDialogo("cancelar")}><Ban /> Cancelar y devolver saldo</Button>}
          </>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-3 flex-wrap">
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="articulos">Artículos</TabsTrigger>
          <TabsTrigger value="pendiente">Pendiente de entrega ({lineas.length})</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="adjuntos">Adjuntos</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="movimientos">
          <MovimientosAcopio
            acopio={acopio}
            accionVacio={activo && puedeEditar && res.saldo > 0 ? <Button size="sm" onClick={() => router.push(`/ventas/notas-pedido/nueva?cliente=${acopio.clienteId}&origen=acopio&acopio=${acopio.id}`)}><PackageOpen /> Registrar retiro</Button> : undefined}
          />
        </TabsContent>
        <TabsContent value="articulos"><ArticulosAcopio acopio={acopio} /></TabsContent>
        <TabsContent value="pendiente"><PendientesTabla lineas={lineas} vacio={nps.size ? "Todo lo retirado ya se entregó" : "Todavía no hay retiros: lo que se retire y no se entregue en el momento aparece acá."} /></TabsContent>
        <TabsContent value="pagos"><PagosAcopio acopio={acopio} onCobrar={puedeCobrar ? () => setDialogo("cobro") : undefined} /></TabsContent>
        <TabsContent value="adjuntos"><Card className="p-4"><AdjuntosPanel entidadTipo="ACOPIO" entidadId={acopio.id} /></Card></TabsContent>
        <TabsContent value="historial"><Card className="p-4"><HistorialEntidad ids={[acopio.id, ...nps]} /></Card></TabsContent>
      </Tabs>

      {dialogo === "traspaso" && <TraspasoDialog acopio={acopio} saldo={res.saldo} onClose={() => setDialogo(null)} />}
      {dialogo === "ajuste" && <AjusteDialog acopio={acopio} onClose={() => setDialogo(null)} />}
      {dialogo === "extender" && <ExtenderDialog acopio={acopio} onClose={() => setDialogo(null)} />}
      {dialogo === "cancelar" && <CancelarDialog acopio={acopio} saldo={res.saldo} onClose={() => setDialogo(null)} />}
      <CobranzaDialog open={dialogo === "cobro"} onOpenChange={(v) => !v && setDialogo(null)} clienteId={acopio.clienteId} comprobanteId={acopio.comprobanteIds[0]} />
      <PrintPreview open={dialogo === "constancia"} onOpenChange={(v) => !v && setDialogo(null)} titulo={`Constancia de acopio ${acopio.numero}`}>
        <ConstanciaAcopio acopio={acopio} />
      </PrintPreview>
    </div>
  );
}

function PagosAcopio({ acopio, onCobrar }: { acopio: Acopio; onCobrar?: () => void }) {
  const db = useDb();
  const comps = db.comprobantes.filter((c) => acopio.comprobanteIds.includes(c.id) || (c.acopioId === acopio.id && c.tipo === "NOTA_CREDITO"));
  const recibos = db.cobranzas.filter((r) => acopio.reciboIds.includes(r.id));
  const impago = comps.filter((c) => c.tipo === "FACTURA").reduce((a, c) => a + c.saldoPendiente, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-[14px] font-semibold">Comprobantes</h3>
          {impago > 0.009 ? <Badge variant="danger">Impago {formatMoney(impago)}</Badge> : <Badge variant="success">Pagado</Badge>}
        </div>
        <ul className="divide-y divide-border">
          {comps.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <span className="font-medium">{TIPO_COMPROBANTE_LABEL[c.tipo]}{c.letra ? ` ${c.letra}` : ""}</span>
              <span className="font-mono text-[12px]">{c.numero}</span>
              <span className="flex-1 text-muted">{formatDate(c.fecha)}{c.vencimiento && c.saldoPendiente > 0 ? ` · vence ${formatDate(c.vencimiento)}` : ""}</span>
              <span className="tnum">{formatMoney(c.total)}</span>
              <StatusBadge tipo="COMPROBANTE" estado={c.estado} />
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-[14px] font-semibold">Recibos imputados</h3>
          {onCobrar && impago > 0.009 && <Button size="sm" onClick={onCobrar}><Wallet /> Registrar cobro</Button>}
        </div>
        {recibos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-[13px] text-muted">
            <span>{acopio.formaPago === "ANTICIPO" ? "Todavía no se registró el cobro del anticipo." : "Todavía no hay cobros: el acopio está en cuenta corriente."}</span>
            {onCobrar && impago > 0.009 && <Button size="sm" variant="secondary" onClick={onCobrar}><Wallet /> Registrar cobro</Button>}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recibos.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className="font-mono text-[12px]">{r.numero}</span>
                <span className="flex-1 text-muted">{formatDate(r.fecha)} · {r.medios.map((m) => MEDIO_PAGO_LABEL[m.medio]).join(", ")}</span>
                <span className="tnum">{formatMoney(r.imputaciones.filter((i) => acopio.comprobanteIds.includes(i.comprobanteId)).reduce((a, i) => a + i.importe, 0))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function TraspasoDialog({ acopio, saldo, onClose }: { acopio: Acopio; saldo: number; onClose: () => void }) {
  const resumen = useAcopiosResumen();
  const destinos = resumen.filter((r) => r.acopio.clienteId === acopio.clienteId && r.acopio.id !== acopio.id && r.estado !== "CANCELADO");
  const [destino, setDestino] = React.useState(destinos.find((d) => d.estado === "VIGENTE")?.acopio.id ?? destinos[0]?.acopio.id ?? "");
  const [monto, setMonto] = React.useState(Math.round(saldo * 100) / 100);
  const d = destinos.find((x) => x.acopio.id === destino);
  const sugerida = d ? `${numeroCorto(d.acopio.numero)}. Se traspasa el saldo del ${numeroCorto(acopio.numero)}, a pedido del cliente.` : "";
  const [desc, setDesc] = React.useState(sugerida);
  React.useEffect(() => setDesc(sugerida), [sugerida]);
  const confirmar = () => {
    const r = useStore.getState().traspasarSaldo(acopio.id, destino, monto, desc);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Saldo traspasado: ${r.data.salida} → ${r.data.entrada}`);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="md" title="Traspasar saldo" description={`Saldo disponible ${formatMoney(saldo)}. Genera un ACD de salida en este acopio y uno de entrada en el destino.`} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={confirmar} disabled={!destino || !(monto > 0) || monto > saldo + 0.005}><ArrowRightLeft /> Traspasar</Button></>}>
        {destinos.length === 0 ? (
          <p className="text-[13px] text-muted">El cliente no tiene otro acopio vigente. Creá uno nuevo para traspasar el saldo.</p>
        ) : (
          <div className="space-y-3">
            <FormField label="Acopio de destino">
              <Select aria-label="Acopio de destino" value={destino} onValueChange={setDestino} options={destinos.map((x) => ({ value: x.acopio.id, label: `${x.acopio.numero} · saldo ${formatMoney(x.saldo)}` }))} />
            </FormField>
            <FormField label="Monto" htmlFor="tr-m" hint={`Máximo ${formatMoney(saldo)}`}>
              <NumberInput id="tr-m" value={monto} min={0} onValueChange={setMonto} />
            </FormField>
            <FormField label="Descripción" htmlFor="tr-d" hint="Se ve en el detalle del acopio (editable)">
              <Input id="tr-d" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </FormField>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AjusteDialog({ acopio, onClose }: { acopio: Acopio; onClose: () => void }) {
  const [monto, setMonto] = React.useState(0);
  const [signo, setSigno] = React.useState("1");
  const [motivo, setMotivo] = React.useState("");
  const confirmar = () => {
    const r = useStore.getState().ajustarSaldoAcopio(acopio.id, Number(signo) * monto, motivo);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Ajuste ${r.data} registrado`);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm" title="Ajustar saldo" description="Genera un ACD. Queda en auditoría." footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={confirmar} disabled={!monto || !motivo.trim()}>Registrar ajuste</Button></>}>
        <div className="space-y-3">
          <FormField label="Tipo"><Select aria-label="Tipo de ajuste" value={signo} onValueChange={setSigno} options={[{ value: "1", label: "Suma al saldo" }, { value: "-1", label: "Resta del saldo" }]} /></FormField>
          <FormField label="Monto" htmlFor="aj-m"><NumberInput id="aj-m" value={monto} min={0} onValueChange={setMonto} /></FormField>
          <FormField label="Motivo" required htmlFor="aj-mo"><Input id="aj-mo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. bonificación por demora en la entrega" /></FormField>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExtenderDialog({ acopio, onClose }: { acopio: Acopio; onClose: () => void }) {
  const [fecha, setFecha] = React.useState(diaLocal(new Date(Date.parse(acopio.fechaVencimiento) + 60 * 86_400_000)));
  const confirmar = () => {
    const [y, m, d] = fecha.split("-").map(Number);
    const r = useStore.getState().extenderVencimientoAcopio(acopio.id, new Date(y, m - 1, d, 12).toISOString());
    if (!r.ok) return toast.error(r.error);
    toast.success("Vencimiento extendido");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm" title="Extender vencimiento" description={`Vence actualmente el ${formatDate(acopio.fechaVencimiento)}.`} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={confirmar}>Extender</Button></>}>
        <FormField label="Nueva fecha de vencimiento" htmlFor="ex-f"><Input id="ex-f" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></FormField>
      </DialogContent>
    </Dialog>
  );
}

function CancelarDialog({ acopio, saldo, onClose }: { acopio: Acopio; saldo: number; onClose: () => void }) {
  const [motivo, setMotivo] = React.useState("");
  const confirmar = () => {
    const r = useStore.getState().cancelarAcopio(acopio.id, motivo);
    if (!r.ok) return toast.error(r.error);
    toast.success("Acopio cancelado", { description: r.data ? `Se emitió la nota de crédito ${r.data} por el saldo.` : undefined });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm" title={`Cancelar ${acopio.numero}`} description={saldo > 0 ? `El saldo de ${formatMoney(saldo)} vuelve al cliente con una nota de crédito.` : "El acopio no tiene saldo."} footer={<><Button variant="secondary" onClick={onClose}>Volver</Button><Button variant="danger" onClick={confirmar} disabled={!motivo.trim()}><Ban /> Cancelar acopio</Button></>}>
        <FormField label="Motivo" required htmlFor="ca-m"><Input id="ca-m" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. el cliente suspendió la obra" /></FormField>
      </DialogContent>
    </Dialog>
  );
}

/** Constancia de acopio imprimible: obras, importe, vencimiento y lista de precios congelados. */
export function ConstanciaAcopio({ acopio }: { acopio: Acopio }) {
  const db = useDb();
  const c = db.clientes.find((x) => x.id === acopio.clienteId);
  const prod = new Map(db.productos.map((p) => [p.id, p]));
  const lista = [...acopio.preciosCongelados].sort((a, b) => (prod.get(a.productoId)?.codigo ?? "").localeCompare(prod.get(b.productoId)?.codigo ?? "", undefined, { numeric: true }));
  return (
    <PrintLayout
      titulo="Constancia de acopio"
      numero={acopio.numero}
      fecha={formatDate(acopio.fechaCreacion)}
      leyenda={acopio.circuito === 1 ? "Comprobante no fiscal · Demo" : "Documento interno"}
      subtitulo={
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div><b>Cliente:</b> {c?.razonSocial} ({c?.codigo}) · CUIT {c?.cuit || "—"}<br /><b>Obras:</b> {db.obras.filter((o) => acopio.obraIds.includes(o.id)).map((o) => o.nombre).join(" · ")}</div>
          <div><b>Importe:</b> {formatMoney(acopio.importe)}{acopio.alicuotaIIBBPct ? ` · con IIBB ${formatMoney(acopio.importeConIIBB)}` : ""}<br /><b>Vencimiento:</b> {formatDate(acopio.fechaVencimiento)} · <b>Forma de pago:</b> {FORMA_PAGO_LABEL[acopio.formaPago]}</div>
        </div>
      }
      pie="Los precios quedan congelados hasta el vencimiento para retiros contra este acopio."
    >
      <PrintTable head={["Código", "Artículo", "Precio congelado"]} rows={lista.map((p) => [prod.get(p.productoId)?.codigo, prod.get(p.productoId)?.nombre, formatMoney(p.precio)])} />
    </PrintLayout>
  );
}
