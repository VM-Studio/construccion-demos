"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Ban, Boxes, CalendarClock, Download, Factory, Lightbulb, PackageOpen, Plus, ShoppingCart, Wallet } from "lucide-react";
import { useStore } from "@/store";
import { useAcopiosProveedorResumen, useDb, usePosiciones, usePuede, type AcopioProveedorResumen } from "@/store/selectors";
import type { AcopioProveedor, Circuito, FormaPagoAcopio } from "@/domain/types";
import { pendienteRetirar, resumenArticulos } from "@/domain/acopiosProveedor";
import { MEDIO_PAGO_LABEL } from "@/domain/estados";
import { documentoAcopioProveedor } from "@/lib/desacopio/datos";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { SelectorProveedor } from "@/components/shared/alta-rapida";
import { ProductoPicker } from "@/components/shared/producto-picker";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { AvisoFaltantes } from "@/components/shared/aviso-faltantes";
import { EmptyState } from "@/components/shared/empty-state";
import { AdjuntosPanel, ClipContador, useAdjuntos } from "@/components/shared/adjuntos-panel";
import { HistorialEntidad } from "@/components/shared/historial-entidad";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NumberInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField } from "@/components/ui/form-field";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDate, formatMoney, formatPercent, formatQty } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { aCSV, cn, descargarArchivo } from "@/lib/utils";
import { PagoDialog } from "@/components/modulos/cuentas/pago-dialog";
import { DescargarDocumento } from "@/components/modulos/acopios/descargar-desacopio";

const aIso = (v: string, h = 11) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, h).toISOString();
};

/** Tabla de acopios con proveedores (listado y tab de la ficha del proveedor). */
export function AcopiosProveedorTabla({ filtro, vacio }: { filtro?: (a: AcopioProveedorResumen) => boolean; /** Estado vacío cuando no hay ningún acopio (sin filtro de búsqueda). */ vacio?: React.ReactElement }) {
  const db = useDb();
  const router = useRouter();
  const filas = useAcopiosProveedorResumen().filter((a) => !filtro || filtro(a));
  const prov = (id: string) => db.proveedores.find((p) => p.id === id)?.razonSocial;
  const t = filas.reduce((x, a) => ({ i: x.i + a.acopio.importe, r: x.r + a.retirado, s: x.s + a.saldo, p: x.p + a.pendientePesos, d: x.d + a.deuda }), { i: 0, r: 0, s: 0, p: 0, d: 0 });
  const columnas: Column<AcopioProveedorResumen>[] = [
    { key: "n", header: "Número", sortable: true, sortValue: (a) => a.acopio.numero, footer: `${filas.length} acopios`, cell: (a) => <span className="whitespace-nowrap font-mono text-[12px]">{a.acopio.numero}</span> },
    { key: "ci", header: "Circuito", cell: (a) => <CircuitoBadge circuito={a.acopio.circuito} corto /> },
    { key: "p", header: "Proveedor", sortable: true, sortValue: (a) => prov(a.acopio.proveedorId) ?? "", cell: (a) => <span className="block min-w-[170px]">{prov(a.acopio.proveedorId)}</span> },
    { key: "f", header: "Fecha", cell: (a) => <span className="text-muted">{formatDate(a.acopio.fechaCreacion)}</span> },
    { key: "v", header: "Vencimiento", sortable: true, sortValue: (a) => a.acopio.fechaVencimiento, cell: (a) => <span className={cn("whitespace-nowrap", a.estado === "VIGENTE" && a.diasParaVencer <= 30 ? "font-medium text-warning" : "text-muted")}>{formatDate(a.acopio.fechaVencimiento)}</span> },
    { key: "m", header: "Modalidad", cell: (a) => <span className="whitespace-nowrap text-muted">{a.acopio.modalidad === "CANTIDAD" ? "Por cantidad" : "Por monto"}</span> },
    { key: "i", header: "Importe", align: "right", footer: <span className="tnum">{formatMoney(t.i, { decimals: false })}</span>, cell: (a) => <span className="tnum">{formatMoney(a.acopio.importe, { decimals: false })}</span> },
    { key: "r", header: "Retirado", align: "right", footer: <span className="tnum">{formatMoney(t.r, { decimals: false })}</span>, cell: (a) => <span className="tnum">{formatMoney(a.retirado, { decimals: false })}</span> },
    { key: "s", header: "Saldo disponible", align: "right", footer: <span className="tnum">{formatMoney(t.s, { decimals: false })}</span>, cell: (a) => <span className="font-medium tnum">{formatMoney(a.saldo, { decimals: false })}</span> },
    { key: "pr", header: "Pendiente de retirar", align: "right", sortable: true, sortValue: (a) => a.pendientePesos, footer: <span className="tnum text-accent">{formatMoney(t.p, { decimals: false })}</span>, cell: (a) => <span className="whitespace-nowrap tnum">{a.acopio.modalidad === "CANTIDAD" ? `${a.pendienteUnidades} u. · ` : ""}{formatMoney(a.pendientePesos, { decimals: false })}</span> },
    { key: "fp", header: "Forma de pago", cell: (a) => (a.acopio.formaPago === "ANTICIPO" ? <Badge>Anticipo</Badge> : <Badge variant={a.deuda > 0 ? "warning" : "success"} className="whitespace-nowrap">Cta. cte. · pagado {formatPercent(a.pagadoPct, { decimals: 0 })}</Badge>) },
    { key: "e", header: "Estado", cell: (a) => <StatusBadge tipo="ACOPIO" estado={a.estado} /> },
  ];
  return <DataTable rows={filas} columns={columnas} getRowId={(a) => a.acopio.id} onRowClick={(a) => router.push(`/proveedores/acopios/${a.acopio.id}`)} searchText={(a) => `${a.acopio.numero} ${prov(a.acopio.proveedorId)}`} initialSort={{ key: "v", dir: "asc" }} showFooter empty={filas.length ? { icono: Boxes, titulo: "No hay acopios para la búsqueda" } : (vacio ?? <VacioGuiado pagina="acopiosProveedor" icono={Boxes} />)} />;
}

