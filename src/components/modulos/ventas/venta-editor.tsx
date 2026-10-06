"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, FileText, Mail, Printer, Receipt, Save, ShieldAlert, ThumbsDown, ThumbsUp, Truck, Wallet } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useSaldosClientes } from "@/store/selectors";
import type { CondicionPago, ItemVenta, ModalidadEntrega, Pedido, Presupuesto, TipoComprobante } from "@/domain/types";
import { calcularRentabilidadItem, calcularTotales, diasCondicionPago, porcentajeDespachado, tipoFacturaPara } from "@/domain/ventas";
import { obtenerPrecio } from "@/domain/precios";
import { formatearNumeroFiscal } from "@/domain/numeracion";
import { CONDICION_PAGO_LABEL, TIPO_COMPROBANTE_LABEL, opciones } from "@/domain/estados";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ItemsGrid, type LineaBase } from "@/components/shared/items-grid";
import { Combobox } from "@/components/shared/combobox";
import { EmailDialog } from "@/components/shared/email-dialog";
import { PrintPreview } from "@/components/shared/print-layout";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Timeline, type EventoTimeline } from "@/components/shared/timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NumberInput, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney, formatPercent, formatQty } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { nombreUsuario } from "@/lib/referencias";
import { cn, newId } from "@/lib/utils";
import { CobranzaDialog } from "@/components/modulos/cuentas/cobranza-dialog";
import { ComprobanteDocumento } from "@/components/modulos/cuentas/documentos";
import { NuevoClienteDialog } from "./cliente-form";
import { PresupuestoDocumento } from "./presupuesto-documento";

type Linea = LineaBase & { costoUnitarioSnapshot: number; cantidadDespachada?: number; backorder?: number };

const aInput = (iso: string) => diaLocal(iso);
const deInput = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
};
const aLinea = (i: ItemVenta): Linea => ({ id: i.id, productoId: i.productoId, cantidad: i.cantidad, precio: i.precioUnitario, descuentoPct: i.descuentoPct, costoUnitarioSnapshot: i.costoUnitarioSnapshot, cantidadDespachada: i.cantidadDespachada, backorder: i.backorder });
const aItem = (l: Linea): ItemVenta => ({ id: l.id, productoId: l.productoId, cantidad: l.cantidad, precioUnitario: l.precio ?? 0, descuentoPct: l.descuentoPct ?? 0, costoUnitarioSnapshot: l.costoUnitarioSnapshot, cantidadDespachada: l.cantidadDespachada ?? 0, backorder: l.backorder });

