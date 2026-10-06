"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Calendar, Check, ClipboardList, Eye, History, List, MessageSquare, Paperclip, PlayCircle, Printer, ScanLine, Undo2, Upload, XCircle } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePosiciones, usePuede } from "@/store/selectors";
import { TIPO_REMITO_LABEL } from "@/domain/estados";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { AdjuntosPanel, VisorAdjunto, useAdjuntos } from "@/components/shared/adjuntos-panel";
import { HistorialEntidad } from "@/components/shared/historial-entidad";
import { PrintPreview } from "@/components/shared/print-layout";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { formatDate, formatMoney, formatNumber, unidadCorta } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DevolucionDialog, saldosDeNP } from "@/components/modulos/ventas/nota-pedido-detalle";
import { RemitoDocumento } from "./remito-documento";
import { SubirFirmadoDialog } from "./subir-firmado";

const PASOS = ["INICIAL", "PICKING", "HECHO"] as const;
const PASO_LABEL = { INICIAL: "Inicial", PICKING: "Picking", HECHO: "Hecho" };

export function RemitoDetalle({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const posiciones = usePosiciones();
  const puedeOperar = usePuede("remitos.operar");
  const puedeAnular = usePuede("ventas.anular");
  const puedeVender = usePuede("ventas.editar");
  const r = db.remitos.find((x) => x.id === id);
  const adjuntos = useAdjuntos("REMITO", id);
  const [vista, setVista] = React.useState<"articulos" | "direccion" | "comentarios" | "despacho" | "adjuntos" | "historial">("articulos");
  const [subir, setSubir] = React.useState(false);
  const [imprimir, setImprimir] = React.useState<"remito" | "picking" | null>(null);
  const [verFirmado, setVerFirmado] = React.useState(false);
  const [devolver, setDevolver] = React.useState(false);
  const [comentario, setComentario] = React.useState(r?.comentario ?? "");
  const [series, setSeries] = React.useState<Record<string, string>>({});
  const { confirmar, dialog } = useConfirm();
  if (!r)
    return (
      <Card>
        <EmptyState titulo="Remito inexistente" accion={<Button onClick={() => router.push("/remitos")}>Volver</Button>} />
      </Card>
    );
  const c = db.clientes.find((x) => x.id === r.clienteId);
  const np = db.notasPedido.find((n) => n.id === r.notaPedidoId);
  const acopio = db.acopios.find((a) => a.id === r.acopioId);
  const obra = db.obras.find((o) => o.id === r.obraId);
  const despacho = db.despachos.find((d) => d.id === r.despachoId) ?? db.despachos.find((d) => d.remitoId === r.id);
  const firmado = adjuntos.find((a) => a.id === r.firmadoAdjuntoId);
  const saldos = np ? saldosDeNP(np, db) : null;
  const pasoActual = r.estado === "ANULADO" ? -1 : PASOS.indexOf(r.estado as (typeof PASOS)[number]);
  const devoluciones = db.devoluciones.filter((d) => d.notaPedidoId === r.notaPedidoId);

  const iniciarPicking = () => {
    const x = useStore.getState().iniciarPicking(r.id);
    if (!x.ok) return toast.error(x.error);
    toast.success("Picking iniciado", { description: "Imprimí la orden de picking para el depósito." });
    setImprimir("picking");
  };
  const marcarHecho = () => {
    const x = useStore.getState().marcarRemitoHecho(r.id);
    if (!x.ok) return toast.error(x.error);
    toast.success(`Remito ${r.numero} hecho`, { description: "Se descontó el stock y se actualizó lo entregado." });
    setSubir(true);
  };

  const icono = (k: typeof vista, Icon: React.ComponentType<{ className?: string }>, label: string, n?: number, verde?: boolean) => (
    <Tooltip content={label}>
      <button onClick={() => setVista(k)} aria-label={label} className={cn("relative flex size-9 items-center justify-center rounded-control border transition-colors", vista === k ? "border-ink bg-subtle text-ink" : "border-border text-muted hover:text-ink")}>
        <Icon className="size-4" />
        {n !== undefined && n > 0 && <span className={cn("absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white tnum", verde ? "bg-success" : "bg-ink")}>{n}</span>}
      </button>
    </Tooltip>
  );

  return (
    <div>
      <Link href="/remitos" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft className="size-4" /> Remitos</Link>
      <PageHeader
        titulo={
          <span>
            Remito de {TIPO_REMITO_LABEL[r.tipo].toLowerCase()} {r.numero} <span className="font-normal text-muted">({r.estado === "ANULADO" ? "Anulado" : PASO_LABEL[r.estado]})</span>
            {c && <> · <Link href={`/clientes/${c.id}`} className="hover:underline">{c.razonSocial}</Link></>}
          </span>
        }
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <CircuitoBadge circuito={r.circuito} />
            {r.facturado ? <Badge variant="success">Facturado</Badge> : <Badge>Sin facturar</Badge>}
            {r.estado === "HECHO" && (firmado ? <Badge variant="success">Con remito firmado</Badge> : <Badge variant="warning">Sin remito firmado</Badge>)}
          </span>
        }
        acciones={
          <div className="flex flex-col items-end gap-3">
            <ol className="flex items-center gap-1" aria-label="Estado del remito">
              {PASOS.map((p, i) => (
                <li key={p} className="flex items-center gap-1">
                  {i > 0 && <span className={cn("h-px w-6", i <= pasoActual ? "bg-ink" : "bg-border-strong")} />}
                  <span className={cn("flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium", i < pasoActual ? "border-ink bg-ink text-white" : i === pasoActual ? (p === "HECHO" ? "border-success bg-success-soft text-success" : p === "PICKING" ? "border-warning bg-warning-soft text-warning" : "border-ink text-ink") : "border-border text-disabled")}>
                    {i < pasoActual && <Check className="size-3" />}
                    {PASO_LABEL[p]}
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex gap-1.5">
              {icono("articulos", List, "Artículos", r.items.length)}
              {icono("comentarios", MessageSquare, "Comentarios", r.comentario ? 1 : 0)}
              {icono("despacho", Calendar, "Despacho", despacho ? 1 : 0)}
              {icono("adjuntos", Paperclip, "Adjuntos", adjuntos.length, !!firmado)}
              {icono("historial", History, "Historial")}
            </div>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {r.estado === "INICIAL" && puedeOperar && <Button onClick={iniciarPicking}><PlayCircle /> Iniciar picking</Button>}
        {r.estado === "PICKING" && puedeOperar && <Button onClick={marcarHecho}><Check /> Marcar como hecho / entregado</Button>}
        {r.estado === "PICKING" && <Button variant="secondary" onClick={() => setImprimir("picking")}><ClipboardList /> Orden de picking</Button>}
        {r.estado === "HECHO" && !firmado && puedeOperar && <Button onClick={() => setSubir(true)}><Upload /> Subir remito firmado</Button>}
        {firmado && <Button variant="secondary" onClick={() => setVerFirmado(true)}><Eye /> Ver remito firmado</Button>}
        <Button variant="secondary" onClick={() => setImprimir("remito")}><Printer /> {r.estado === "HECHO" ? "Reimprimir" : "Imprimir"}</Button>
        {r.estado === "HECHO" && np && r.tipo !== "DEVOLUCION" && puedeVender && <Button variant="ghost" onClick={() => setDevolver(true)}><Undo2 /> Generar devolución</Button>}
        {(r.estado === "INICIAL" || r.estado === "PICKING") && puedeAnular && (
          <Button variant="ghost" onClick={() => confirmar({ titulo: `Anular ${r.numero}`, descripcion: "La mercadería vuelve a quedar pendiente de entrega.", confirmLabel: "Anular", variant: "danger", onConfirm: () => { const x = useStore.getState().anularRemito(r.id, "Anulado por el usuario"); if (x.ok) toast.success("Remito anulado"); else toast.error(x.error); } })}>
            <XCircle /> Anular
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {vista === "articulos" && (
            <Card>
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <h3 className="text-[14px] font-semibold">Artículos</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={async () => { try { const t = await navigator.clipboard.readText(); const ls = t.split(/\r?\n/).filter(Boolean); setSeries(Object.fromEntries(r.items.map((i, k) => [i.productoId, ls[k] ?? ""]))); toast.success("Números de serie pegados"); } catch { toast.info("Copiá los números de serie (uno por línea) y volvé a intentar."); } }}>Pegar nros de serie</Button>
                  <Button size="sm" variant="ghost" onClick={() => toast.info("Escaneo de números de serie: disponible con lector en la versión instalada.")}><ScanLine /> Escanear nros de serie</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-table">
                  <thead className="bg-[#FAFAF8] text-[12px] text-muted">
                    <tr>
                      <th className="h-9 px-3 text-left font-medium">Artículo</th>
                      <th className="h-9 px-3 text-left font-medium">Descripción</th>
                      <th className="h-9 px-3 text-right font-medium">Pedido</th>
                      <th className="h-9 px-3 text-right font-medium">En stock</th>
                      <th className="h-9 px-3 text-right font-medium">Entregado</th>
                      <th className="h-9 px-3 text-left font-medium">Unidad</th>
                      <th className="h-9 px-3 text-right font-medium">Reservado</th>
                      <th className="h-9 px-3 text-left font-medium">Nro de serie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((i, k) => {
                      const p = db.productos.find((x) => x.id === i.productoId);
                      const linea = np?.items.find((x) => x.id === i.itemNPId);
                      return (
                        <tr key={`${i.productoId}-${k}`} className="h-10 border-t border-border">
                          <td className="px-3 font-mono text-[12px]">{p?.codigo}</td>
                          <td className="px-3">{p?.nombre}</td>
                          <td className="px-3 text-right tnum">{formatNumber(linea?.cantidad ?? i.cantidad)}</td>
                          <td className="px-3 text-right text-muted tnum">{formatNumber(posiciones.get(i.productoId)?.porDeposito[r.depositoId]?.fisico ?? 0)}</td>
                          <td className="px-3 text-right font-medium tnum">{r.estado === "HECHO" ? formatNumber(i.cantidad) : "—"}</td>
                          <td className="px-3 text-muted">{unidadCorta(p?.unidad ?? "UN")}</td>
                          <td className="px-3 text-right tnum">{r.estado === "PICKING" ? formatNumber(i.cantidad) : "—"}</td>
                          <td className="px-3 font-mono text-[11px] text-muted">{series[i.productoId] || i.nroSerie?.join(", ") || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {vista === "direccion" && (
            <Card className="p-4 text-[13px]">
              <dl className="space-y-2">
                <div><dt className="text-muted">Dirección de entrega</dt><dd>{r.direccionEntrega ?? "Retira en mostrador"}</dd></div>
                <div><dt className="text-muted">Obra</dt><dd>{obra ? `${obra.nombre} · ${[obra.direccion, obra.localidad].filter(Boolean).join(", ")}` : "—"}</dd></div>
                <div><dt className="text-muted">Contacto en obra</dt><dd>{obra?.contacto ?? c?.contacto ?? c?.telefono ?? "—"}</dd></div>
                <div><dt className="text-muted">Horario</dt><dd>Lunes a viernes de 8 a 17 h</dd></div>
              </dl>
            </Card>
          )}
          {vista === "comentarios" && (
            <Card className="space-y-2 p-4">
              <Textarea aria-label="Comentario del remito" rows={4} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Comentario para el depósito o el chofer…" />
              <div className="flex justify-end"><Button size="sm" onClick={() => { useStore.getState().comentarRemito(r.id, comentario); toast.success("Comentario guardado"); }}>Guardar comentario</Button></div>
            </Card>
          )}
          {vista === "despacho" && (
            <Card className="p-4 text-[13px]">
              {despacho ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/despachos?despacho=${despacho.id}`} className="font-mono hover:underline">{despacho.numero}</Link>
                  <StatusBadge tipo="DESPACHO" estado={despacho.estado} />
                  <span className="text-muted">Programado {formatDate(despacho.fechaProgramada)} · {despacho.posicion} · {despacho.modalidad === "ENVIO" ? "Envío" : "Retira"}{despacho.vehiculoId ? ` · ${db.vehiculos.find((v) => v.id === despacho.vehiculoId)?.patente}` : ""}</span>
                </div>
              ) : (
                <p className="text-muted">El remito no tiene despacho asignado.</p>
              )}
            </Card>
          )}
          {vista === "adjuntos" && <Card className="p-4"><AdjuntosPanel entidadTipo="REMITO" entidadId={r.id} categoriaDefecto="REMITO_FIRMADO" /></Card>}
          {vista === "historial" && <Card className="p-4"><HistorialEntidad ids={[r.id, ...(despacho ? [despacho.id] : [])]} /></Card>}
          {(vista === "articulos" || vista === "direccion") && (
            <div className="mt-2 flex gap-2 text-[12px]">
              <button onClick={() => setVista("articulos")} className={cn("rounded-control px-2 py-1", vista === "articulos" ? "bg-subtle font-medium text-ink" : "text-muted")}>Artículos</button>
              <button onClick={() => setVista("direccion")} className={cn("rounded-control px-2 py-1", vista === "direccion" ? "bg-subtle font-medium text-ink" : "text-muted")}>Dirección</button>
            </div>
          )}
        </div>
        <aside>
          <Card className="p-4 text-[13px]">
            <dl className="grid grid-cols-[120px_1fr] gap-y-2">
              <dt className="text-muted">Depósito</dt><dd>{db.depositos.find((d) => d.id === r.depositoId)?.nombre}</dd>
              <dt className="text-muted">Cantidad total</dt><dd className="tnum">{formatNumber(r.cantidadTotal)}</dd>
              <dt className="text-muted">Peso total</dt><dd className="tnum">{formatNumber(r.pesoTotalKg, 0)} kg</dd>
              <dt className="text-muted">Valor declarado</dt><dd className="tnum">{formatMoney(r.valorDeclarado)}</dd>
              <dt className="text-muted">Fecha</dt><dd>{formatDate(r.fecha)}</dd>
              <dt className="text-muted">Fecha de entrega</dt><dd>{formatDate(r.fechaEntrega)}</dd>
              <dt className="text-muted">Cliente</dt><dd>{c ? <Link href={`/clientes/${c.id}`} className="hover:underline">{c.codigo} · {c.nombreFantasia ?? c.razonSocial}</Link> : "—"}</dd>
              <dt className="text-muted">Nota de pedido</dt><dd>{np ? <Link href={`/ventas/notas-pedido/${np.id}`} className="font-mono text-[12px] hover:underline">{np.numero}</Link> : "—"}</dd>
              {acopio && (<><dt className="text-muted">Acopio</dt><dd><Link href={`/acopios/${acopio.id}`} className="font-mono text-[12px] hover:underline">{acopio.numero}</Link></dd></>)}
              <dt className="text-muted">Obra</dt><dd>{obra?.nombre ?? "—"}</dd>
              <dt className="text-muted">Facturas</dt><dd className="font-mono text-[11px]">{r.facturasRef?.join(", ") || "—"}</dd>
              {devoluciones.length > 0 && (<><dt className="text-muted">Devoluciones</dt><dd className="font-mono text-[11px]">{devoluciones.map((d) => d.numero).join(", ")}</dd></>)}
              <dt className="text-muted">Despacho</dt><dd>{despacho ? <span className="flex items-center gap-1.5"><span className="font-mono text-[12px]">{despacho.numero}</span><StatusBadge tipo="DESPACHO" estado={despacho.estado} /></span> : "—"}</dd>
            </dl>
            {saldos && r.tipo === "DESACOPIO" && (
              <div className="mt-3 rounded-control border border-accent/30 bg-accent-soft p-3">
                <div className="text-[12px] text-muted">Saldo del acopio</div>
                <div className="tnum">{formatMoney(saldos.antes)} → <b>{formatMoney(saldos.despues)}</b></div>
              </div>
            )}
          </Card>
        </aside>
      </div>
      <SubirFirmadoDialog remitoId={r.id} open={subir} onOpenChange={setSubir} />
      <VisorAdjunto adjunto={verFirmado ? (firmado ?? null) : null} onOpenChange={(v) => !v && setVerFirmado(false)} />
      <PrintPreview open={!!imprimir} onOpenChange={(v) => !v && setImprimir(null)} titulo={imprimir === "picking" ? `Orden de picking ${r.numero}` : `Remito ${r.numero}`}>
        <RemitoDocumento remito={r} picking={imprimir === "picking"} />
      </PrintPreview>
      {np && <DevolucionDialog np={np} open={devolver} onOpenChange={setDevolver} />}
      {dialog}
    </div>
  );
}
