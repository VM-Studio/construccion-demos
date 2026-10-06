"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Ban, CheckCircle2, Info, Mail, PackageCheck, Printer, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePosiciones, usePuede } from "@/store/selectors";
import type { ItemOC } from "@/domain/types";
import { cantidadReposicion } from "@/domain/productos";
import { CONDICION_PAGO_LABEL } from "@/domain/estados";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ItemsGrid, type LineaBase } from "@/components/shared/items-grid";
import { Combobox } from "@/components/shared/combobox";
import { EmailDialog } from "@/components/shared/email-dialog";
import { PrintPreview } from "@/components/shared/print-layout";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Tooltip } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime, formatMoney, formatQty } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { newId } from "@/lib/utils";
import { totalesOC } from "@/store/slices/compras";
import { OCDocumento } from "./oc-documento";
import { RecepcionDialog } from "./recepcion-dialog";

type Linea = LineaBase & { cantidadRecibida: number };

const aInput = (iso: string) => diaLocal(iso);
const deInput = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
};

export function OCEditor({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const posiciones = usePosiciones();
  const esNueva = id === "nueva";
  const oc = esNueva ? undefined : db.ordenesCompra.find((o) => o.id === id);
  const usuario = db.usuarios.find((u) => u.id === useStore.getState().ui.usuarioId);
  const acciones = useStore.getState();
  const puedeEditar = usePuede("compras.editar");
  const puedeConfirmar = usePuede("compras.confirmar");
  const puedeRecibir = usePuede("compras.recibir");
  const verCostos = usePuede("margenes.ver");
  const { confirmar, dialog } = useConfirm();
  const [imprimir, setImprimir] = React.useState(false);
  const [email, setEmail] = React.useState(false);
  const [recibir, setRecibir] = React.useState(false);

  const sucursalUsuario = usuario?.sucursalId ?? "suc_central";
  const [proveedorId, setProveedorId] = React.useState(oc?.proveedorId ?? "");
  const [sucursalId, setSucursalId] = React.useState(oc?.sucursalId ?? sucursalUsuario);
  const [depositoId, setDepositoId] = React.useState(oc?.depositoDestinoId ?? db.sucursales.find((s) => s.id === sucursalUsuario)?.depositoId ?? "dep_central");
  const [fecha, setFecha] = React.useState(aInput(oc?.fechaEmision ?? new Date().toISOString()));
  const [entrega, setEntrega] = React.useState(aInput(oc?.fechaEntregaEstimada ?? new Date().toISOString()));
  const [obs, setObs] = React.useState(oc?.observaciones ?? "");
  const [items, setItems] = React.useState<Linea[]>(() => (oc?.items ?? []).map((i) => ({ id: i.id, productoId: i.productoId, cantidad: i.cantidadPedida, precio: i.costoUnitario, descuentoPct: i.descuentoPct, cantidadRecibida: i.cantidadRecibida })));

  React.useEffect(() => {
    if (!oc) return;
    setItems(oc.items.map((i) => ({ id: i.id, productoId: i.productoId, cantidad: i.cantidadPedida, precio: i.costoUnitario, descuentoPct: i.descuentoPct, cantidadRecibida: i.cantidadRecibida })));
  }, [oc]);

  if (!esNueva && !oc)
    return (
      <div className="rounded-card border border-border bg-surface">
        <EmptyState titulo="La orden de compra no existe" accion={<Button onClick={() => router.push("/compras")}>Volver a compras</Button>} />
      </div>
    );

  const editable = (esNueva || oc?.estado === "BORRADOR") && puedeEditar;
  const prov = db.proveedores.find((p) => p.id === proveedorId);
  const t = totalesOC(items.map((i) => ({ id: i.id, productoId: i.productoId, cantidadPedida: i.cantidad, cantidadRecibida: 0, costoUnitario: i.precio ?? 0, descuentoPct: i.descuentoPct ?? 0 })), db.config.ivaPct);
  const recepciones = oc ? db.recepciones.filter((r) => r.ordenCompraId === oc.id) : [];
  const pedido = items.reduce((a, i) => a + i.cantidad * (i.precio ?? 0), 0);
  const recibido = items.reduce((a, i) => a + Math.min(i.cantidad, i.cantidadRecibida) * (i.precio ?? 0), 0);
  const atrasada = oc && (oc.estado === "CONFIRMADA" || oc.estado === "RECIBIDA_PARCIAL") && diaLocal(oc.fechaEntregaEstimada) < diaLocal(new Date());

  const elegirProveedor = (v: string) => {
    setProveedorId(v);
    const p = db.proveedores.find((x) => x.id === v);
    if (p) setEntrega(aInput(addDays(new Date(deInput(fecha)), p.plazoEntregaDias).toISOString()));
  };

  const sugerir = () => {
    if (!proveedorId) return toast.error("Elegí primero el proveedor.");
    const ya = new Set(items.map((i) => i.productoId));
    const nuevas: Linea[] = [];
    for (const pos of posiciones.values()) {
      const p = pos.producto;
      if (p.proveedorHabitualId !== proveedorId || !p.activo || pos.estado === "OK" || ya.has(p.id)) continue;
      const q = cantidadReposicion(p, pos.disponible, pos.enTransito);
      if (q > 0) nuevas.push({ id: newId("ioc"), productoId: p.id, cantidad: q, precio: p.costoUltimo, descuentoPct: 0, cantidadRecibida: 0 });
    }
    if (!nuevas.length) return toast.info("Este proveedor no tiene productos bajo mínimo para reponer.");
    setItems([...items, ...nuevas]);
    toast.success(`Se agregaron ${nuevas.length} productos para reponer`);
  };

  const datos = () => ({
    proveedorId,
    circuito: oc?.circuito ?? db.proveedores.find((p) => p.id === proveedorId)?.circuitoHabitual ?? 1,
    origen: oc?.origen ?? ("NUEVA" as const),
    acopioProveedorId: oc?.acopioProveedorId,
    sucursalId,
    depositoDestinoId: depositoId,
    fechaEmision: deInput(fecha),
    fechaEntregaEstimada: deInput(entrega),
    observaciones: obs || undefined,
    items: items.map<ItemOC>((i) => ({ id: i.id, productoId: i.productoId, cantidadPedida: i.cantidad, cantidadRecibida: i.cantidadRecibida, costoUnitario: i.precio ?? 0, descuentoPct: i.descuentoPct ?? 0 })),
  });

  const guardar = (silencioso = false): string | null => {
    const r = acciones.guardarOC(datos(), oc?.id);
    if (!r.ok) {
      toast.error(r.error);
      return null;
    }
    if (!silencioso) toast.success(esNueva ? "Orden de compra creada" : "Cambios guardados");
    if (esNueva) router.replace(`/compras/oc/${r.data}`);
    return r.data;
  };

  const cambiar = (estado: Parameters<typeof acciones.cambiarEstadoOC>[1], msg: string) => {
    const r = useStore.getState().cambiarEstadoOC(oc!.id, estado);
    if (r.ok) toast.success(msg);
    else toast.error(r.error);
  };

  return (
    <div>
      <Link href="/compras" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Compras
      </Link>
      <PageHeader
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            {oc ? `Orden de compra ${oc.numero}` : "Nueva orden de compra"}
            {oc && <StatusBadge tipo="OC" estado={oc.estado} />}
            {atrasada && <Badge variant="danger">Atrasada</Badge>}
          </span>
        }
        descripcion={oc ? `Emitida ${formatDate(oc.fechaEmision)} por ${db.usuarios.find((u) => u.id === oc.usuarioId)?.nombre ?? ""}` : "Cargá los productos a pedir al proveedor"}
        acciones={
          oc && (
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
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Proveedor" required className="sm:col-span-2 lg:col-span-1">
                <Combobox
                  aria-label="Proveedor"
                  disabled={!editable}
                  value={proveedorId}
                  onChange={elegirProveedor}
                  placeholder="Buscar proveedor…"
                  opciones={db.proveedores.filter((p) => p.activo).map((p) => ({ value: p.id, label: p.razonSocial, detalle: p.cuit }))}
                />
              </FormField>
              <FormField label="Sucursal">
                <Select disabled={!editable} value={sucursalId} onValueChange={(v) => { setSucursalId(v); setDepositoId(db.sucursales.find((s) => s.id === v)?.depositoId ?? depositoId); }} options={db.sucursales.map((s) => ({ value: s.id, label: s.nombre }))} />
              </FormField>
              <FormField label="Depósito destino">
                <Select disabled={!editable} value={depositoId} onValueChange={setDepositoId} options={db.depositos.map((d) => ({ value: d.id, label: d.nombre }))} />
              </FormField>
              <FormField label="Fecha de emisión" htmlFor="oc-fecha">
                <Input id="oc-fecha" type="date" disabled={!editable} value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </FormField>
              <FormField label="Entrega estimada" htmlFor="oc-entrega" hint={prov ? `Plazo del proveedor: ${prov.plazoEntregaDias} días` : undefined} error={atrasada ? "La fecha de entrega ya pasó." : undefined}>
                <Input id="oc-entrega" type="date" disabled={!editable} value={entrega} onChange={(e) => setEntrega(e.target.value)} />
              </FormField>
              <FormField label="Condición de pago">
                <Input disabled value={prov ? CONDICION_PAGO_LABEL[prov.condicionPago] : "—"} />
              </FormField>
              <FormField label="Observaciones" htmlFor="oc-obs" className="sm:col-span-2 lg:col-span-3">
                <Textarea id="oc-obs" disabled={!editable} value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
              {editable && (
                <Tooltip content="Agrega los productos de este proveedor que están bajo stock mínimo. Cantidad = mínimo × 2 − disponible − en tránsito, redondeada a pallet completo cuando el producto se vende por pallet.">
                  <Button size="sm" variant="secondary" onClick={sugerir}>
                    <Sparkles /> Sugerir reposición
                  </Button>
                </Tooltip>
              )}
            </CardHeader>
            <CardContent>
              <ItemsGrid
                items={items}
                onChange={setItems}
                readOnly={!editable}
                crearItem={(p) => ({ id: newId("ioc"), productoId: p.id, cantidad: p.unidadesPorPallet ?? 1, precio: p.costoUltimo, descuentoPct: 0, cantidadRecibida: 0 })}
                depositoId={depositoId}
                proveedorId={proveedorId || undefined}
                mostrarCosto
                precioLabel="Costo unit."
                conPrecio={verCostos}
                extras={
                  oc && oc.estado !== "BORRADOR"
                    ? [{ header: "Recibido", width: 110, align: "right", cell: (i) => <span className="tnum text-muted">{formatQty(i.cantidadRecibida, db.productos.find((p) => p.id === i.productoId)?.unidad ?? "UN").split(" ")[0]}</span> }]
                    : []
                }
                vacio="Agregá productos con el buscador o usá “Sugerir reposición”."
              />
            </CardContent>
          </Card>

          {recepciones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recepciones vinculadas</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-border">
                {recepciones.map((r) => (
                  <li key={r.id}>
                    <Link href={`/compras?tab=recepciones&id=${r.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] hover:bg-[#FAFAF8]">
                      <span className="font-mono text-[12px]">{r.numero}</span>
                      <span className="flex-1 text-muted">Remito {r.remitoProveedor} · {formatDateTime(r.fecha)}</span>
                      <span className="text-muted">{r.items.length} ítems</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {verCostos && (
                <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px]">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="text-right tnum">{formatMoney(t.subtotal)}</dd>
                  <dt className="text-muted">IVA {db.config.ivaPct} %</dt>
                  <dd className="text-right tnum">{formatMoney(t.iva)}</dd>
                  <dt className="border-t border-border pt-1.5 font-semibold">Total</dt>
                  <dd className="border-t border-border pt-1.5 text-right text-[16px] font-semibold tnum">{formatMoney(t.total)}</dd>
                </dl>
              )}
              {oc && oc.estado !== "BORRADOR" && (
                <div>
                  <div className="mb-1 flex justify-between text-[12px] text-muted">
                    <span>Recibido</span>
                    <span className="tnum">{Math.round(pedido ? (recibido / pedido) * 100 : 0)} %</span>
                  </div>
                  <Progress value={pedido ? recibido / pedido : 0} tone={recibido >= pedido ? "success" : "ink"} />
                </div>
              )}
              <div className="flex flex-col gap-2">
                {editable && (
                  <>
                    <Button onClick={() => guardar()} disabled={!proveedorId || !items.length}>
                      <Save /> Guardar borrador
                    </Button>
                    {oc && puedeConfirmar && (
                      <Button
                        variant="secondary"
                        disabled={!items.length}
                        onClick={() => {
                          if (guardar(true)) setEmail(true);
                        }}
                      >
                        <Mail /> Enviar al proveedor
                      </Button>
                    )}
                    {oc && (
                      <Button variant="ghost" onClick={() => confirmar({ titulo: `Eliminar ${oc.numero}`, descripcion: "La orden en borrador se elimina definitivamente.", confirmLabel: "Eliminar", variant: "danger", onConfirm: () => { const r = acciones.eliminarOC(oc.id); if (r.ok) { toast.success("Orden eliminada"); router.push("/compras"); } else toast.error(r.error); } })}>
                        <Trash2 /> Eliminar
                      </Button>
                    )}
                  </>
                )}
                {oc?.estado === "ENVIADA" && puedeConfirmar && (
                  <>
                    <Button onClick={() => cambiar("CONFIRMADA", "Orden confirmada: la mercadería figura en tránsito")}>
                      <CheckCircle2 /> Confirmar
                    </Button>
                    <Button variant="secondary" onClick={() => cambiar("BORRADOR", "La orden volvió a borrador")}>
                      <RotateCcw /> Volver a borrador
                    </Button>
                    <Button variant="ghost" onClick={() => confirmar({ titulo: `Cancelar ${oc.numero}`, confirmLabel: "Cancelar orden", variant: "danger", onConfirm: () => { cambiar("CANCELADA", "Orden cancelada"); } })}>
                      <Ban /> Cancelar
                    </Button>
                  </>
                )}
                {(oc?.estado === "CONFIRMADA" || oc?.estado === "RECIBIDA_PARCIAL") && (
                  <>
                    {puedeRecibir && (
                      <Button onClick={() => setRecibir(true)}>
                        <PackageCheck /> Registrar recepción
                      </Button>
                    )}
                    {puedeEditar && (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          confirmar({
                            titulo: "Cancelar saldo pendiente",
                            descripcion: "Lo que falta recibir deja de figurar en tránsito y la orden se cierra.",
                            confirmLabel: "Cancelar saldo",
                            variant: "danger",
                            onConfirm: () => {
                              const r = acciones.cancelarSaldoOC(oc.id);
                              if (r.ok) toast.success("Saldo pendiente cancelado");
                              else toast.error(r.error);
                            },
                          })
                        }
                      >
                        <Ban /> Cancelar saldo pendiente
                      </Button>
                    )}
                  </>
                )}
                {oc?.estado === "RECIBIDA" && (
                  <p className="flex items-start gap-2 rounded-control bg-success-soft p-2.5 text-[12px] text-success">
                    <Info className="mt-0.5 size-3.5 shrink-0" /> Orden recibida completa. Sólo lectura.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {oc && (
        <>
          <PrintPreview open={imprimir} onOpenChange={setImprimir} titulo={`Orden de compra ${oc.numero}`}>
            <OCDocumento oc={oc} />
          </PrintPreview>
          <EmailDialog
            open={email}
            onOpenChange={setEmail}
            para={prov?.email ?? ""}
            asunto={`Orden de compra ${oc.numero} · ${db.config.empresa.empresa}`}
            mensaje={`Hola ${prov?.contacto ?? ""},\n\nTe enviamos la orden de compra ${oc.numero} para entregar en ${db.depositos.find((d) => d.id === depositoId)?.nombre} el ${formatDate(deInput(entrega))}.\n\nPor favor confirmanos la recepción y la fecha de entrega.\n\nSaludos,\n${usuario?.nombre ?? ""}\n${db.config.empresa.empresa}`}
            adjunto={`${oc.numero}.pdf`}
            documento={<OCDocumento oc={oc} />}
            onEnviado={() => cambiar("ENVIADA", "Orden enviada al proveedor")}
          />
          <RecepcionDialog ordenCompraId={oc.id} open={recibir} onOpenChange={setRecibir} />
        </>
      )}
      {dialog}
    </div>
  );
}