export function VentaEditor({ tipo, id }: { tipo: "presupuesto" | "pedido"; id: string }) {
  const db = useDb();
  const router = useRouter();
  const saldos = useSaldosClientes();
  const usuarioId = useStore((s) => s.ui.usuarioId);
  const usuario = db.usuarios.find((u) => u.id === usuarioId);
  const verMargen = usePuede("margenes.ver");
  const puedeEditar = usePuede("ventas.editar");
  const puedeConfirmar = usePuede("ventas.confirmar");
  const puedeFacturar = usePuede("ventas.facturar");
  const puedeCobrar = usePuede("ctacte.cobrar");
  const puedeClientes = usePuede("clientes.editar");
  const { confirmar, dialog } = useConfirm();
  const esNuevo = id === "nuevo";
  const doc: Pedido | Presupuesto | undefined = esNuevo ? undefined : tipo === "pedido" ? db.pedidos.find((p) => p.id === id) : db.presupuestos.find((p) => p.id === id);
  const pedido = tipo === "pedido" ? (doc as Pedido | undefined) : undefined;
  const presupuesto = tipo === "presupuesto" ? (doc as Presupuesto | undefined) : undefined;

  const sucursalInicial = usuario?.sucursalId ?? "suc_norte";
  const [clienteId, setClienteId] = React.useState(doc?.clienteId ?? "");
  const [sucursalId, setSucursalId] = React.useState(doc?.sucursalId ?? sucursalInicial);
  const [depositoId, setDepositoId] = React.useState(pedido?.depositoId ?? db.sucursales.find((s) => s.id === sucursalInicial)?.depositoId ?? "dep_norte");
  const [vendedorId, setVendedorId] = React.useState(doc?.vendedorId ?? (usuario?.rol === "VENTAS" ? usuario.id : "usr_carla"));
  const [fecha, setFecha] = React.useState(aInput(doc?.fecha ?? new Date().toISOString()));
  const [validez, setValidez] = React.useState(presupuesto?.validezDias ?? db.config.validezPresupuestoDias);
  const [entrega, setEntrega] = React.useState(pedido?.fechaEntregaComprometida ? aInput(pedido.fechaEntregaComprometida) : aInput(addDays(new Date(), 2).toISOString()));
  const [modalidad, setModalidad] = React.useState<ModalidadEntrega>(pedido?.modalidadEntrega ?? "ENVIO");
  const [direccion, setDireccion] = React.useState(pedido?.direccionEntrega ?? "");
  const [condicion, setCondicion] = React.useState<CondicionPago>(pedido?.condicionPago ?? "CONTADO");
  const [descuento, setDescuento] = React.useState(doc?.descuentoPct ?? 0);
  const [obs, setObs] = React.useState(doc?.observaciones ?? "");
  const [items, setItems] = React.useState<Linea[]>(() => (doc?.items ?? []).map(aLinea));
  const [nuevoCliente, setNuevoCliente] = React.useState(false);
  const [imprimir, setImprimir] = React.useState(false);
  const [email, setEmail] = React.useState(false);
  const [facturar, setFacturar] = React.useState(false);
  const [cobrar, setCobrar] = React.useState<{ comprobanteId?: string } | null>(null);
  const [verFactura, setVerFactura] = React.useState(false);
  const [validacion, setValidacion] = React.useState<ReturnType<typeof useStore.getState>["validarConfirmacion"] extends (id: string) => infer R ? R | null : null>(null);

  React.useEffect(() => {
    if (doc) setItems(doc.items.map(aLinea));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.actualizadoEn]);

  const cliente = db.clientes.find((c) => c.id === clienteId);
  const listaId = cliente?.listaPreciosId ?? "lst_pub";
  const editable = puedeEditar && (esNuevo || doc?.estado === "BORRADOR" || (tipo === "presupuesto" && doc?.estado === "ENVIADO"));
  const t = calcularTotales(items.map((i) => ({ cantidad: i.cantidad, precioUnitario: i.precio ?? 0, descuentoPct: i.descuentoPct ?? 0 })), descuento, db.config.ivaPct);
  const costoDe = (l: Linea) => (l.costoUnitarioSnapshot > 0 ? l.costoUnitarioSnapshot : db.productos.find((p) => p.id === l.productoId)?.costoPromedio ?? 0);
  const costoTotal = items.reduce((a, l) => a + l.cantidad * costoDe(l), 0);
  const margen = t.neto - costoTotal;
  const vencido = presupuesto && presupuesto.estado === "ENVIADO" && diaLocal(addDays(new Date(presupuesto.fecha), presupuesto.validezDias).toISOString()) < diaLocal(new Date());
  const estadoMostrado = vencido ? "VENCIDO" : doc?.estado;

  if (!esNuevo && !doc)
    return (
      <div className="rounded-card border border-border bg-surface">
        <EmptyState titulo={`El ${tipo} no existe`} accion={<Button onClick={() => router.push(`/ventas?tab=${tipo}s`)}>Volver a ventas</Button>} />
      </div>
    );

  const elegirCliente = (v: string) => {
    setClienteId(v);
    const c = db.clientes.find((x) => x.id === v);
    if (!c) return;
    setCondicion(c.condicionPago);
    setDireccion(`${c.direccion}, ${c.localidad}`);
    if (!usuario?.sucursalId) {
      setSucursalId(c.sucursalPreferidaId);
      setDepositoId(db.sucursales.find((s) => s.id === c.sucursalPreferidaId)?.depositoId ?? depositoId);
    }
    if (c.vendedorId && usuario?.rol !== "VENTAS") setVendedorId(c.vendedorId);
    // Re-precio con la lista del cliente
    setItems((its) => its.map((i) => ({ ...i, precio: obtenerPrecio(i.productoId, c.listaPreciosId, db.precios) || i.precio })));
    if (c.tipo === "PARTICULAR") setModalidad("RETIRA");
  };

  const guardar = (silencioso = false): string | null => {
    const s = useStore.getState();
    const base = { clienteId, sucursalId, vendedorId, fecha: deInput(fecha), items: items.map(aItem), descuentoPct: descuento, observaciones: obs || undefined };
    const r =
      tipo === "presupuesto"
        ? s.guardarPresupuesto({ ...base, validezDias: validez }, doc?.id)
        : s.guardarPedido({ ...base, depositoId, fechaEntregaComprometida: deInput(entrega), condicionPago: condicion, modalidadEntrega: modalidad, direccionEntrega: modalidad === "ENVIO" ? direccion : undefined }, doc?.id);
    if (!r.ok) {
      toast.error(r.error);
      return null;
    }
    if (!silencioso) toast.success(esNuevo ? `${tipo === "pedido" ? "Pedido" : "Presupuesto"} creado` : "Cambios guardados");
    if (esNuevo) router.replace(`/ventas/${tipo}s/${r.data}`);
    return r.data;
  };

  const ejecutar = (r: { ok: boolean; error?: string; codigo?: string }, msg: string) => {
    if (r.ok) toast.success(msg);
    else toast.error(r.error);
    return r.ok;
  };

  const intentarConfirmar = () => {
    const pid = guardar(true);
    if (!pid) return;
    const v = useStore.getState().validarConfirmacion(pid);
    if (v.faltantes.length || v.credito.excede) setValidacion(v);
    else if (ejecutar(useStore.getState().confirmarPedido(pid), "Pedido confirmado: stock comprometido y costos congelados")) router.replace(`/ventas/pedidos/${pid}`);
  };

  const avisoPrecio = (l: Linea) => {
    const p = db.productos.find((x) => x.id === l.productoId);
    if (!p) return undefined;
    if (pedido && l.backorder) return { texto: `Backorder: faltaban ${formatQty(l.backorder, p.unidad)} al confirmar`, tono: "warning" as const };
    const lista = obtenerPrecio(p.id, listaId, db.precios);
    const precio = (l.precio ?? 0) * (1 - (l.descuentoPct ?? 0) / 100) * (1 - descuento / 100);
    if (precio < p.costoPromedio * 1.05)
      return { texto: verMargen ? `Precio por debajo del costo promedio + 5 % (${formatMoney(p.costoPromedio * 1.05)})` : "Precio por debajo del mínimo permitido", tono: "danger" as const };
    if (lista && precio < lista - 0.01) return { texto: `${formatPercent((lista - precio) / lista)} de descuento sobre lista (${formatMoney(lista)})`, tono: "muted" as const };
    return undefined;
  };

  const pendienteProgramar = pedido ? useStore.getState().pendientesDePedido(pedido.id).reduce((a, x) => a + x.pendiente, 0) : 0;
  const comprobante = pedido?.comprobanteId ? db.comprobantes.find((c) => c.id === pedido.comprobanteId) : undefined;
  const saldo = cliente ? saldos.get(cliente.id) : undefined;

  return (
    <div>
      <Link href={`/ventas?tab=${tipo}s`} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {tipo === "pedido" ? "Pedidos" : "Presupuestos"}
      </Link>
      <PageHeader
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            {doc ? `${tipo === "pedido" ? "Pedido" : "Presupuesto"} ${doc.numero}` : tipo === "pedido" ? "Nuevo pedido" : "Nuevo presupuesto"}
            {estadoMostrado && <StatusBadge tipo={tipo === "pedido" ? "PEDIDO" : "PRESUPUESTO"} estado={estadoMostrado} />}
            {pedido?.excepcionCredito && <Badge variant="warning"><ShieldAlert className="size-3" />Excepción de crédito</Badge>}
          </span>
        }
        descripcion={doc ? `${cliente?.razonSocial ?? ""} · ${formatDate(doc.fecha)} · vendedor ${nombreUsuario(db, doc.vendedorId)}` : "Cargá el cliente y los productos"}
        acciones={
          doc && (
            <Button variant="secondary" onClick={() => setImprimir(true)}>
              <Printer /> Imprimir
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cabecera</CardTitle>
              {cliente && saldo && saldo.vencido > 0 && <Badge variant="danger">Deuda vencida {formatMoney(saldo.vencido, { compact: true })}</Badge>}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Cliente" required className="sm:col-span-2 lg:col-span-1">
                <Combobox
                  aria-label="Cliente"
                  disabled={!editable}
                  value={clienteId}
                  onChange={elegirCliente}
                  placeholder="Buscar cliente…"
                  opciones={db.clientes.filter((c) => c.activo).map((c) => ({ value: c.id, label: c.nombreFantasia ?? c.razonSocial, detalle: c.cuit, buscar: c.razonSocial }))}
                  accionNuevo={puedeClientes ? { label: "Nuevo cliente", onSelect: () => setNuevoCliente(true) } : undefined}
                />
              </FormField>
              <FormField label="Sucursal">
                <Select disabled={!editable || !!usuario?.sucursalId} value={sucursalId} onValueChange={(v) => { setSucursalId(v); setDepositoId(db.sucursales.find((s) => s.id === v)?.depositoId ?? depositoId); }} options={db.sucursales.map((s) => ({ value: s.id, label: s.nombre }))} />
              </FormField>
              <FormField label="Vendedor">
                <Select disabled={!editable || usuario?.rol === "VENTAS"} value={vendedorId} onValueChange={setVendedorId} options={db.usuarios.filter((u) => u.rol === "VENTAS" || u.rol === "DUENO").map((u) => ({ value: u.id, label: u.nombre }))} />
              </FormField>
              <FormField label="Fecha" htmlFor="v-fecha">
                <Input id="v-fecha" type="date" disabled={!editable} value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </FormField>
              {tipo === "presupuesto" ? (
                <FormField label="Validez (días)" htmlFor="v-validez" hint={`Vence el ${formatDate(addDays(new Date(deInput(fecha)), validez))}`}>
                  <NumberInput id="v-validez" disabled={!editable} value={validez} min={1} onValueChange={(v) => setValidez(Math.round(v))} />
                </FormField>
              ) : (
                <>
                  <FormField label="Depósito que despacha">
                    <Select disabled={!editable} value={depositoId} onValueChange={setDepositoId} options={db.depositos.map((d) => ({ value: d.id, label: d.nombre }))} />
                  </FormField>
                  <FormField label="Entrega comprometida" htmlFor="v-entrega">
                    <Input id="v-entrega" type="date" disabled={!editable} value={entrega} onChange={(e) => setEntrega(e.target.value)} />
                  </FormField>
                  <FormField label="Modalidad">
                    <Select disabled={!editable} value={modalidad} onValueChange={(v) => setModalidad(v as ModalidadEntrega)} options={[{ value: "ENVIO", label: "Envío a obra" }, { value: "RETIRA", label: "Retira en mostrador" }]} />
                  </FormField>
                  <FormField label="Condición de pago">
                    <Select disabled={!editable} value={condicion} onValueChange={(v) => setCondicion(v as CondicionPago)} options={opciones(CONDICION_PAGO_LABEL)} />
                  </FormField>
                  {modalidad === "ENVIO" && (
                    <FormField label="Dirección de entrega" htmlFor="v-dir" className="sm:col-span-2 lg:col-span-1">
                      <Input id="v-dir" disabled={!editable} value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                    </FormField>
                  )}
                </>
              )}
              <FormField label="Observaciones" htmlFor="v-obs" className="sm:col-span-2 lg:col-span-3">
                <Textarea id="v-obs" disabled={!editable} value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
              {cliente && <span className="text-[12px] text-muted">Lista {db.listasPrecios.find((l) => l.id === listaId)?.nombre}</span>}
            </CardHeader>
            <CardContent>
              <ItemsGrid
                items={items}
                onChange={setItems}
                readOnly={!editable}
                crearItem={(p) => ({ id: newId("itv"), productoId: p.id, cantidad: 1, precio: obtenerPrecio(p.id, listaId, db.precios), descuentoPct: 0, costoUnitarioSnapshot: 0 })}
                depositoId={tipo === "pedido" && editable ? depositoId : undefined}
                listaId={listaId}
                avisoLinea={avisoPrecio}
                totales={{ descuentoPct: descuento, ivaPct: db.config.ivaPct, onDescuentoChange: editable ? setDescuento : undefined }}
                vacio={clienteId ? "Agregá productos con el buscador." : "Elegí primero el cliente para usar su lista de precios."}
              />
            </CardContent>
          </Card>

          {pedido && pedido.estado !== "BORRADOR" && (
            <Tabs defaultValue="rentabilidad">
              <TabsList>
                {verMargen && <TabsTrigger value="rentabilidad">Rentabilidad</TabsTrigger>}
                <TabsTrigger value="despachos">Despachos</TabsTrigger>
                <TabsTrigger value="historial">Historial</TabsTrigger>
              </TabsList>
              {verMargen && (
                <TabsContent value="rentabilidad" className="pt-3">
                  <RentabilidadPedido pedido={pedido} />
                </TabsContent>
              )}
              <TabsContent value="despachos" className="pt-3">
                <DespachosPedido pedido={pedido} />
              </TabsContent>
              <TabsContent value="historial" className="pt-3">
                <Card>
                  <CardContent>
                    <Timeline eventos={eventosPedido(db, pedido)} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px]">
                <dt className="text-muted">Subtotal</dt>
                <dd className="text-right tnum">{formatMoney(t.subtotal)}</dd>
                {t.descuento > 0 && (
                  <>
                    <dt className="text-muted">Descuento {descuento} %</dt>
                    <dd className="text-right tnum">− {formatMoney(t.descuento)}</dd>
                  </>
                )}
                <dt className="text-muted">IVA {db.config.ivaPct} %</dt>
                <dd className="text-right tnum">{formatMoney(t.iva)}</dd>
                <dt className="border-t border-border pt-1.5 font-semibold">Total</dt>
                <dd className="border-t border-border pt-1.5 text-right text-[16px] font-semibold tnum">{formatMoney(t.total)}</dd>
              </dl>
              {verMargen && items.length > 0 && (
                <div className="rounded-control border border-accent/30 bg-accent-soft p-3">
                  <div className="text-[12px] text-accent">{pedido && pedido.estado !== "BORRADOR" ? "Margen bruto (costo al momento de la venta)" : "Margen estimado al costo de hoy"}</div>
                  <div className="mt-0.5 flex items-baseline justify-between">
                    <span className="text-[18px] font-semibold text-ink tnum">{formatMoney(margen)}</span>
                    <span className={cn("text-[14px] font-semibold tnum", margen < 0 ? "text-danger" : "text-accent")}>{formatPercent(t.neto ? margen / t.neto : 0)}</span>
                  </div>
                </div>
              )}
              {pedido && pedido.estado !== "BORRADOR" && (
                <div>
                  <div className="mb-1 flex justify-between text-[12px] text-muted">
                    <span>Despachado</span>
                    <span className="tnum">{Math.round(porcentajeDespachado(pedido) * 100)} %</span>
                  </div>
                  <Progress value={porcentajeDespachado(pedido)} tone={porcentajeDespachado(pedido) >= 1 ? "success" : "ink"} />
                </div>
              )}
              {comprobante && (
                <button onClick={() => setVerFactura(true)} className="flex w-full items-center justify-between rounded-control border border-border px-3 py-2 text-left text-[13px] hover:bg-subtle">
                  <span>
                    <span className="block font-medium">{TIPO_COMPROBANTE_LABEL[comprobante.tipo]} {comprobante.numero}</span>
                    <span className="block text-[12px] text-muted">Saldo {formatMoney(comprobante.saldoPendiente)}</span>
                  </span>
                  <StatusBadge tipo="COMPROBANTE" estado={comprobante.estado} />
                </button>
              )}

              <div className="flex flex-col gap-2">
                {editable && (
                  <Button variant={tipo === "pedido" && doc ? "secondary" : "primary"} onClick={() => guardar()} disabled={!clienteId || !items.length}>
                    <Save /> {esNuevo ? "Guardar borrador" : "Guardar cambios"}
                  </Button>
                )}
                {/* Presupuesto */}
                {presupuesto && !presupuesto.pedidoId && puedeEditar && (
                  <>
                    {(presupuesto.estado === "BORRADOR" || presupuesto.estado === "ENVIADO") && (
                      <Button variant="secondary" onClick={() => guardar(true) && setEmail(true)}>
                        <Mail /> {presupuesto.estado === "ENVIADO" ? "Reenviar" : "Enviar"} al cliente
                      </Button>
                    )}
                    {(presupuesto.estado === "ENVIADO" || presupuesto.estado === "BORRADOR") && !vencido && (
                      <Button variant="secondary" onClick={() => ejecutar(useStore.getState().cambiarEstadoPresupuesto(presupuesto.id, "ACEPTADO"), "Presupuesto marcado como aceptado")}>
                        <ThumbsUp /> Marcar aceptado
                      </Button>
                    )}
                    {presupuesto.estado === "ACEPTADO" && (
                      <Button
                        onClick={() => {
                          const r = useStore.getState().convertirEnPedido(presupuesto.id);
                          if (r.ok) {
                            toast.success("Pedido creado desde el presupuesto", { description: "Revisá entrega y condición, y confirmalo." });
                            router.push(`/ventas/pedidos/${r.data}`);
                          } else toast.error(r.error);
                        }}
                      >
                        <FileText /> Convertir en pedido
                      </Button>
                    )}
                    {presupuesto.estado !== "RECHAZADO" && presupuesto.estado !== "ACEPTADO" && (
                      <Button variant="ghost" onClick={() => ejecutar(useStore.getState().cambiarEstadoPresupuesto(presupuesto.id, "RECHAZADO"), "Presupuesto rechazado")}>
                        <ThumbsDown /> Rechazar
                      </Button>
                    )}
                  </>
                )}
                {presupuesto?.pedidoId && (
                  <Button variant="secondary" onClick={() => router.push(`/ventas/pedidos/${presupuesto.pedidoId}`)}>
                    <FileText /> Ver pedido {db.pedidos.find((p) => p.id === presupuesto.pedidoId)?.numero}
                  </Button>
                )}
                {/* Pedido */}
                {tipo === "pedido" && (esNuevo || pedido?.estado === "BORRADOR") && puedeConfirmar && (
                  <Button onClick={intentarConfirmar} disabled={!clienteId || !items.length}>
                    <CheckCircle2 /> Confirmar pedido
                  </Button>
                )}
                {pedido && pedido.estado !== "BORRADOR" && pedido.estado !== "CANCELADO" && (
                  <>
                    {pendienteProgramar > 0 && puedeEditar && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const r = useStore.getState().generarDespachoPedido(pedido.id);
                          if (r.ok) toast.success(`Despacho ${r.data.numero} generado`, { description: "Queda pendiente en el módulo de despachos.", action: { label: "Ver", onClick: () => router.push(`/despachos?despacho=${r.data.despachoId}`) } });
                          else toast.error(r.error);
                        }}
                      >
                        <Truck /> Generar despacho
                      </Button>
                    )}
                    {!pedido.comprobanteId && puedeFacturar && (
                      <Button onClick={() => setFacturar(true)}>
                        <Receipt /> Facturar
                      </Button>
                    )}
                    {comprobante && comprobante.saldoPendiente > 0.009 && puedeCobrar && (
                      <Button variant="secondary" onClick={() => setCobrar({ comprobanteId: comprobante.id })}>
                        <Wallet /> Registrar cobro
                      </Button>
                    )}
                    {!pedido.comprobanteId && !pedido.items.some((i) => (i.cantidadDespachada ?? 0) > 0) && puedeEditar && (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          confirmar({
                            titulo: `Cancelar ${pedido.numero}`,
                            descripcion: "Se libera el stock comprometido y se cancelan los despachos pendientes.",
                            confirmLabel: "Cancelar pedido",
                            variant: "danger",
                            onConfirm: () => {
                              ejecutar(useStore.getState().cancelarPedido(pedido.id), "Pedido cancelado");
                            },
                          })
                        }
                      >
                        <Ban /> Cancelar pedido
                      </Button>
                    )}
                  </>
                )}
                {pedido?.presupuestoId && (
                  <Link href={`/ventas/presupuestos/${pedido.presupuestoId}`} className="text-center text-[12px] text-muted underline-offset-2 hover:underline">
                    Generado desde {db.presupuestos.find((p) => p.id === pedido.presupuestoId)?.numero}
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <NuevoClienteDialog open={nuevoCliente} onOpenChange={setNuevoCliente} onCreado={elegirCliente} />
      {doc && (
        <PrintPreview open={imprimir} onOpenChange={setImprimir} titulo={`${tipo === "pedido" ? "Pedido" : "Presupuesto"} ${doc.numero}`}>
          <PresupuestoDocumento doc={doc} tipo={tipo} />
        </PrintPreview>
      )}
      {presupuesto && (
        <EmailDialog
          open={email}
          onOpenChange={setEmail}
          para={cliente?.email ?? ""}
          asunto={`Presupuesto ${presupuesto.numero} · ${db.config.empresa.empresa}`}
          mensaje={`Hola ${cliente?.nombreFantasia ?? cliente?.razonSocial ?? ""},\n\nTe enviamos el presupuesto ${presupuesto.numero} por ${formatMoney(presupuesto.total)} (IVA incluido), válido por ${presupuesto.validezDias} días.\n\nCualquier consulta, estamos a disposición.\n\n${usuario?.nombre ?? ""}\n${db.config.empresa.empresa}`}
          adjunto={`${presupuesto.numero}.pdf`}
          documento={<PresupuestoDocumento doc={presupuesto} tipo="presupuesto" />}
          onEnviado={() => useStore.getState().cambiarEstadoPresupuesto(presupuesto.id, "ENVIADO")}
        />
      )}
      {pedido && (
        <FacturarDialog
          pedido={pedido}
          open={facturar}
          onOpenChange={setFacturar}
          onFacturado={(cid, cobrarAhora) => {
            if (cobrarAhora) setCobrar({ comprobanteId: cid });
          }}
        />
      )}
      <CobranzaDialog open={!!cobrar} onOpenChange={(v) => !v && setCobrar(null)} clienteId={clienteId} comprobanteId={cobrar?.comprobanteId} />
      {comprobante && (
        <PrintPreview open={verFactura} onOpenChange={setVerFactura} titulo={`${TIPO_COMPROBANTE_LABEL[comprobante.tipo]} ${comprobante.numero}`}>
          <ComprobanteDocumento comprobante={comprobante} />
        </PrintPreview>
      )}

      {/* Validaciones al confirmar */}
      <Dialog open={!!validacion} onOpenChange={(v) => !v && setValidacion(null)}>
        {validacion && pedido && (
          <DialogContent
            size="lg"
            title="Revisá antes de confirmar"
            footer={
              <>
                <Button variant="secondary" onClick={() => setValidacion(null)}>Volver</Button>
                {(!validacion.credito.excede || usuario?.rol === "DUENO" || usuario?.rol === "ADMINISTRACION") && (
                  <Button
                    onClick={() => {
                      const ok = ejecutar(useStore.getState().confirmarPedido(pedido.id, { permitirBackorder: true, autorizarExcepcion: true }), validacion.credito.excede ? "Pedido confirmado con excepción de crédito (queda en auditoría)" : "Pedido confirmado con backorder");
                      if (ok) setValidacion(null);
                    }}
                  >
                    {validacion.credito.excede ? <ShieldAlert /> : <CheckCircle2 />}
                    {validacion.credito.excede ? "Autorizar excepción y confirmar" : "Confirmar igual, queda en backorder"}
                  </Button>
                )}
              </>
            }
          >
            <div className="space-y-4 text-[13px]">
              {validacion.faltantes.length > 0 && (
                <div className="rounded-card border border-warning/30 bg-warning-soft p-3">
                  <p className="mb-2 flex items-center gap-2 font-medium text-warning"><AlertTriangle className="size-4" /> No alcanza el disponible en {db.depositos.find((d) => d.id === depositoId)?.nombre}</p>
                  <ul className="space-y-1">
                    {validacion.faltantes.map((f) => {
                      const p = db.productos.find((x) => x.id === f.productoId)!;
                      return (
                        <li key={f.itemId} className="flex justify-between gap-3">
                          <span>{p.nombre}</span>
                          <span className="tnum">pide {formatQty(f.pedido, p.unidad)} · disp. {formatQty(f.disponible, p.unidad)} · <b>falta {formatQty(f.faltante, p.unidad)}</b></span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 text-[12px] text-muted">Si confirmás igual, el faltante queda marcado en la línea como backorder y se despacha cuando ingrese la mercadería.</p>
                </div>
              )}
              {validacion.credito.excede && (
                <div className="rounded-card border border-danger/30 bg-danger-soft p-3">
                  <p className="mb-1 flex items-center gap-2 font-medium text-danger"><ShieldAlert className="size-4" /> El cliente supera su límite de crédito</p>
                  <p>Saldo actual {formatMoney(validacion.credito.saldo)} + este pedido {formatMoney(validacion.credito.total)} = <b>{formatMoney(validacion.credito.saldo + validacion.credito.total)}</b>, límite {formatMoney(validacion.credito.limite)}.</p>
                  {usuario?.rol === "VENTAS" || usuario?.rol === "DEPOSITO" ? (
                    <p className="mt-2 font-medium">Tu usuario no puede autorizar la excepción: pedile a Administración o al Dueño que lo confirme.</p>
                  ) : (
                    <p className="mt-2 text-[12px] text-muted">Como {usuario?.rol === "DUENO" ? "Dueño" : "Administración"} podés autorizar la excepción. Queda registrada en la auditoría.</p>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
      {dialog}
    </div>
  );
}


function RentabilidadPedido({ pedido }: { pedido: Pedido }) {
  const db = useDb();
  let ing = 0, cos = 0, cosAct = 0;
  const filas = pedido.items.map((i) => {
    const p = db.productos.find((x) => x.id === i.productoId)!;
    const r = calcularRentabilidadItem(i, pedido.descuentoPct);
    const rAct = calcularRentabilidadItem(i, pedido.descuentoPct, p.costoUltimo);
    ing += r.ingreso;
    cos += r.costo;
    cosAct += rAct.costo;
    return { i, p, r, rAct, variacion: i.costoUnitarioSnapshot ? (p.costoUltimo - i.costoUnitarioSnapshot) / i.costoUnitarioSnapshot : 0 };
  });
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-table">
          <thead className="bg-[#FAFAF8]">
            <tr className="text-[12px] text-muted">
              <th className="h-9 px-3 text-left font-medium">Producto</th>
              <th className="h-9 px-3 text-right font-medium">Cant.</th>
              <th className="h-9 px-3 text-right font-medium">Precio neto</th>
              <th className="h-9 px-3 text-right font-medium">Costo snapshot</th>
              <th className="h-9 px-3 text-right font-medium">Costo actual</th>
              <th className="h-9 px-3 text-right font-medium">Variación de costo desde la venta</th>
              <th className="h-9 px-3 text-right font-medium">Margen $</th>
              <th className="h-9 px-3 text-right font-medium">Margen %</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ i, p, r, variacion }) => (
              <tr key={i.id} className="h-10 border-t border-border">
                <td className="px-3">{p.nombre}</td>
                <td className="px-3 text-right tnum">{formatQty(i.cantidad, p.unidad).split(" ")[0]}</td>
                <td className="px-3 text-right tnum">{formatMoney(r.ingreso / i.cantidad)}</td>
                <td className="px-3 text-right tnum">{formatMoney(i.costoUnitarioSnapshot)}</td>
                <td className="px-3 text-right text-muted tnum">{formatMoney(p.costoUltimo)}</td>
                <td className={cn("px-3 text-right tnum", variacion > 0.005 ? "text-danger" : variacion < -0.005 ? "text-success" : "text-muted")}>{formatPercent(variacion, { signo: true })}</td>
                <td className="px-3 text-right font-medium tnum">{formatMoney(r.margenBruto)}</td>
                <td className={cn("px-3 text-right tnum", r.margenPct < 0.1 ? "text-danger" : "text-ink")}>{formatPercent(r.margenPct)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="h-10 border-t border-border-strong bg-[#FAFAF8] font-semibold">
              <td className="px-3" colSpan={6}>Total del pedido</td>
              <td className="px-3 text-right text-accent tnum">{formatMoney(ing - cos)}</td>
              <td className="px-3 text-right tnum">{formatPercent(ing ? (ing - cos) / ing : 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="border-t border-border px-4 py-3 text-[12px] text-muted">
        El margen se calcula con el costo congelado al confirmar el pedido. Si vendieras hoy con el costo de reposición actual, el margen sería{" "}
        <b className={cn(ing - cosAct < ing - cos ? "text-danger" : "text-success")}>{formatMoney(ing - cosAct)} ({formatPercent(ing ? (ing - cosAct) / ing : 0)})</b>.
      </p>
    </Card>
  );
}

function DespachosPedido({ pedido }: { pedido: Pedido }) {
  const db = useDb();
  const ds = db.despachos.filter((d) => d.origenTipo === "PEDIDO" && d.origenId === pedido.id);
  if (!ds.length) return <Card><EmptyState icono={Truck} titulo="Todavía no se generaron despachos" /></Card>;
  return (
    <Card>
      <ul className="divide-y divide-border">
        {ds.map((d) => (
          <li key={d.id}>
            <Link href={`/despachos?despacho=${d.id}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-[#FAFAF8]">
              <span className="font-mono text-[12px]">{d.numero}</span>
              <span className="flex-1 text-muted">programado {formatDate(d.fechaProgramada)}{d.fechaEntrega && ` · entregado ${formatDate(d.fechaEntrega)}`}</span>
              <span className="text-muted">{d.items.length} ítems</span>
              <StatusBadge tipo="DESPACHO" estado={d.estado} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function eventosPedido(db: ReturnType<typeof useDb>, p: Pedido): EventoTimeline[] {
  const ev: EventoTimeline[] = [{ id: "creado", fecha: p.fecha, accion: "Pedido creado", usuario: nombreUsuario(db, p.vendedorId) }];
  if (p.presupuestoId) ev.push({ id: "pre", fecha: p.fecha, accion: `Generado desde ${db.presupuestos.find((x) => x.id === p.presupuestoId)?.numero}` });
  if (p.fechaConfirmacion) ev.push({ id: "conf", fecha: p.fechaConfirmacion, accion: "Pedido confirmado", detalle: "Stock comprometido y costos congelados", usuario: nombreUsuario(db, p.vendedorId), destacado: true });
  for (const d of db.despachos.filter((x) => x.origenTipo === "PEDIDO" && x.origenId === p.id)) {
    ev.push({ id: `${d.id}-g`, fecha: d.creadoEn, accion: `Despacho generado ${d.numero}` });
    if (d.fechaSalida && d.estado !== "RETIRADO_EN_MOSTRADOR") ev.push({ id: `${d.id}-s`, fecha: d.fechaSalida, accion: `Salió en viaje ${d.numero}`, detalle: db.vehiculos.find((v) => v.id === d.vehiculoId)?.patente });
    if (d.fechaEntrega) ev.push({ id: `${d.id}-e`, fecha: d.fechaEntrega, accion: d.estado === "RETIRADO_EN_MOSTRADOR" ? `Retirado en mostrador ${d.numero}` : `Entregado ${d.numero}`, detalle: d.firmaRecibido ? `Recibió: ${d.firmaRecibido}` : undefined, destacado: true });
    if (d.estado === "CANCELADO") ev.push({ id: `${d.id}-c`, fecha: d.actualizadoEn, accion: `Despacho cancelado ${d.numero}` });
  }
  const c = db.comprobantes.find((x) => x.id === p.comprobanteId);
  if (c) {
    ev.push({ id: "fact", fecha: c.fecha, accion: `Facturado: ${TIPO_COMPROBANTE_LABEL[c.tipo]} ${c.numero}`, detalle: formatMoney(c.total), destacado: true });
    for (const cob of db.cobranzas.filter((x) => x.imputaciones.some((i) => i.comprobanteId === c.id)))
      ev.push({ id: cob.id, fecha: cob.fecha, accion: `Cobrado: recibo ${cob.numero}`, detalle: formatMoney(cob.imputaciones.find((i) => i.comprobanteId === c.id)?.importe ?? 0), usuario: nombreUsuario(db, cob.usuarioId) });
  }
  for (const nc of db.comprobantes.filter((x) => x.tipo === "NOTA_CREDITO" && x.pedidoId === p.id)) ev.push({ id: nc.id, fecha: nc.fecha, accion: `Nota de crédito ${nc.numero}`, detalle: nc.observaciones });
  const vistos = new Set(["Creó pedido", "Confirmó pedido", "Facturó pedido", "Generó despacho"]);
  for (const a of db.auditoria.filter((x) => x.entidadId === p.id && !vistos.has(x.accion))) ev.push({ id: a.id, fecha: a.fecha, accion: a.accion, detalle: a.detalle, usuario: nombreUsuario(db, a.usuarioId) });
  return ev;
}

function FacturarDialog({ pedido, open, onOpenChange, onFacturado }: { pedido: Pedido; open: boolean; onOpenChange: (v: boolean) => void; onFacturado: (comprobanteId: string, cobrarAhora: boolean) => void }) {
  const db = useDb();
  const cliente = db.clientes.find((c) => c.id === pedido.clienteId)!;
  const suc = db.sucursales.find((s) => s.id === pedido.sucursalId)!;
  const [tipo, setTipo] = React.useState<TipoComprobante>(tipoFacturaPara(cliente.condicionIVA));
  const [fecha, setFecha] = React.useState(aInput(new Date().toISOString()));
  const [venc, setVenc] = React.useState(aInput(addDays(new Date(), diasCondicionPago(pedido.condicionPago)).toISOString()));
  const [cobrar, setCobrar] = React.useState(pedido.condicionPago === "CONTADO");
  React.useEffect(() => {
    if (open) {
      setTipo(tipoFacturaPara(cliente.condicionIVA));
      setCobrar(pedido.condicionPago === "CONTADO");
    }
  }, [open, cliente.condicionIVA, pedido.condicionPago]);
  const siguiente = formatearNumeroFiscal(suc.puntoVenta, (db.numeradores.fiscal[suc.puntoVenta]?.[tipo] ?? 0) + 1);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Facturar ${pedido.numero}`}
        description={`${cliente.razonSocial} · ${formatMoney(pedido.total)} IVA incluido`}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                const r = useStore.getState().facturarPedido(pedido.id, { tipo, fecha: deInput(fecha), vencimiento: deInput(venc) });
                if (!r.ok) return toast.error(r.error);
                toast.success(`${TIPO_COMPROBANTE_LABEL[tipo]} ${siguiente} emitida`, { description: "Comprobante no fiscal · Demo" });
                onOpenChange(false);
                onFacturado(r.data, cobrar);
              }}
            >
              <Receipt /> Emitir comprobante
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Tipo de comprobante" hint={`Cliente ${cliente.condicionIVA === "RI" ? "responsable inscripto → Factura A" : "no inscripto → Factura B"}`}>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoComprobante)} options={[{ value: "FACTURA_A", label: "Factura A" }, { value: "FACTURA_B", label: "Factura B" }]} />
          </FormField>
          <FormField label="Punto de venta · número">
            <Input disabled value={`${suc.nombre} · ${siguiente}`} />
          </FormField>
          <FormField label="Fecha" htmlFor="f-fecha">
            <Input id="f-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </FormField>
          <FormField label="Vencimiento" htmlFor="f-venc" hint={CONDICION_PAGO_LABEL[pedido.condicionPago]}>
            <Input id="f-venc" type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
          </FormField>
        </div>
        <label className="mt-4 flex items-center gap-2 text-[13px]">
          <Checkbox checked={cobrar} onCheckedChange={(v) => setCobrar(!!v)} /> Registrar cobro ahora
        </label>
        <p className="mt-3 rounded-control border border-border bg-subtle px-3 py-2 text-[12px] text-muted">Demo: el comprobante no se envía a AFIP/ARCA y la impresión lleva la leyenda “Comprobante no fiscal · Demo”.</p>
      </DialogContent>
    </Dialog>
  );
}