export function AcopiosProveedorView() {
  const router = useRouter();
  const res = useAcopiosProveedorResumen();
  const puede = usePuede("acopiosProveedor.editar");
  const vacio = <VacioGuiado pagina="acopiosProveedor" icono={Boxes} puedeAccion={puede} />;
  const vig = res.filter((a) => a.estado === "VIGENTE");
  return (
    <>
      <PageHeader titulo="Acopios con proveedores" descripcion="Plata nuestra depositada o pactada con proveedores y la mercadería que todavía nos falta retirar." acciones={puede && <Button onClick={() => router.push("/proveedores/acopios/nuevo")}><Plus /> Nuevo acopio con proveedor</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Saldo disponible en proveedores" valor={formatMoney(vig.reduce((a, x) => a + x.saldo, 0), { compact: true })} subtexto="plata nuestra sin pedir" />
        <KpiCard label="Pendiente de retirar" valor={formatMoney(vig.reduce((a, x) => a + x.pendientePesos, 0), { compact: true })} acento subtexto="a costo congelado" onClick={() => router.push("/proveedores/pendientes")} />
        <KpiCard label="Deuda por acopios en cta. cte." valor={formatMoney(vig.reduce((a, x) => a + x.deuda, 0), { compact: true })} subtexto={`${vig.filter((x) => x.deuda > 0).length} acopios con saldo a pagar`} />
        <KpiCard label="Por vencer en 30 días" valor={String(vig.filter((x) => x.diasParaVencer <= 30).length)} />
      </div>
      <AcopiosProveedorTabla vacio={vacio} />
    </>
  );
}

export function AcopioProveedorNuevo() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const [proveedorId, setProveedorId] = React.useState(params.get("proveedor") ?? "");
  const prov = db.proveedores.find((p) => p.id === proveedorId);
  const [circuito, setCircuito] = React.useState<Circuito>(prov?.circuitoHabitual ?? 1);
  const [sucursalId, setSucursalId] = React.useState(db.sucursales[0]?.id ?? "");
  const [deposito, setDeposito] = React.useState(db.sucursales[0]?.depositoId ?? db.depositos[0]?.id ?? "");
  const [fecha, setFecha] = React.useState(diaLocal(new Date()));
  const [vence, setVence] = React.useState(diaLocal(new Date(Date.now() + 180 * 86_400_000)));
  const [modalidad, setModalidad] = React.useState<"MONTO" | "CANTIDAD">("MONTO");
  const [importe, setImporte] = React.useState(0);
  const [forma, setForma] = React.useState<FormaPagoAcopio>("ANTICIPO");
  const [costos, setCostos] = React.useState<Record<string, number>>({});
  const [cantidades, setCantidades] = React.useState<Record<string, number>>({});
  const [obs, setObs] = React.useState("");
  const [archivo, setArchivo] = React.useState<File | null>(null);
  const [pago, setPago] = React.useState<string | null>(null);
  /** Artículos agregados a mano (no tienen a este proveedor como habitual). */
  const [agregados, setAgregados] = React.useState<string[]>([]);
  const productos = db.productos.filter((p) => p.activo && (p.proveedorHabitualId === proveedorId || agregados.includes(p.id)));
  const agregar = (id: string, costo: number) => {
    setAgregados((a) => (a.includes(id) ? a : [...a, id]));
    setCostos((c) => ({ ...c, [id]: c[id] ?? costo }));
  };
  React.useEffect(() => {
    setCostos(Object.fromEntries(productos.map((p) => [p.id, p.costoUltimo])));
    setCantidades({});
    setAgregados([]);
    if (prov) setCircuito(prov.circuitoHabitual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedorId]);
  const totalCantidad = Object.entries(cantidades).reduce((a, [pid, q]) => a + q * (costos[pid] ?? 0), 0);
  const total = modalidad === "MONTO" ? importe : totalCantidad;
  const crear = async () => {
    const r = useStore.getState().crearAcopioProveedor({
      proveedorId,
      sucursalId,
      depositoDestinoId: deposito,
      circuito,
      fechaCreacion: aIso(fecha),
      fechaVencimiento: aIso(vence),
      modalidad,
      importe: modalidad === "MONTO" ? importe : undefined,
      items: modalidad === "CANTIDAD" ? Object.entries(cantidades).filter(([, q]) => q > 0).map(([productoId, cantidadPactada]) => ({ productoId, cantidadPactada })) : undefined,
      formaPago: forma,
      costos,
      observaciones: obs || undefined,
    });
    if (!r.ok) return toast.error(r.error);
    if (archivo) {
      const { guardarAdjunto } = await import("@/lib/adjuntos");
      await guardarAdjunto(archivo, { entidadTipo: "ACOPIO_PROVEEDOR", entidadId: r.data.id, categoria: "FACTURA_PROVEEDOR" });
    }
    toast.success(`Acopio ${r.data.numero} creado`, { description: forma === "ANTICIPO" ? "Registrá la orden de pago del anticipo." : "Queda como deuda en la cuenta corriente del proveedor." });
    if (forma === "ANTICIPO") setPago(r.data.id);
    else router.push(`/proveedores/acopios/${r.data.id}`);
  };
  return (
    <div>
      <PageHeader titulo="Nuevo acopio con proveedor" descripcion="Pagamos adelantado o en cuenta corriente y congelamos costos; después retiramos con órdenes de compra." favorito={false} />
      <AvisoFaltantes claves={["proveedor", "articulo"]} texto="Para acopiar con un proveedor necesitás el proveedor y los artículos cuyo costo se congela." />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Proveedor" required className="sm:col-span-2">
                <SelectorProveedor aria-label="Proveedor" value={proveedorId} onChange={setProveedorId} />
              </FormField>
              <FormField label="Circuito"><Segmented value={String(circuito) as "1" | "2"} onChange={(v) => setCircuito(Number(v) as Circuito)} options={[{ value: "1", label: "AC1 · Fiscal" }, { value: "2", label: "AC2 · Interno" }]} /></FormField>
              <FormField label="Sucursal"><Select aria-label="Sucursal" value={sucursalId} onValueChange={(v) => { setSucursalId(v); setDeposito(db.sucursales.find((s) => s.id === v)?.depositoId ?? deposito); }} options={db.sucursales.map((s) => ({ value: s.id, label: s.nombre }))} /></FormField>
              <FormField label="Depósito destino"><Select aria-label="Depósito destino" value={deposito} onValueChange={setDeposito} options={db.depositos.map((d) => ({ value: d.id, label: d.nombre }))} /></FormField>
              <FormField label="Fecha" htmlFor="acp-f"><Input id="acp-f" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></FormField>
              <FormField label="Vencimiento" htmlFor="acp-v"><Input id="acp-v" type="date" value={vence} onChange={(e) => setVence(e.target.value)} /></FormField>
              <FormField label="Modalidad" hint={modalidad === "CANTIDAD" ? "Ej. 2.000 bolsas de cemento a costo congelado" : "Importe a retirar en cualquier artículo del proveedor"}>
                <Segmented value={modalidad} onChange={setModalidad} options={[{ value: "MONTO", label: "Por monto" }, { value: "CANTIDAD", label: "Por cantidades" }]} />
              </FormField>
              {modalidad === "MONTO" && <FormField label="Importe" required htmlFor="acp-i"><NumberInput id="acp-i" value={importe} min={0} onValueChange={setImporte} /></FormField>}
              <FormField label="Forma de pago" hint={forma === "ANTICIPO" ? "Genera la orden de pago ahora" : "Queda como deuda y se paga en cuotas"}>
                <Segmented value={forma} onChange={setForma} options={[{ value: "ANTICIPO", label: "Anticipo" }, { value: "CUENTA_CORRIENTE", label: "Cuenta corriente" }]} />
              </FormField>
              <FormField label="Propuesta / factura del proveedor" className="sm:col-span-2"><Input type="file" accept="image/*,application/pdf" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} /></FormField>
              <FormField label="Observaciones" htmlFor="acp-o" className="sm:col-span-2 lg:col-span-3"><Input id="acp-o" value={obs} onChange={(e) => setObs(e.target.value)} /></FormField>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Costos a congelar</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <span className="hidden text-[12px] text-muted sm:inline">Snapshot del costo actual, editable antes de congelar</span>
                {proveedorId && <ProductoPicker label="Agregar artículo" mostrarCosto proveedorId={proveedorId} excluir={new Set(productos.map((p) => p.id))} onSelect={(p) => agregar(p.id, p.costoUltimo)} />}
              </div>
            </CardHeader>
            {!productos.length ? (
              <EmptyState
                icono={Boxes}
                titulo={proveedorId ? "Este proveedor todavía no tiene artículos" : "Elegí un proveedor"}
                descripcion={proveedorId ? "Se listan los artículos que tienen a este proveedor como habitual. Agregá los que vas a acopiar con «Agregar artículo» (o creá uno nuevo desde el buscador) y cargá su costo." : "Al elegirlo se listan sus artículos con el costo actual para congelarlo."}
              />
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="sticky top-0 bg-[#F0EFEB] text-[11.5px] text-muted">
                    <tr><th className="h-8 px-3 text-left font-medium">Artículo</th><th className="h-8 px-3 text-right font-medium">Costo actual</th><th className="h-8 w-[150px] px-3 text-right font-medium">Costo congelado</th>{modalidad === "CANTIDAD" && <th className="h-8 w-[130px] px-3 text-right font-medium">Cantidad pactada</th>}</tr>
                  </thead>
                  <tbody>
                    {productos.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-3 py-1"><span className="mr-1.5 font-mono text-[11px] text-muted">{p.codigo}</span>{p.nombre}</td>
                        <td className="px-3 py-1 text-right text-muted tnum">{formatMoney(p.costoUltimo)}</td>
                        <td className="px-3 py-1"><NumberInput aria-label={`Costo congelado de ${p.nombre}`} value={costos[p.id] ?? p.costoUltimo} min={0} onValueChange={(v) => setCostos({ ...costos, [p.id]: v })} className="h-7" /></td>
                        {modalidad === "CANTIDAD" && <td className="px-3 py-1"><NumberInput aria-label={`Cantidad pactada de ${p.nombre}`} value={cantidades[p.id] ?? 0} min={0} onValueChange={(v) => setCantidades({ ...cantidades, [p.id]: v })} className="h-7" /></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle><CircuitoBadge circuito={circuito} corto /></CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              <dl className="grid grid-cols-[1fr_auto] gap-y-1.5">
                <dt className="text-muted">Proveedor</dt><dd className="max-w-[160px] truncate text-right">{prov?.razonSocial ?? "—"}</dd>
                <dt className="text-muted">Modalidad</dt><dd className="text-right">{modalidad === "CANTIDAD" ? "Por cantidades" : "Por monto"}</dd>
                <dt className="text-muted">Costos congelados</dt><dd className="text-right tnum">{productos.length}</dd>
                <dt className="border-t border-border pt-1.5 font-semibold">Importe</dt><dd className="border-t border-border pt-1.5 text-right text-[16px] font-semibold tnum">{formatMoney(total)}</dd>
              </dl>
              <Button className="w-full" disabled={!proveedorId || !(total > 0)} onClick={() => void crear()}><Factory /> Crear acopio con proveedor</Button>
            </CardContent>
          </Card>
        </aside>
      </div>
      {pago && <PagoDialog open onOpenChange={(v) => { if (!v) { router.push(`/proveedores/acopios/${pago}`); setPago(null); } }} proveedorId={proveedorId} />}
    </div>
  );
}

export function AcopioProveedorDetalle({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const res = useAcopiosProveedorResumen().find((a) => a.acopio.id === id);
  const puede = usePuede("acopiosProveedor.editar");
  const puedePagar = usePuede("ctacte.pagar");
  const [dialogo, setDialogo] = React.useState<"pago" | "extender" | "cancelar" | null>(null);
  const adjuntos = useAdjuntos("ACOPIO_PROVEEDOR", id);
  if (!res)
    return (
      <Card>
        <EmptyState titulo="Acopio inexistente" accion={<Button onClick={() => router.push("/proveedores/acopios")}>Volver</Button>} />
      </Card>
    );
  const a = res.acopio;
  const prov = db.proveedores.find((p) => p.id === a.proveedorId);
  const ocs = db.ordenesCompra.filter((o) => o.acopioProveedorId === id);
  const pend = pendienteRetirar(a, db.ordenesCompra);
  const prod = (pid: string) => db.productos.find((p) => p.id === pid);
  return (
    <div>
      <Link href="/proveedores/acopios" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft className="size-4" /> Acopios con proveedores</Link>
      <PageHeader
        titulo={<span>{a.numero} · <Link href={`/proveedores/${a.proveedorId}`} className="hover:underline">{prov?.razonSocial}</Link></span>}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge tipo="ACOPIO" estado={res.estado} /> <CircuitoBadge circuito={a.circuito} /> {a.modalidad === "CANTIDAD" ? "Por cantidades" : "Por monto"} · {a.formaPago === "ANTICIPO" ? "Anticipo" : "Cuenta corriente"} · vence {formatDate(a.fechaVencimiento)} <ClipContador cantidad={adjuntos.length} />
          </span>
        }
        acciones={
          <>
            {puede && res.estado !== "CANCELADO" && <Button onClick={() => router.push(`/compras/oc/nueva?acopio=${a.id}`)}><ShoppingCart /> Retirar (nueva OC)</Button>}
            {puedePagar && res.deuda > 0 && <Button variant="secondary" onClick={() => setDialogo("pago")}><Wallet /> Registrar pago</Button>}
            {puede && <Button variant="secondary" onClick={() => setDialogo("extender")}><CalendarClock /> Extender vencimiento</Button>}
            <DescargarDocumento entidad="AcopioProveedor" entidadId={a.id} armar={() => documentoAcopioProveedor(useStore.getState().db, a.id)} />
            {puede && res.estado !== "CANCELADO" && <Button variant="ghost" onClick={() => setDialogo("cancelar")}><Ban /> Cancelar</Button>}
          </>
        }
      />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Importe" valor={formatMoney(a.importe, { compact: a.importe >= 10_000_000 })} />
        <KpiCard label="Retirado" valor={formatMoney(res.retirado, { compact: res.retirado >= 10_000_000 })} />
        <KpiCard label="Saldo disponible" valor={formatMoney(res.saldo, { compact: res.saldo >= 10_000_000 })} subtexto="sin pedir en OC" />
        <KpiCard label="Pendiente de retirar" valor={formatMoney(res.pendientePesos, { compact: res.pendientePesos >= 10_000_000 })} acento subtexto={a.modalidad === "CANTIDAD" ? `${res.pendienteUnidades} unidades` : "a costo congelado"} />
        <KpiCard label="Pagado" valor={formatMoney(a.pagado, { compact: a.pagado >= 10_000_000 })} subtexto={res.deuda > 0 ? <span className="text-danger">le debemos {formatMoney(res.deuda, { compact: true })}</span> : "pagado completo"} />
      </div>
      <Progress value={a.importe ? res.retirado / a.importe : 0} className="mb-4" />
      <Tabs defaultValue="movimientos">
        <TabsList className="mb-3 flex-wrap">
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="articulos">Artículos</TabsTrigger>
          <TabsTrigger value="pendiente">Pendiente de retirar</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="adjuntos">Adjuntos ({adjuntos.length})</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="movimientos"><MovimientosACP acopio={a} /></TabsContent>
        <TabsContent value="articulos">
          <Card>
            <table className="w-full text-[12.5px]">
              <thead className="bg-[#F0EFEB] text-[11.5px] text-muted"><tr><th className="h-9 px-3 text-left font-medium">Código</th><th className="h-9 px-3 text-left font-medium">Artículo</th><th className="h-9 px-3 text-right font-medium">Costo congelado</th><th className="h-9 px-3 text-right font-medium">Costo actual</th><th className="h-9 px-3 text-right font-medium">Pactado</th><th className="h-9 px-3 text-right font-medium">Pedido</th><th className="h-9 px-3 text-right font-medium">Recibido</th></tr></thead>
              <tbody>
                {resumenArticulos(a, db.ordenesCompra, db.productos).map((r) => (
                  <tr key={r.productoId} className="border-t border-border">
                    <td className="px-3 py-1.5 font-mono text-[11px]">{prod(r.productoId)?.codigo}</td>
                    <td className="px-3 py-1.5">{prod(r.productoId)?.nombre}</td>
                    <td className="px-3 py-1.5 text-right tnum">{formatMoney(r.costo)}</td>
                    <td className={cn("px-3 py-1.5 text-right tnum", r.costoActual > r.costo ? "text-success" : "text-muted")}>{formatMoney(r.costoActual)}</td>
                    <td className="px-3 py-1.5 text-right tnum">{r.pactado || "—"}</td>
                    <td className="px-3 py-1.5 text-right tnum">{r.pedido || "—"}</td>
                    <td className="px-3 py-1.5 text-right tnum">{r.recibido || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>
        <TabsContent value="pendiente">
          <Card className="p-4">
            {a.modalidad === "CANTIDAD" ? (
              <ul className="divide-y divide-border">
                {pend.porProducto.map((p) => (
                  <li key={p.productoId} className="flex items-center gap-3 py-2 text-[13px]">
                    <span className="flex-1">{prod(p.productoId)?.nombre}</span>
                    <span className="text-muted">pactado {p.pactado} · recibido {p.recibido}</span>
                    <span className="font-semibold tnum">{formatQty(p.pendiente, prod(p.productoId)?.unidad ?? "UN")}</span>
                    <span className="w-28 text-right tnum">{formatMoney(p.pendientePesos, { decimals: false })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px]">Pendiente de retirar: <b className="tnum">{formatMoney(pend.pesos)}</b> a costo congelado (saldo sin pedir {formatMoney(res.saldo)} + OC confirmadas sin recibir).</p>
            )}
            {puede && <Button className="mt-3" size="sm" onClick={() => router.push(`/compras/oc/nueva?acopio=${a.id}`)}><PackageOpen /> Retirar con nueva OC</Button>}
          </Card>
        </TabsContent>
        <TabsContent value="pagos">
          <Card>
            <ul className="divide-y divide-border">
              {db.comprobantes.filter((c) => a.comprobanteCompraIds.includes(c.id)).map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]"><span className="font-medium">Factura de compra</span><span className="font-mono text-[12px]">{c.numero}</span><span className="flex-1 text-muted">{formatDate(c.fecha)} · saldo {formatMoney(c.saldoPendiente)}</span><span className="tnum">{formatMoney(c.total)}</span><StatusBadge tipo="COMPROBANTE" estado={c.estado} /></li>
              ))}
              {db.pagosProveedores.filter((o) => a.ordenPagoIds.includes(o.id)).map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]"><span className="font-medium">Orden de pago</span><span className="font-mono text-[12px]">{o.numero}</span><span className="flex-1 text-muted">{formatDate(o.fecha)} · {o.medios.map((m) => MEDIO_PAGO_LABEL[m.medio]).join(", ")}</span><span className="tnum">{formatMoney(o.total)}</span></li>
              ))}
            </ul>
          </Card>
        </TabsContent>
        <TabsContent value="adjuntos"><Card className="p-4"><AdjuntosPanel entidadTipo="ACOPIO_PROVEEDOR" entidadId={id} categoriaDefecto="FACTURA_PROVEEDOR" /></Card></TabsContent>
        <TabsContent value="historial"><Card className="p-4"><HistorialEntidad ids={[id, ...ocs.map((o) => o.id)]} /></Card></TabsContent>
      </Tabs>
      <PagoDialog open={dialogo === "pago"} onOpenChange={(v) => !v && setDialogo(null)} proveedorId={a.proveedorId} />
      {dialogo === "extender" && <ExtenderACP acopio={a} onClose={() => setDialogo(null)} />}
      {dialogo === "cancelar" && <CancelarACP acopio={a} onClose={() => setDialogo(null)} />}
    </div>
  );
}

function MovimientosACP({ acopio }: { acopio: AcopioProveedor }) {
  const db = useDb();
  const doc = React.useMemo(() => documentoAcopioProveedor(db, acopio.id), [db, acopio.id]);
  const ocPorNumero = new Map(db.ordenesCompra.map((o) => [o.numero, o.id]));
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-[12.5px]">
          <thead className="bg-[#F0EFEB] text-[11.5px] text-muted">
            <tr>{doc.columnas.map((c, i) => <th key={c} className={cn("h-9 whitespace-nowrap px-2 font-medium", i >= 3 && i <= 5 ? "text-right" : i >= 8 ? "text-right" : "text-left")}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {doc.grupos.map((g) => {
              const num = g.titulo.split(",")[0];
              return (
                <React.Fragment key={g.titulo}>
                  <tr className="border-t border-border bg-[#FAFAF8]"><td colSpan={11} className="px-2 py-1.5 text-[12px] font-semibold">{ocPorNumero.get(num) ? <Link href={`/compras/oc/${ocPorNumero.get(num)}`} className="hover:underline">{num}</Link> : num}<span className="font-normal text-muted">{g.titulo.slice(num.length)}</span></td></tr>
                  {g.lineas.map((l, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1.5 font-mono text-[11.5px]">{l.codigo}</td>
                      <td className="px-2 py-1.5">{l.descripcion}</td>
                      <td className="px-2 py-1.5 text-muted">{l.obra}</td>
                      <td className="px-2 py-1.5 text-right tnum">{l.cantidad}</td>
                      <td className="px-2 py-1.5 text-right tnum">{l.entregados}</td>
                      <td className={cn("px-2 py-1.5 text-right tnum", l.saldo > 0 && "font-semibold text-warning")}>{l.saldo}</td>
                      <td className="px-2 py-1.5 font-mono text-[11px]">{l.remitos.join(", ")}</td>
                      <td className="px-2 py-1.5 font-mono text-[11px] text-muted">{l.facturas.join(", ")}</td>
                      <td className="px-2 py-1.5 text-right tnum">{formatMoney(l.precio)}</td>
                      <td className="px-2 py-1.5 text-right tnum">{formatMoney(l.subtotal)}</td>
                      <td className="px-2 py-1.5 text-right font-medium tnum">{formatMoney(l.saldoDisponible)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            {!doc.grupos.length && <tr><td colSpan={11} className="py-10 text-center text-muted">Todavía no se retiró nada de este acopio.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ExtenderACP({ acopio, onClose }: { acopio: AcopioProveedor; onClose: () => void }) {
  const [fecha, setFecha] = React.useState(diaLocal(new Date(Date.parse(acopio.fechaVencimiento) + 60 * 86_400_000)));
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm" title="Extender vencimiento" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => { const r = useStore.getState().extenderVencimientoACP(acopio.id, aIso(fecha)); if (r.ok) { toast.success("Vencimiento extendido"); onClose(); } else toast.error(r.error); }}>Extender</Button></>}>
        <FormField label="Nueva fecha" htmlFor="eacp"><Input id="eacp" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></FormField>
      </DialogContent>
    </Dialog>
  );
}

function CancelarACP({ acopio, onClose }: { acopio: AcopioProveedor; onClose: () => void }) {
  const [motivo, setMotivo] = React.useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm" title={`Cancelar ${acopio.numero}`} footer={<><Button variant="secondary" onClick={onClose}>Volver</Button><Button variant="danger" disabled={!motivo.trim()} onClick={() => { const r = useStore.getState().cancelarACP(acopio.id, motivo); if (r.ok) { toast.success("Acopio cancelado"); onClose(); } else toast.error(r.error); }}><Ban /> Cancelar acopio</Button></>}>
        <FormField label="Motivo" required htmlFor="cacp"><Input id="cacp" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></FormField>
      </DialogContent>
    </Dialog>
  );
}

interface FilaRetirar {
  key: string;
  proveedorId: string;
  productoId?: string;
  descripcion: string;
  origen: string;
  href: string;
  unidades?: number;
  pesos: number;
  sugerencia?: { acopioId: string; numero: string; cantidad: number };
}

/** Todo lo que la empresa tiene derecho a retirar: acopios por cantidad, saldo de acopios por monto y OC sin recibir. */
export function PendientesRetirarView() {
  const db = useDb();
  const puedeAcopio = usePuede("acopiosProveedor.editar");
  const router = useRouter();
  const acps = useAcopiosProveedorResumen().filter((a) => a.estado === "VIGENTE");
  const posiciones = usePosiciones();
  const filas: FilaRetirar[] = [];
  for (const r of acps) {
    const a = r.acopio;
    if (a.modalidad === "CANTIDAD") {
      for (const p of pendienteRetirar(a, db.ordenesCompra).porProducto)
        if (p.pendiente > 0) {
          const pos = posiciones.get(p.productoId);
          const bajo = pos && pos.estado !== "OK";
          filas.push({ key: `${a.id}-${p.productoId}`, proveedorId: a.proveedorId, productoId: p.productoId, descripcion: db.productos.find((x) => x.id === p.productoId)?.nombre ?? "", origen: a.numero, href: `/proveedores/acopios/${a.id}`, unidades: p.pendiente, pesos: p.pendientePesos, sugerencia: bajo ? { acopioId: a.id, numero: a.numero, cantidad: Math.min(p.pendiente, Math.max(pos.producto.stockMinimo * 2 - pos.disponible, pos.producto.unidadesPorPallet ?? 1)) } : undefined });
        }
    } else if (r.saldo > 0.5) {
      const bajo = a.preciosCongelados.map((c) => posiciones.get(c.productoId)).find((pos) => pos && pos.estado !== "OK");
      filas.push({ key: a.id, proveedorId: a.proveedorId, descripcion: "Saldo de acopio por monto (cualquier artículo del proveedor)", origen: a.numero, href: `/proveedores/acopios/${a.id}`, pesos: r.saldo, sugerencia: bajo ? { acopioId: a.id, numero: a.numero, cantidad: Math.max(1, bajo.producto.stockMinimo * 2 - bajo.disponible) } : undefined, productoId: bajo?.producto.id });
    }
  }
  for (const o of db.ordenesCompra.filter((x) => x.estado === "CONFIRMADA" || x.estado === "RECIBIDA_PARCIAL"))
    for (const i of o.items)
      if (i.cantidadPedida > i.cantidadRecibida)
        filas.push({ key: i.id, proveedorId: o.proveedorId, productoId: i.productoId, descripcion: db.productos.find((x) => x.id === i.productoId)?.nombre ?? "", origen: `${o.numero}${o.origen === "ACOPIO" ? " (acopio)" : ""}`, href: `/compras/oc/${o.id}`, unidades: i.cantidadPedida - i.cantidadRecibida, pesos: (i.cantidadPedida - i.cantidadRecibida) * i.costoUnitario });
  const prov = (id: string) => db.proveedores.find((p) => p.id === id)?.razonSocial ?? "";
  const unidad = (pid?: string) => db.productos.find((p) => p.id === pid)?.unidad ?? "UN";
  const columnas: Column<FilaRetirar>[] = [
    { key: "p", header: "Proveedor", sortable: true, sortValue: (f) => prov(f.proveedorId), cell: (f) => <span className="block min-w-[160px]">{prov(f.proveedorId)}</span> },
    { key: "d", header: "Artículo / concepto", cell: (f) => <span className="block min-w-[220px]">{f.descripcion}</span> },
    { key: "o", header: "Origen", cell: (f) => <Link href={f.href} className="whitespace-nowrap font-mono text-[12px] hover:underline">{f.origen}</Link> },
    { key: "u", header: "Unidades pendientes", align: "right", cell: (f) => (f.unidades !== undefined ? <span className="tnum">{formatQty(f.unidades, unidad(f.productoId))}</span> : <span className="text-disabled">—</span>) },
    { key: "$", header: "$ disponible / pendiente", align: "right", sortable: true, sortValue: (f) => f.pesos, footer: <span className="tnum text-accent">{formatMoney(filas.reduce((a, f) => a + f.pesos, 0), { decimals: false })}</span>, cell: (f) => <span className="font-medium tnum">{formatMoney(f.pesos, { decimals: false })}</span> },
    {
      key: "s",
      header: "Sugerencia",
      cell: (f) =>
        f.sugerencia && f.productoId ? (
          <button onClick={() => router.push(`/compras/oc/nueva?acopio=${f.sugerencia!.acopioId}&producto=${f.productoId}&cantidad=${f.sugerencia!.cantidad}`)} className="flex items-center gap-1.5 rounded-control border border-accent/30 bg-accent-soft px-2 py-1 text-left text-[11.5px] text-ink hover:border-accent">
            <Lightbulb className="size-3.5 shrink-0 text-accent" />
            <span>{db.productos.find((p) => p.id === f.productoId)?.nombre} está bajo mínimo: podés retirar {f.sugerencia.cantidad} de tu acopio {f.sugerencia.numero} sin costo adicional</span>
          </button>
        ) : null,
    },
  ];
  return (
    <>
      <PageHeader
        titulo="Pendientes de retirar"
        descripcion="Todo lo que la empresa tiene derecho a retirar de sus proveedores: acopios por cantidad, saldos de acopios por monto y órdenes confirmadas sin recibir."
        acciones={<Button variant="secondary" onClick={() => descargarArchivo("pendientes-de-retirar.csv", aCSV(["Proveedor", "Artículo / concepto", "Origen", "Unidades", "$"], filas.map((f) => [prov(f.proveedorId), f.descripcion, f.origen, f.unidades ?? "", Math.round(f.pesos)])))}><Download /> Exportar CSV</Button>}
      />
      <DataTable rows={filas} columns={columnas} getRowId={(f) => f.key} searchText={(f) => `${prov(f.proveedorId)} ${f.descripcion} ${f.origen}`} initialSort={{ key: "$", dir: "desc" }} showFooter empty={filas.length ? { icono: Boxes, titulo: "No hay pendientes para la búsqueda" } : <VacioGuiado pagina="pendientesRetirar" icono={Boxes} puedeAccion={puedeAcopio} />} />
    </>
  );
}
