"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Boxes } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePosiciones, usePuede } from "@/store/selectors";
import type { CondicionPago } from "@/domain/types";
import { calcularTotales, tipoFacturaPara } from "@/domain/ventas";
import { obtenerPrecio } from "@/domain/precios";
import { CONDICION_PAGO_LABEL, TIPO_COMPROBANTE_LABEL, opciones } from "@/domain/estados";
import { PageHeader } from "@/components/shared/page-header";
import { ItemsGrid, type LineaBase } from "@/components/shared/items-grid";
import { Combobox } from "@/components/shared/combobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { formatMoney, formatPercent, formatQty } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { newId } from "@/lib/utils";
import { CobranzaDialog } from "@/components/modulos/cuentas/cobranza-dialog";
import { NuevoClienteDialog } from "@/components/modulos/ventas/cliente-form";

const deInput = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
};

export function AcopioNuevo() {
  const db = useDb();
  const router = useRouter();
  const posiciones = usePosiciones();
  const usuarioId = useStore((s) => s.ui.usuarioId);
  const usuario = db.usuarios.find((u) => u.id === usuarioId);
  const verMargen = usePuede("margenes.ver");
  const puedeClientes = usePuede("clientes.editar");
  const sucInicial = usuario?.sucursalId ?? "suc_norte";
  const [clienteId, setClienteId] = React.useState("");
  const [sucursalId, setSucursalId] = React.useState(sucInicial);
  const [depositoId, setDepositoId] = React.useState(db.sucursales.find((s) => s.id === sucInicial)?.depositoId ?? "dep_norte");
  const [vendedorId, setVendedorId] = React.useState(usuario?.rol === "VENTAS" ? usuario.id : "usr_carla");
  const [inicio, setInicio] = React.useState(diaLocal(new Date()));
  const [venc, setVenc] = React.useState(diaLocal(addDays(new Date(), db.config.diasVencimientoAcopio)));
  const [condicion, setCondicion] = React.useState<CondicionPago>("ANTICIPO");
  const [obs, setObs] = React.useState("");
  const [items, setItems] = React.useState<LineaBase[]>([]);
  const [nuevoCliente, setNuevoCliente] = React.useState(false);
  const [creado, setCreado] = React.useState<{ acopioId: string; comprobanteId: string } | null>(null);

  const cliente = db.clientes.find((c) => c.id === clienteId);
  const listaId = cliente?.listaPreciosId ?? "lst_may";
  const t = calcularTotales(items.map((i) => ({ cantidad: i.cantidad, precioUnitario: i.precio ?? 0, descuentoPct: 0 })), 0, db.config.ivaPct);
  const costo = items.reduce((a, i) => a + i.cantidad * (db.productos.find((p) => p.id === i.productoId)?.costoPromedio ?? 0), 0);
  const sinStock = items.some((i) => i.cantidad > (posiciones.get(i.productoId)?.porDeposito[depositoId]?.disponible ?? 0));

  const elegirCliente = (v: string) => {
    setClienteId(v);
    const c = db.clientes.find((x) => x.id === v);
    if (!c) return;
    if (!usuario?.sucursalId) {
      setSucursalId(c.sucursalPreferidaId);
      setDepositoId(db.sucursales.find((s) => s.id === c.sucursalPreferidaId)?.depositoId ?? depositoId);
    }
    if (c.vendedorId && usuario?.rol !== "VENTAS") setVendedorId(c.vendedorId);
    setItems((its) => its.map((i) => ({ ...i, precio: obtenerPrecio(i.productoId, c.listaPreciosId, db.precios) || i.precio })));
  };

  const crear = () => {
    const r = useStore.getState().crearAcopio({
      clienteId,
      sucursalId,
      depositoId,
      vendedorId,
      fechaInicio: deInput(inicio),
      fechaVencimiento: deInput(venc),
      condicionPago: condicion,
      observaciones: obs || undefined,
      items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, precio: i.precio ?? 0 })),
    });
    if (!r.ok) return toast.error(r.error);
    const fc = useStore.getState().db.comprobantes.find((c) => c.id === r.data.comprobanteId);
    toast.success(`Acopio ${r.data.numero} creado`, { description: `${TIPO_COMPROBANTE_LABEL[fc?.tipo ?? "FACTURA_A"]} ${fc?.numero} emitida. Registrá el cobro.` });
    setCreado(r.data);
  };

  return (
    <div>
      <Link href="/acopios" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Acopios
      </Link>
      <PageHeader titulo="Nuevo acopio" descripcion="El cliente compra hoy a precio fijo y retira en partes. Se congela el costo, se compromete el stock y se factura." />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader><CardTitle>Cabecera</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Cliente" required className="sm:col-span-2 lg:col-span-1">
                <Combobox
                  aria-label="Cliente"
                  value={clienteId}
                  onChange={elegirCliente}
                  placeholder="Buscar cliente…"
                  opciones={db.clientes.filter((c) => c.activo).map((c) => ({ value: c.id, label: c.nombreFantasia ?? c.razonSocial, detalle: c.cuit, buscar: c.razonSocial }))}
                  accionNuevo={puedeClientes ? { label: "Nuevo cliente", onSelect: () => setNuevoCliente(true) } : undefined}
                />
              </FormField>
              <FormField label="Sucursal">
                <Select disabled={!!usuario?.sucursalId} value={sucursalId} onValueChange={(v) => { setSucursalId(v); setDepositoId(db.sucursales.find((s) => s.id === v)?.depositoId ?? depositoId); }} options={db.sucursales.map((s) => ({ value: s.id, label: s.nombre }))} />
              </FormField>
              <FormField label="Depósito que reserva el stock">
                <Select value={depositoId} onValueChange={setDepositoId} options={db.depositos.map((d) => ({ value: d.id, label: d.nombre }))} />
              </FormField>
              <FormField label="Vendedor">
                <Select disabled={usuario?.rol === "VENTAS"} value={vendedorId} onValueChange={setVendedorId} options={db.usuarios.filter((u) => u.rol === "VENTAS" || u.rol === "DUENO").map((u) => ({ value: u.id, label: u.nombre }))} />
              </FormField>
              <FormField label="Fecha de inicio" htmlFor="a-ini">
                <Input id="a-ini" type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); setVenc(diaLocal(addDays(new Date(deInput(e.target.value)), db.config.diasVencimientoAcopio))); }} />
              </FormField>
              <FormField label="Vencimiento" htmlFor="a-venc" hint={`Por defecto ${db.config.diasVencimientoAcopio} días (configurable)`}>
                <Input id="a-venc" type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
              </FormField>
              <FormField label="Observaciones" htmlFor="a-obs" className="sm:col-span-2 lg:col-span-3">
                <Textarea id="a-obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Ej. Obra en Nordelta, entregas coordinadas con el jefe de obra" />
              </FormField>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Productos acopiados</CardTitle>
              {cliente && <span className="text-[12px] text-muted">Precio pactado desde lista {db.listasPrecios.find((l) => l.id === listaId)?.nombre}</span>}
            </CardHeader>
            <CardContent className="space-y-3">
              <ItemsGrid
                items={items}
                onChange={setItems}
                crearItem={(p) => ({ id: newId("l"), productoId: p.id, cantidad: p.unidadesPorPallet ?? 1, precio: obtenerPrecio(p.id, listaId, db.precios) })}
                depositoId={depositoId}
                listaId={listaId}
                precioLabel="Precio pactado"
                conDescuento={false}
                avisoLinea={(i, p) => {
                  const disp = posiciones.get(p.id)?.porDeposito[depositoId]?.disponible ?? 0;
                  return i.cantidad > disp ? { texto: `Supera el disponible (${formatQty(Math.max(0, disp), p.unidad)}): se compromete contra stock futuro`, tono: "warning" } : undefined;
                }}
                totales={{ descuentoPct: 0, ivaPct: db.config.ivaPct }}
                vacio={clienteId ? "Agregá los productos que el cliente acopia." : "Elegí primero el cliente para usar su lista de precios."}
              />
              {sinStock && (
                <p className="flex items-start gap-2 rounded-control border border-warning/30 bg-warning-soft px-3 py-2 text-[12px] text-warning">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Se compromete contra stock futuro — asegurate de tener una orden de compra confirmada para cubrir el faltante.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px]">
                <dt className="text-muted">Neto</dt><dd className="text-right tnum">{formatMoney(t.neto)}</dd>
                <dt className="text-muted">IVA</dt><dd className="text-right tnum">{formatMoney(t.iva)}</dd>
                <dt className="border-t border-border pt-1.5 font-semibold">Total</dt><dd className="border-t border-border pt-1.5 text-right text-[16px] font-semibold tnum">{formatMoney(t.total)}</dd>
              </dl>
              {verMargen && items.length > 0 && (
                <div className="rounded-control border border-accent/30 bg-accent-soft p-3">
                  <div className="text-[12px] text-accent">Margen estimado al costo de hoy</div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[18px] font-semibold tnum">{formatMoney(t.neto - costo)}</span>
                    <span className="font-semibold text-accent tnum">{formatPercent(t.neto ? (t.neto - costo) / t.neto : 0)}</span>
                  </div>
                </div>
              )}
              <FormField label="Condición de pago">
                <Select value={condicion} onValueChange={(v) => setCondicion(v as CondicionPago)} options={opciones(CONDICION_PAGO_LABEL)} />
              </FormField>
              {cliente && <p className="text-[12px] text-muted">Se emite {TIPO_COMPROBANTE_LABEL[tipoFacturaPara(cliente.condicionIVA)]} por el total.</p>}
              <Button className="w-full" onClick={crear} disabled={!clienteId || !items.length}>
                <Boxes /> Crear acopio y facturar
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
      <NuevoClienteDialog open={nuevoCliente} onOpenChange={setNuevoCliente} onCreado={elegirCliente} />
      <CobranzaDialog
        open={!!creado}
        onOpenChange={(v) => {
          if (!v && creado) router.push(`/acopios/${creado.acopioId}`);
        }}
        clienteId={clienteId}
        comprobanteId={creado?.comprobanteId}
      />
    </div>
  );
}
