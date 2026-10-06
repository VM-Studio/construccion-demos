"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Ban, CalendarPlus, Printer, Receipt, Truck, Undo2, Wallet } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useRentabilidadNP } from "@/store/selectors";
import type { NotaPedido } from "@/domain/types";
import { pendienteLinea, movimientosAcopio } from "@/domain/acopios";
import { FORMA_PAGO_LABEL, TIPO_COMPROBANTE_LABEL } from "@/domain/estados";
import { porcentajeEntregado } from "@/domain/ventas";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { AdjuntosPanel, ClipContador, useAdjuntos } from "@/components/shared/adjuntos-panel";
import { HistorialEntidad } from "@/components/shared/historial-entidad";
import { PrintLayout, PrintPreview, PrintTable } from "@/components/shared/print-layout";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { NumberInput, Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { formatDate, formatMoney, formatPercent, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CobranzaDialog } from "@/components/modulos/cuentas/cobranza-dialog";
import { ComprobanteDocumento } from "@/components/modulos/cuentas/documentos";
import { ProgramarEntregaDialog, useFilasPendientes } from "./pendientes-tabla";
import { lineasPendientes } from "@/domain/stock";

/** Saldo del acopio antes y después de una NP (según el detalle corrido). */
export function saldosDeNP(np: NotaPedido, db: ReturnType<typeof useDb>) {
  if (!np.acopioId) return null;
  const a = db.acopios.find((x) => x.id === np.acopioId);
  if (!a) return null;
  const g = movimientosAcopio(a, db.notasPedido, db.devoluciones, db.ajustesAcopio, db).find((x) => x.id === np.id);
  if (!g) return null;
  const despues = g.lineas.at(-1)?.saldoDisponible ?? 0;
  return { acopio: a, antes: Math.round((despues + np.monto) * 100) / 100, despues };
}

export function NotaPedidoDetalle({ np }: { np: NotaPedido }) {
  const db = useDb();
  const router = useRouter();
  const rent = useRentabilidadNP().get(np.id);
  const verMargen = usePuede("margenes.ver");
  const puedeEditar = usePuede("ventas.editar");
  const puedeFacturar = usePuede("ventas.facturar");
  const puedeCobrar = usePuede("ctacte.cobrar");
  const puedeAnular = usePuede("ventas.anular");
  const { confirmar, dialog } = useConfirm();
  const [imprimir, setImprimir] = React.useState(false);
  const [cobrar, setCobrar] = React.useState(false);
  const [devolver, setDevolver] = React.useState(false);
  const [verFactura, setVerFactura] = React.useState(false);
  const [programar, setProgramar] = React.useState(false);
  const [tab, setTab] = React.useState("articulos");
  const cliente = db.clientes.find((c) => c.id === np.clienteId);
  const adjuntos = useAdjuntos("NOTA_PEDIDO", np.id);
  const factura = db.comprobantes.find((c) => np.comprobanteIds.includes(c.id) && c.tipo === "FACTURA" && c.estado !== "ANULADO");
  const remitos = db.remitos.filter((r) => np.remitoIds.includes(r.id) || r.notaPedidoId === np.id);
  const devoluciones = db.devoluciones.filter((d) => d.notaPedidoId === np.id);
  const saldos = saldosDeNP(np, db);
  const abierta = np.estado !== "ANULADA";
  const lineasPend = React.useMemo(() => lineasPendientes([np], db.remitos), [np, db.remitos]);
  const filasPend = useFilasPendientes(lineasPend);
  const hayPendienteSinRemito = lineasPend.length > 0;
  const prod = (id: string) => db.productos.find((p) => p.id === id);

  const run = (r: { ok: true; data?: unknown } | { ok: false; error: string }, msg: string) => {
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    toast.success(msg);
    return true;
  };

  const generarRemito = () => {
    const directo = np.pendienteEntrega && np.modalidadEntrega === "RETIRA";
    const r = useStore.getState().generarRemito(np.id, { estado: directo ? "HECHO" : "PICKING" });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Remito ${r.data.numero} ${directo ? "hecho (cliente retira)" : "en picking"}`, { action: { label: "Ver remito", onClick: () => router.push(`/remitos/${r.data.id}`) } });
  };

  return (
    <div>
      <Link href="/ventas/notas-pedido" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Notas de pedido
      </Link>
      <PageHeader
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            Nota de pedido {np.numero}
            <StatusBadge tipo="NP" estado={np.estado} />
          </span>
        }
        descripcion={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/clientes/${np.clienteId}`} className="font-medium text-ink hover:underline">{cliente?.razonSocial}</Link>· {formatDate(np.fecha)} ·
            <CircuitoBadge circuito={np.circuito} />
            {np.origen === "ACOPIO" ? <Badge variant="accent">Retiro de acopio</Badge> : <Badge>Venta nueva</Badge>}
            <span>· {FORMA_PAGO_LABEL[np.formaPago]}</span>
            {np.pendienteEntrega && <Badge variant="warning">Pendiente de entrega</Badge>}
            <ClipContador cantidad={adjuntos.length} onClick={() => setTab("adjuntos")} />
          </span>
        }
        acciones={
          abierta && (
            <>
              {hayPendienteSinRemito && puedeEditar && (
                <Button onClick={generarRemito}><Truck /> Generar remito</Button>
              )}
              {hayPendienteSinRemito && puedeEditar && (
                <Button variant="secondary" onClick={() => setProgramar(true)}><CalendarPlus /> Programar entrega</Button>
              )}
              {np.origen === "ACOPIO" ? (
                <Tooltip content="Los retiros de acopio no se facturan: el acopio ya se facturó">
                  <span><Button variant="secondary" disabled><Receipt /> Facturar</Button></span>
                </Tooltip>
              ) : (
                !factura && puedeFacturar && (
                  <Button variant="secondary" onClick={() => { const r = useStore.getState().facturarNotaPedido(np.id); if (r.ok) { toast.success(`Factura ${r.data.numero} emitida`); if (np.formaPago === "CONTADO") setCobrar(true); } else toast.error(r.error); }}>
                    <Receipt /> Facturar {np.circuito === 1 ? "F1" : "F2"}
                  </Button>
                )
              )}
              {factura && factura.saldoPendiente > 0.009 && puedeCobrar && (
                <Button variant="secondary" onClick={() => setCobrar(true)}><Wallet /> Registrar cobro</Button>
              )}
              {np.items.some((i) => i.cantidad - (i.devueltos ?? 0) > 0) && puedeEditar && (
                <Button variant="ghost" onClick={() => setDevolver(true)}><Undo2 /> Devolución</Button>
              )}
              <Button variant="ghost" onClick={() => setImprimir(true)}><Printer /> Imprimir</Button>
              {puedeAnular && !np.items.some((i) => i.entregados > 0) && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    confirmar({
                      titulo: `Anular ${np.numero}`,
                      descripcion: np.acopioId ? "El monto vuelve al saldo del acopio y se anulan los remitos y despachos pendientes." : "Se anulan los remitos y despachos pendientes.",
                      confirmLabel: "Anular",
                      variant: "danger",
                      onConfirm: () => run(useStore.getState().anularNotaPedido(np.id, "Anulada por el usuario"), "Nota de pedido anulada"),
                    })
                  }
                >
                  <Ban /> Anular
                </Button>
              )}
            </>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList className="mb-3">
            <TabsTrigger value="articulos">Artículos</TabsTrigger>
            <TabsTrigger value="remitos">Remitos ({remitos.length})</TabsTrigger>
            <TabsTrigger value="comprobantes">Comprobantes</TabsTrigger>
            <TabsTrigger value="adjuntos">Adjuntos ({adjuntos.length})</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>
          <TabsContent value="articulos">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-table">
                  <thead className="bg-[#FAFAF8] text-[12px] text-muted">
                    <tr>
                      <th className="h-9 px-3 text-left font-medium">Artículo</th>
                      <th className="h-9 px-3 text-left font-medium">Obra</th>
                      <th className="h-9 px-3 text-right font-medium">Cantidad</th>
                      <th className="h-9 px-3 text-right font-medium">Entregados</th>
                      <th className="h-9 px-3 text-right font-medium">Devueltos</th>
                      <th className="h-9 px-3 text-right font-medium">Pendiente</th>
                      <th className="h-9 px-3 text-right font-medium">Precio</th>
                      <th className="h-9 px-3 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {np.items.map((i) => {
                      const p = prod(i.productoId);
                      const pend = pendienteLinea(i);
                      return (
                        <tr key={i.id} className="h-10 border-t border-border">
                          <td className="px-3"><span className="mr-1.5 font-mono text-[11px] text-muted">{p?.codigo}</span>{p?.nombre}</td>
                          <td className="px-3 text-[12px] text-muted">{db.obras.find((o) => o.id === i.obraId)?.nombre ?? "—"}</td>
                          <td className="px-3 text-right tnum">{formatQty(i.cantidad, p?.unidad ?? "UN")}</td>
                          <td className="px-3 text-right tnum">{i.entregados}</td>
                          <td className="px-3 text-right tnum text-muted">{i.devueltos ?? 0}</td>
                          <td className={cn("px-3 text-right font-medium tnum", pend > 0 && "text-warning")}>{pend}</td>
                          <td className="px-3 text-right tnum">{formatMoney(i.precioUnitario)}{i.descuentoPct ? <span className="block text-[11px] text-muted">−{i.descuentoPct} %</span> : null}</td>
                          <td className="px-3 text-right tnum">{formatMoney(i.subtotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
            {filasPend.length > 0 && (
              <p className="mt-2 text-[12px] text-muted">
                {filasPend.some((f) => f.despacho) ? `Despacho asignado: ${[...new Set(filasPend.filter((f) => f.despacho).map((f) => f.despacho!.numero))].join(", ")}` : "Sin despacho programado"}
                {np.fechaEntregaProgramada && ` · programada para el ${formatDate(np.fechaEntregaProgramada)}`}
                {np.direccionEntrega && ` · ${np.direccionEntrega}`}
              </p>
            )}
          </TabsContent>
          <TabsContent value="remitos">
            <Card>
              {remitos.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-muted">Todavía no se generaron remitos.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {remitos.map((r) => (
                    <li key={r.id}>
                      <Link href={`/remitos/${r.id}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-subtle">
                        <span className="font-mono text-[12px]">{r.numero}</span>
                        <span className="flex-1 text-muted">{formatDate(r.fechaEntrega ?? r.fecha)} · {r.cantidadTotal} u. · {r.pesoTotalKg} kg</span>
                        <ClipContador cantidad={db.adjuntos.filter((a) => a.entidadId === r.id).length} firmado={!!r.firmadoAdjuntoId} />
                        <StatusBadge tipo="REMITO" estado={r.estado} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>
          <TabsContent value="comprobantes">
            <Card>
              <ul className="divide-y divide-border">
                {db.comprobantes.filter((c) => np.comprobanteIds.includes(c.id)).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                    <span className="font-medium">{TIPO_COMPROBANTE_LABEL[c.tipo]}{c.letra ? ` ${c.letra}` : ""}</span>
                    <span className="font-mono text-[12px]">{c.numero}</span>
                    <span className="flex-1 text-muted">{formatDate(c.fecha)} · saldo {formatMoney(c.saldoPendiente)}</span>
                    <span className="tnum">{formatMoney(c.total)}</span>
                    <StatusBadge tipo="COMPROBANTE" estado={c.estado} />
                  </li>
                ))}
                {devoluciones.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                    <span className="font-medium">Devolución</span>
                    <span className="font-mono text-[12px]">{d.numero}</span>
                    <span className="flex-1 text-muted">{formatDate(d.fecha)} · {d.motivo}</span>
                    <span className="tnum">{formatMoney(d.monto)}</span>
                  </li>
                ))}
                {!np.comprobanteIds.length && !devoluciones.length && <li className="py-8 text-center text-[13px] text-muted">{np.origen === "ACOPIO" ? "Retiro de acopio: no lleva comprobante propio." : "Sin comprobantes."}</li>}
              </ul>
            </Card>
          </TabsContent>
          <TabsContent value="adjuntos"><Card className="p-4"><AdjuntosPanel entidadTipo="NOTA_PEDIDO" entidadId={np.id} /></Card></TabsContent>
          <TabsContent value="historial"><Card className="p-4"><HistorialEntidad ids={[np.id, ...remitos.map((r) => r.id), ...devoluciones.map((d) => d.id)]} /></Card></TabsContent>
        </Tabs>

        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px]">
                <dt className="text-muted">Subtotal</dt><dd className="text-right tnum">{formatMoney(np.monto)}</dd>
                {np.descuentoPct > 0 && (<><dt className="text-muted">Descuento {np.descuentoPct} %</dt><dd className="text-right tnum">− {formatMoney(np.monto * np.descuentoPct / 100)}</dd></>)}
                {np.iva > 0 && (<><dt className="text-muted">IVA</dt><dd className="text-right tnum">{formatMoney(np.iva)}</dd></>)}
                <dt className="border-t border-border pt-1.5 font-semibold">Total</dt><dd className="border-t border-border pt-1.5 text-right text-[16px] font-semibold tnum">{formatMoney(np.total)}</dd>
              </dl>
              <div>
                <div className="mb-1 flex justify-between text-[12px] text-muted"><span>Entregado</span><span className="tnum">{Math.round(porcentajeEntregado(np) * 100)} %</span></div>
                <Progress value={porcentajeEntregado(np)} tone={porcentajeEntregado(np) >= 1 ? "success" : "ink"} />
              </div>
              {saldos && (
                <div className="rounded-control border border-accent/30 bg-accent-soft p-3 text-[13px]">
                  <Link href={`/acopios/${saldos.acopio.id}`} className="font-mono text-[12px] font-medium hover:underline">{saldos.acopio.numero}</Link>
                  <dl className="mt-1 grid grid-cols-[1fr_auto] gap-y-1">
                    <dt className="text-muted">Saldo anterior</dt><dd className="text-right tnum">{formatMoney(saldos.antes)}</dd>
                    <dt className="text-muted">Este retiro</dt><dd className="text-right tnum">− {formatMoney(np.monto)}</dd>
                    <dt className="font-medium">Saldo posterior</dt><dd className={cn("text-right font-semibold tnum", saldos.despues < 0 && "text-danger")}>{formatMoney(saldos.despues)}</dd>
                  </dl>
                </div>
              )}
              {verMargen && rent && (
                <div className="rounded-control border border-border p-3">
                  <div className="text-[12px] text-muted">Margen bruto (costo al vender)</div>
                  <div className="flex items-baseline justify-between"><span className="text-[16px] font-semibold tnum">{formatMoney(rent.margenBruto)}</span><span className="text-[13px] text-muted tnum">{formatPercent(rent.margenPct)}</span></div>
                </div>
              )}
              {factura && (
                <button onClick={() => setVerFactura(true)} className="flex w-full items-center justify-between rounded-control border border-border px-3 py-2 text-left text-[13px] hover:bg-subtle">
                  <span><span className="block font-medium">Factura {factura.numero}</span><span className="block text-[12px] text-muted">Saldo {formatMoney(factura.saldoPendiente)}</span></span>
                  <StatusBadge tipo="COMPROBANTE" estado={factura.estado} />
                </button>
              )}
              {np.cotizacionId && <p className="text-[12px] text-muted">Desde la cotización {db.cotizaciones.find((c) => c.id === np.cotizacionId)?.numero}</p>}
              {np.forzadoSinDisponible && <Badge variant="danger">Venta forzada sin disponible</Badge>}
              {np.autorizadoSaldoNegativo && <Badge variant="danger">Retiro autorizado sin saldo</Badge>}
              {np.observaciones && <p className="text-[12px] text-muted">{np.observaciones}</p>}
            </CardContent>
          </Card>
        </aside>
      </div>

      <PrintPreview open={imprimir} onOpenChange={setImprimir} titulo={`Nota de pedido ${np.numero}`}>
        <NotaPedidoDocumento np={np} />
      </PrintPreview>
      {factura && (
        <PrintPreview open={verFactura} onOpenChange={setVerFactura} titulo={`Factura ${factura.numero}`}>
          <ComprobanteDocumento comprobante={factura} />
        </PrintPreview>
      )}
      <CobranzaDialog open={cobrar} onOpenChange={setCobrar} clienteId={np.clienteId} comprobanteId={factura?.id} />
      <DevolucionDialog np={np} open={devolver} onOpenChange={setDevolver} />
      <ProgramarEntregaDialog filas={filasPend} open={programar} onOpenChange={setProgramar} />
      {dialog}
    </div>
  );
}

/** Nueva devolución (DP) desde una NP: líneas, cantidades y motivo. */
export function DevolucionDialog({ np, open, onOpenChange }: { np: NotaPedido; open: boolean; onOpenChange: (v: boolean) => void }) {
  const db = useDb();
  const [cant, setCant] = React.useState<Record<string, number>>({});
  const [motivo, setMotivo] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setCant({});
      setMotivo("");
    }
  }, [open]);
  const total = np.items.reduce((a, i) => a + (cant[i.id] ?? 0) * i.precioUnitario * (1 - (i.descuentoPct ?? 0) / 100), 0);
  const registrar = () => {
    const r = useStore.getState().registrarDevolucion({ notaPedidoId: np.id, items: Object.entries(cant).map(([itemId, cantidad]) => ({ itemId, cantidad })), motivo });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Devolución ${r.data.numero} registrada`, { description: np.acopioId ? "El saldo del acopio volvió a subir." : r.data.remitoId ? "Se generó el remito de devolución y reingresó el stock." : undefined });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title={`Devolución de ${np.numero}`}
        description="Lo pendiente se da de baja; lo entregado reingresa con un remito de devolución (RD). Si estaba facturado se emite nota de crédito."
        footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={registrar} disabled={!total || !motivo.trim()}><Undo2 /> Registrar devolución · {formatMoney(total)}</Button></>}
      >
        <div className="space-y-3">
          <table className="w-full text-table">
            <thead className="text-[12px] text-muted">
              <tr>
                <th className="h-8 text-left font-medium">Artículo</th>
                <th className="h-8 text-right font-medium">Entregado</th>
                <th className="h-8 text-right font-medium">Pendiente</th>
                <th className="h-8 w-[120px] text-right font-medium">Devolver</th>
              </tr>
            </thead>
            <tbody>
              {np.items.map((i) => {
                const p = db.productos.find((x) => x.id === i.productoId);
                const max = i.cantidad - (i.devueltos ?? 0);
                return (
                  <tr key={i.id} className="border-t border-border">
                    <td className="py-2 pr-2">{p?.nombre}</td>
                    <td className="py-2 text-right tnum">{i.entregados}</td>
                    <td className="py-2 text-right tnum">{pendienteLinea(i)}</td>
                    <td className="py-2 pl-2"><NumberInput aria-label={`Cantidad a devolver de ${p?.nombre}`} value={cant[i.id] ?? 0} min={0} max={max} onValueChange={(v) => setCant({ ...cant, [i.id]: Math.min(max, Math.max(0, v)) })} className="h-8" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <FormField label="Motivo" required htmlFor="dev-m"><Input id="dev-m" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. sobrante de obra, material fallado…" /></FormField>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Vista imprimible de la nota de pedido (con saldo anterior/posterior si es de acopio). */
export function NotaPedidoDocumento({ np }: { np: NotaPedido }) {
  const db = useDb();
  const c = db.clientes.find((x) => x.id === np.clienteId);
  const saldos = saldosDeNP(np, db);
  const obras = [...new Set(np.items.map((i) => db.obras.find((o) => o.id === i.obraId)?.nombre).filter(Boolean))].join(" · ");
  return (
    <PrintLayout
      titulo="Nota de pedido"
      numero={np.numero}
      fecha={formatDate(np.fecha)}
      leyenda={np.circuito === 1 ? "Documento no válido como factura" : "Documento interno"}
      subtitulo={
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div><b>Cliente:</b> {c?.razonSocial} ({c?.codigo})<br />CUIT {c?.cuit || "—"} · {c?.direccion}, {c?.localidad}</div>
          <div><b>Obra:</b> {obras || "—"}<br /><b>Origen:</b> {np.origen === "ACOPIO" ? `Retiro de acopio ${saldos?.acopio.numero ?? ""}` : "Venta nueva"} · <b>Pago:</b> {FORMA_PAGO_LABEL[np.formaPago]}<br />{np.pendienteEntrega ? `Entrega pendiente${np.fechaEntregaProgramada ? ` · programada ${formatDate(np.fechaEntregaProgramada)}` : ""}` : "Entrega inmediata"}</div>
        </div>
      }
      pie={np.observaciones}
    >
      <PrintTable
        head={["Código", "Artículo", "Obra", "Cantidad", "Precio", "Subtotal"]}
        rows={np.items.map((i) => {
          const p = db.productos.find((x) => x.id === i.productoId);
          return [p?.codigo, p?.nombre, db.obras.find((o) => o.id === i.obraId)?.nombre ?? "", formatQty(i.cantidad, p?.unidad ?? "UN"), formatMoney(i.precioUnitario), formatMoney(i.subtotal)];
        })}
        foot={["", "", "", "", "Total", formatMoney(np.total)]}
      />
      {saldos && (
        <div className="ml-auto mt-4 w-72 space-y-1 border border-border p-3 text-[12px]">
          <div className="flex justify-between"><span>Saldo anterior del acopio</span><span className="tnum">{formatMoney(saldos.antes)}</span></div>
          <div className="flex justify-between"><span>Este retiro</span><span className="tnum">− {formatMoney(np.monto)}</span></div>
          <div className="flex justify-between border-t border-ink pt-1 font-semibold"><span>Saldo posterior</span><span className="tnum">{formatMoney(saldos.despues)}</span></div>
        </div>
      )}
      <div className="mt-10 grid grid-cols-2 gap-10 text-center text-[11px]">
        <div className="border-t border-ink pt-1">Firma del cliente</div>
        <div className="border-t border-ink pt-1">Vendedor · {db.usuarios.find((u) => u.id === np.vendedorId)?.nombre}</div>
      </div>
    </PrintLayout>
  );
}

