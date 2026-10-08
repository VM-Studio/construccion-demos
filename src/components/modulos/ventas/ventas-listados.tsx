"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FileText, HardHat, Plus, Printer, Receipt, Save, Send, ShoppingCart, ThumbsDown, Undo2, Wallet } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useSucursalActiva, useVeCircuito2 } from "@/store/selectors";
import type { Circuito, Cobranza, Comprobante, Cotizacion, DevolucionNP, ItemVenta, NotaPedido, Obra, Producto } from "@/domain/types";
import { MEDIO_PAGO_LABEL, TIPO_COMPROBANTE_LABEL } from "@/domain/estados";
import { obtenerPrecio } from "@/domain/precios";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { Combobox } from "@/components/shared/combobox";
import { SelectorCliente } from "@/components/shared/alta-rapida";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { prerequisitos } from "@/domain/prerequisitos";
import { AvisoFaltantes } from "@/components/shared/aviso-faltantes";
import { ObraSelect, NuevaObraDialog } from "@/components/shared/obra-select";
import { ItemsGrid, type LineaBase } from "@/components/shared/items-grid";
import { PrintLayout, PrintPreview, PrintTable } from "@/components/shared/print-layout";
import { DateRangePicker } from "@/components/shared/filter-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { PRESETS_LISTADO, periodoDesdePreset, type Periodo } from "@/lib/periodos";
import { cn, newId } from "@/lib/utils";
import { CobranzaDialog } from "@/components/modulos/cuentas/cobranza-dialog";
import { ComprobanteDocumento, ReciboDocumento } from "@/components/modulos/cuentas/documentos";
import { Impacto, ImpactoCampo, medir } from "@/capacitacion";
import { DevolucionDialog } from "./nota-pedido-detalle";
import { obtenerDb } from "@/lib/datos/almacen";

const useCliente = () => {
  const db = useDb();
  const m = React.useMemo(() => new Map(db.clientes.map((c) => [c.id, c])), [db.clientes]);
  return (id?: string) => (id ? m.get(id) : undefined);
};
const circuitoOpts = (veC2: boolean) => [{ value: "", label: "AC1 y AC2" }, { value: "1", label: "AC1 · Fiscal" }, ...(veC2 ? [{ value: "2", label: "AC2 · Interno" }] : [])];

// ───────────────────────── Cotizaciones ─────────────────────────

interface LineaCot extends LineaBase {
  obraId?: string;
}

export function CotizacionesView() {
  const db = useDb();
  const params = useSearchParams();
  const veC2 = useVeCircuito2();
  const sucursal = useSucursalActiva();
  const cliente = useCliente();
  const puede = usePuede("ventas.editar");
  const [abrir, setAbrir] = React.useState<Cotizacion | "nueva" | null>(params.get("nuevo") === "1" ? "nueva" : null);
  const [estado, setEstado] = React.useState("");
  const vencida = (c: Cotizacion) => (c.estado === "ENVIADA" || c.estado === "BORRADOR") && Date.parse(c.fecha) + c.validezDias * 86_400_000 < Date.now();
  const filas = db.cotizaciones.filter((c) => (veC2 || c.circuito !== 2) && (!sucursal || c.sucursalId === sucursal) && (!estado || c.estado === estado));
  const columnas: Column<Cotizacion>[] = [
    { key: "n", header: "Número", sortable: true, sortValue: (c) => c.numero, cell: (c) => <span className="whitespace-nowrap font-mono text-[12px]">{c.numero}</span> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (c) => c.fecha, cell: (c) => <span className="text-muted">{formatDate(c.fecha)}</span> },
    { key: "c", header: "Cliente", cell: (c) => <span className="block min-w-[150px]">{cliente(c.clienteId)?.nombreFantasia ?? cliente(c.clienteId)?.razonSocial}</span> },
    { key: "o", header: "Obra", cell: (c) => <span className="text-[12px] text-muted">{db.obras.find((o) => o.id === c.obraId)?.nombre ?? "—"}</span> },
    { key: "ci", header: "Circuito", cell: (c) => <CircuitoBadge circuito={c.circuito} corto /> },
    { key: "t", header: "Total", align: "right", sortable: true, sortValue: (c) => c.total, cell: (c) => <span className="tnum">{formatMoney(c.total, { decimals: false })}</span> },
    { key: "v", header: "Vence", cell: (c) => <span className={cn("whitespace-nowrap", vencida(c) ? "text-danger" : "text-muted")}>{formatDate(new Date(Date.parse(c.fecha) + c.validezDias * 86_400_000))}</span> },
    { key: "e", header: "Estado", cell: (c) => <StatusBadge tipo="COTIZACION" estado={vencida(c) ? "VENCIDA" : c.estado} /> },
    { key: "np", header: "Nota de pedido", cell: (c) => (c.notaPedidoId ? <Link onClick={(e) => e.stopPropagation()} href={`/ventas/notas-pedido/${c.notaPedidoId}`} className="font-mono text-[12px] hover:underline">{db.notasPedido.find((n) => n.id === c.notaPedidoId)?.numero}</Link> : <span className="text-disabled">—</span>) },
  ];
  return (
    <>
      <PageHeader titulo="Cotizaciones de venta" descripcion="Cotizaciones con obra y circuito; se convierten en nota de pedido con un clic." acciones={puede && <Button onClick={() => setAbrir("nueva")}><Plus /> Nueva cotización</Button>} />
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(c) => c.id}
        onRowClick={setAbrir}
        searchText={(c) => `${c.numero} ${cliente(c.clienteId)?.razonSocial}`}
        initialSort={{ key: "f", dir: "desc" }}
        empty={db.cotizaciones.length === 0 ? <VacioGuiado pagina="cotizaciones" icono={FileText} onAccion={() => setAbrir("nueva")} puedeAccion={puede} /> : { icono: FileText, titulo: "No hay cotizaciones para el filtro" }}
        filters={<div className="w-[160px]"><Select size="sm" aria-label="Estado" value={estado} onValueChange={setEstado} options={[{ value: "", label: "Todos los estados" }, { value: "BORRADOR", label: "Borrador" }, { value: "ENVIADA", label: "Enviada" }, { value: "ACEPTADA", label: "Aceptada" }, { value: "RECHAZADA", label: "Rechazada" }]} /></div>}
      />
      {abrir && <CotizacionDialog cot={abrir === "nueva" ? undefined : abrir} clienteInicial={params.get("cliente") ?? undefined} onClose={() => setAbrir(null)} />}
    </>
  );
}

function CotizacionDialog({ cot, clienteInicial, onClose }: { cot?: Cotizacion; clienteInicial?: string; onClose: () => void }) {
  const db = useDb();
  const router = useRouter();
  const [clienteId, setClienteId] = React.useState(cot?.clienteId ?? clienteInicial ?? "");
  const cliente = db.clientes.find((c) => c.id === clienteId);
  const [obraId, setObraId] = React.useState(cot?.obraId ?? "");
  const [circuito, setCircuito] = React.useState<Circuito>(cot?.circuito ?? cliente?.circuitoHabitual ?? 1);
  const [validez, setValidez] = React.useState(cot?.validezDias ?? db.config.validezPresupuestoDias);
  const [descuento, setDescuento] = React.useState(cot?.descuentoPct ?? 0);
  const [items, setItems] = React.useState<LineaCot[]>(cot?.items.map((i) => ({ id: i.id, productoId: i.productoId, obraId: i.obraId, cantidad: i.cantidad, precio: i.precioUnitario, descuentoPct: i.descuentoPct })) ?? []);
  const [imprimir, setImprimir] = React.useState(false);
  const editable = !cot || cot.estado === "BORRADOR" || cot.estado === "ENVIADA";
  const lista = cliente?.listaPreciosId ?? "lst_gen";
  const guardar = async () => {
    const its: ItemVenta[] = items.map((i) => ({ id: i.id, productoId: i.productoId, obraId: i.obraId ?? (obraId || undefined), cantidad: i.cantidad, precioUnitario: i.precio ?? 0, costoUnitarioSnapshot: 0, descuentoPct: i.descuentoPct ?? 0 }));
    const r = await useStore.getState().guardarCotizacion({ clienteId, obraId: obraId || undefined, sucursalId: cliente?.sucursalPreferidaId ?? "suc_central", circuito, fecha: cot?.fecha ?? new Date().toISOString(), validezDias: validez, items: its, descuentoPct: descuento }, cot?.id);
    if (!r.ok) toast.error(r.error);
    return r;
  };
  /** Guarda midiendo el impacto (modo capacitación); devuelve el id o null. */
  const guardarMedido = async (accion: "crearCotizacion" | "convertirCotizacion", despues?: (id: string) => void): Promise<string | null> => {
    const r = await medir(accion, { clienteId, productoIds: items.map((i) => i.productoId) }, async () => {
      const x = await guardar();
      if (x.ok) despues?.(x.data);
      return x;
    });
    return r.ok ? r.data : null;
  };
  const estado = async (id: string, e: Cotizacion["estado"], msg: string) => {
    const r = await medir(e === "RECHAZADA" ? "rechazarCotizacion" : "crearCotizacion", {}, () => useStore.getState().cambiarEstadoCotizacion(id, e));
    if (r.ok) toast.success(msg);
    else toast.error(r.error);
  };
  const actual = cot ? db.cotizaciones.find((c) => c.id === cot.id) : undefined;
  const faltan = cot ? [] : prerequisitos("cotizaciones", db);
  const elegirCliente = (v: string) => {
    setClienteId(v);
    // Del store en el momento: un cliente recién creado con el alta rápida todavía no está en `db`.
    const c = obtenerDb().clientes.find((x) => x.id === v);
    setCircuito(c?.circuitoHabitual ?? 1);
    setObraId("");
    // Los precios cargados eran de la lista del cliente anterior.
    const listaNueva = c?.listaPreciosId ?? "lst_gen";
    setItems((its) => its.map((i) => ({ ...i, precio: obtenerPrecio(i.productoId, listaNueva, obtenerDb().precios) })));
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        size="xl"
        title={cot ? `Cotización ${cot.numero}` : "Nueva cotización"}
        description={cot ? `${cliente?.razonSocial ?? ""} · ${formatDate(cot.fecha)}` : "Precios de la lista del cliente; IVA según circuito."}
        footer={
          <>
            {actual && <Button variant="ghost" onClick={() => setImprimir(true)}><Printer /> Imprimir</Button>}
            {actual && (actual.estado === "BORRADOR" || actual.estado === "ENVIADA") && <Button variant="ghost" onClick={() => estado(actual.id, "RECHAZADA", "Cotización rechazada")}><ThumbsDown /> Rechazar</Button>}
            {editable && <Button variant="secondary" onClick={async () => { const id = await guardarMedido("crearCotizacion"); if (id) { toast.success("Cotización guardada"); if (!cot) onClose(); } }}><Save /> Guardar</Button>}
            {editable && <Button variant="secondary" onClick={() => guardarMedido("crearCotizacion", (id) => estado(id, "ENVIADA", "Cotización enviada al cliente"))}><Send /> Enviar</Button>}
            {(!actual || actual.estado !== "ACEPTADA") && editable && (
              <Button onClick={async () => { const id = await guardarMedido("convertirCotizacion"); if (id) router.push(`/ventas/notas-pedido/nueva?cotizacion=${id}`); }}>
                <ShoppingCart /> Convertir en nota de pedido
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {faltan.length > 0 && <AvisoFaltantes faltan={faltan} titulo="Para cotizar falta cargar datos" texto={`Necesitás ${faltan.map((f) => f.nombre).join(" y ")}. Podés crearlos desde los buscadores sin perder lo cargado.`} />}
          <div className="grid gap-3 sm:grid-cols-4">
            <FormField label="Cliente" className="sm:col-span-2">
              <SelectorCliente value={clienteId} disabled={!editable} onChange={elegirCliente} />
            </FormField>
            <FormField label="Obra"><ObraSelect clienteId={clienteId} value={obraId} onChange={setObraId} /></FormField>
            <FormField label="Validez (días)" htmlFor="cot-v"><Input id="cot-v" type="number" min={1} value={validez} disabled={!editable} onChange={(e) => setValidez(Math.max(1, Number(e.target.value) || 1))} /><ImpactoCampo campo="cotizacion.validez" /></FormField>
            <FormField label="Circuito" className="sm:col-span-2">
              <Segmented value={String(circuito) as "1" | "2"} onChange={(v) => setCircuito(Number(v) as Circuito)} options={[{ value: "1", label: "AC1 · Fiscal" }, { value: "2", label: "AC2 · Interno" }]} />
              <ImpactoCampo campo={`circuito.${circuito}`} />
            </FormField>
          </div>
          <ItemsGrid<LineaCot>
            items={items}
            onChange={setItems}
            readOnly={!editable}
            crearItem={(p: Producto) => ({ id: newId("l"), productoId: p.id, obraId: obraId || undefined, cantidad: 1, precio: obtenerPrecio(p.id, lista, db.precios), descuentoPct: 0 })}
            listaId={lista}
            depositoId={cliente ? db.sucursales.find((s) => s.id === cliente.sucursalPreferidaId)?.depositoId : undefined}
            totales={{ descuentoPct: descuento, ivaPct: circuito === 1 ? db.config.ivaPct : 0, onDescuentoChange: setDescuento }}
          />
          {editable && <Impacto accion="crearCotizacion" />}
          {editable && (!actual || actual.estado !== "ACEPTADA") && <Impacto accion="convertirCotizacion" />}
        </div>
        {actual && (
          <PrintPreview open={imprimir} onOpenChange={setImprimir} titulo={`Cotización ${actual.numero}`}>
            <CotizacionDocumento cot={actual} />
          </PrintPreview>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CotizacionDocumento({ cot }: { cot: Cotizacion }) {
  const db = useDb();
  const c = db.clientes.find((x) => x.id === cot.clienteId);
  return (
    <PrintLayout titulo="Cotización" numero={cot.numero} fecha={formatDate(cot.fecha)} leyenda={`Válida por ${cot.validezDias} días`} subtitulo={<div className="text-[11px]"><b>Cliente:</b> {c?.razonSocial} · CUIT {c?.cuit || "—"}<br /><b>Obra:</b> {db.obras.find((o) => o.id === cot.obraId)?.nombre ?? "—"}</div>} pie="Precios sujetos a disponibilidad de stock.">
      <PrintTable
        head={["Código", "Artículo", "Cantidad", "Precio", "Desc.", "Subtotal"]}
        rows={cot.items.map((i) => {
          const p = db.productos.find((x) => x.id === i.productoId);
          return [p?.codigo, p?.nombre, formatQty(i.cantidad, p?.unidad ?? "UN"), formatMoney(i.precioUnitario), `${i.descuentoPct} %`, formatMoney(i.cantidad * i.precioUnitario * (1 - i.descuentoPct / 100))];
        })}
        foot={["", "", "", "", "Total", formatMoney(cot.total)]}
      />
    </PrintLayout>
  );
}

// ───────────────────────── Comprobantes de venta ─────────────────────────

export function ComprobantesView() {
  const db = useDb();
  const params = useSearchParams();
  const veC2 = useVeCircuito2();
  const sucursal = useSucursalActiva();
  const cliente = useCliente();
  const [ver, setVer] = React.useState<Comprobante | null>(() => db.comprobantes.find((c) => c.id === params.get("id")) ?? null);
  const [periodo, setPeriodo] = React.useState<Periodo>(() => periodoDesdePreset("90D"));
  const [circuito, setCircuito] = React.useState("");
  const [tipo, setTipo] = React.useState("");
  const filas = db.comprobantes.filter((c) => c.clienteId && c.tipo !== "SALDO_A_FAVOR" && (veC2 || c.circuito !== 2) && (!sucursal || c.sucursalId === sucursal) && c.fecha >= periodo.desde && c.fecha <= periodo.hasta && (!circuito || String(c.circuito) === circuito) && (!tipo || c.tipo === tipo));
  const tot = filas.reduce((a, c) => ({ f: a.f + (c.tipo === "NOTA_CREDITO" ? -c.total : c.total), s: a.s + c.saldoPendiente }), { f: 0, s: 0 });
  const columnas: Column<Comprobante>[] = [
    { key: "t", header: "Tipo", cell: (c) => <span className="whitespace-nowrap">{TIPO_COMPROBANTE_LABEL[c.tipo]}{c.letra ? ` ${c.letra}` : ""}</span> },
    { key: "n", header: "Número", sortable: true, sortValue: (c) => c.numero, cell: (c) => <span className="whitespace-nowrap font-mono text-[12px]">{c.numero}</span> },
    { key: "ci", header: "Circuito", cell: (c) => <CircuitoBadge circuito={c.circuito} corto /> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (c) => c.fecha, cell: (c) => <span className="text-muted">{formatDate(c.fecha)}</span> },
    { key: "c", header: "Cliente", cell: (c) => <span className="block min-w-[150px]">{cliente(c.clienteId)?.nombreFantasia ?? cliente(c.clienteId)?.razonSocial}</span> },
    { key: "r", header: "Referencia", cell: (c) => <span className="whitespace-nowrap font-mono text-[11px] text-muted">{db.notasPedido.find((n) => n.id === c.notaPedidoId)?.numero ?? db.acopios.find((a) => a.id === c.acopioId)?.numero ?? "—"}</span> },
    { key: "to", header: "Total", align: "right", sortable: true, sortValue: (c) => c.total, footer: <span className="tnum">{formatMoney(tot.f, { decimals: false })}</span>, cell: (c) => <span className={cn("tnum", c.tipo === "NOTA_CREDITO" && "text-success")}>{c.tipo === "NOTA_CREDITO" ? "− " : ""}{formatMoney(c.total, { decimals: false })}</span> },
    { key: "s", header: "Saldo", align: "right", footer: <span className="tnum">{formatMoney(tot.s, { decimals: false })}</span>, cell: (c) => <span className="tnum">{formatMoney(c.saldoPendiente, { decimals: false })}</span> },
    { key: "e", header: "Estado", cell: (c) => <StatusBadge tipo="COMPROBANTE" estado={c.estado} /> },
  ];
  return (
    <>
      <PageHeader titulo="Comprobantes de venta" descripcion="Facturas F1 (fiscal) y F2 (interno) y notas de crédito, incluida la facturación de acopios." />
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(c) => c.id}
        onRowClick={setVer}
        searchText={(c) => `${c.numero} ${cliente(c.clienteId)?.razonSocial}`}
        initialSort={{ key: "f", dir: "desc" }}
        showFooter
        empty={!db.comprobantes.some((c) => c.clienteId && c.tipo !== "SALDO_A_FAVOR") ? <VacioGuiado pagina="comprobantes" icono={Receipt} /> : { icono: Receipt, titulo: "Sin comprobantes en el período" }}
        filters={
          <>
            <DateRangePicker value={periodo} onChange={setPeriodo} presets={PRESETS_LISTADO} />
            <div className="w-[130px]"><Select size="sm" aria-label="Circuito" value={circuito} onValueChange={setCircuito} options={circuitoOpts(veC2)} /></div>
            <div className="w-[150px]"><Select size="sm" aria-label="Tipo" value={tipo} onValueChange={setTipo} options={[{ value: "", label: "Todos los tipos" }, { value: "FACTURA", label: "Facturas" }, { value: "NOTA_CREDITO", label: "Notas de crédito" }]} /></div>
          </>
        }
      />
      {ver && (
        <PrintPreview open onOpenChange={(v) => !v && setVer(null)} titulo={`${TIPO_COMPROBANTE_LABEL[ver.tipo]} ${ver.numero}`}>
          <ComprobanteDocumento comprobante={ver} />
        </PrintPreview>
      )}
    </>
  );
}

// ───────────────────────── Recibos ─────────────────────────

export function RecibosView() {
  const db = useDb();
  const params = useSearchParams();
  const veC2 = useVeCircuito2();
  const sucursal = useSucursalActiva();
  const cliente = useCliente();
  const puede = usePuede("ctacte.cobrar");
  const [nuevo, setNuevo] = React.useState(params.get("nuevo") === "1");
  const [ver, setVer] = React.useState<Cobranza | null>(null);
  const [periodo, setPeriodo] = React.useState<Periodo>(() => periodoDesdePreset("90D"));
  const [circuito, setCircuito] = React.useState("");
  const filas = db.cobranzas.filter((c) => (veC2 || c.circuito !== 2) && (!sucursal || c.sucursalId === sucursal) && c.fecha >= periodo.desde && c.fecha <= periodo.hasta && (!circuito || String(c.circuito) === circuito));
  const total = filas.reduce((a, c) => a + c.total, 0);
  const imputadoA = (c: Cobranza) =>
    c.imputaciones
      .map((i) => {
        const cmp = db.comprobantes.find((x) => x.id === i.comprobanteId);
        const aco = cmp?.acopioId ? db.acopios.find((a) => a.id === cmp.acopioId) : undefined;
        return aco ? `Acopio ${aco.numero}` : cmp?.numero;
      })
      .join(", ");
  const columnas: Column<Cobranza>[] = [
    { key: "n", header: "Número", sortable: true, sortValue: (c) => c.numero, cell: (c) => <span className="whitespace-nowrap font-mono text-[12px]">{c.numero}</span> },
    { key: "ci", header: "Circuito", cell: (c) => <CircuitoBadge circuito={c.circuito} corto /> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (c) => c.fecha, cell: (c) => <span className="text-muted">{formatDate(c.fecha)}</span> },
    { key: "c", header: "Cliente", cell: (c) => <span className="block min-w-[150px]">{cliente(c.clienteId)?.nombreFantasia ?? cliente(c.clienteId)?.razonSocial}</span> },
    { key: "m", header: "Medios", cell: (c) => <span className="text-[12px] text-muted">{c.medios.map((m) => MEDIO_PAGO_LABEL[m.medio]).join(", ")}</span> },
    { key: "i", header: "Imputado a", cell: (c) => <span className="block max-w-[260px] truncate font-mono text-[11px] text-muted" title={imputadoA(c)}>{imputadoA(c) || "—"}</span> },
    { key: "t", header: "Total", align: "right", sortable: true, sortValue: (c) => c.total, footer: <span className="tnum">{formatMoney(total, { decimals: false })}</span>, cell: (c) => <span className="tnum">{formatMoney(c.total, { decimals: false })}</span> },
    { key: "af", header: "A favor", align: "right", cell: (c) => (c.saldoAFavor ? <span className="tnum text-success">{formatMoney(c.saldoAFavor, { decimals: false })}</span> : <span className="text-disabled">—</span>) },
  ];
  return (
    <>
      <PageHeader titulo="Recibos" descripcion="Entrada de fondos: cobros imputados a facturas y a acopios en cuenta corriente." acciones={puede && <Button onClick={() => setNuevo(true)}><Wallet /> Nuevo recibo</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Cobrado en el período" valor={formatMoney(total, { compact: true })} acento subtexto={`${filas.length} recibos`} />
        <KpiCard label="Cobros de acopios" valor={formatMoney(filas.filter((c) => c.imputaciones.some((i) => db.comprobantes.find((x) => x.id === i.comprobanteId)?.acopioId)).reduce((a, c) => a + c.total, 0), { compact: true })} />
        <KpiCard label="Cheques en cartera" valor={String(db.cheques.filter((c) => c.estado === "EN_CARTERA").length)} subtexto={formatMoney(db.cheques.filter((c) => c.estado === "EN_CARTERA").reduce((a, c) => a + c.importe, 0), { compact: true })} />
      </div>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(c) => c.id}
        onRowClick={setVer}
        searchText={(c) => `${c.numero} ${cliente(c.clienteId)?.razonSocial} ${imputadoA(c)}`}
        initialSort={{ key: "f", dir: "desc" }}
        showFooter
        empty={db.cobranzas.length === 0 ? <VacioGuiado pagina="recibos" icono={Wallet} onAccion={() => setNuevo(true)} puedeAccion={puede} /> : { icono: Wallet, titulo: "Sin recibos en el período" }}
        filters={
          <>
            <DateRangePicker value={periodo} onChange={setPeriodo} presets={PRESETS_LISTADO} />
            <div className="w-[130px]"><Select size="sm" aria-label="Circuito" value={circuito} onValueChange={setCircuito} options={circuitoOpts(veC2)} /></div>
          </>
        }
      />
      <CobranzaDialog open={nuevo} onOpenChange={setNuevo} />
      {ver && (
        <PrintPreview open onOpenChange={(v) => !v && setVer(null)} titulo={`Recibo ${ver.numero}`}>
          <ReciboDocumento cobranza={ver} />
        </PrintPreview>
      )}
    </>
  );
}

// ───────────────────────── Devoluciones ─────────────────────────

export function DevolucionesView() {
  const db = useDb();
  const router = useRouter();
  const veC2 = useVeCircuito2();
  const cliente = useCliente();
  const puede = usePuede("ventas.editar");
  const [elegir, setElegir] = React.useState(false);
  const [npId, setNpId] = React.useState("");
  const [np, setNp] = React.useState<NotaPedido | null>(null);
  const filas = db.devoluciones.filter((d) => veC2 || d.circuito !== 2);
  const columnas: Column<DevolucionNP>[] = [
    { key: "n", header: "Número", sortable: true, sortValue: (d) => d.numero, cell: (d) => <span className="whitespace-nowrap font-mono text-[12px]">{d.numero}</span> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (d) => d.fecha, cell: (d) => <span className="text-muted">{formatDate(d.fecha)}</span> },
    { key: "c", header: "Cliente", cell: (d) => <span className="block min-w-[150px]">{cliente(d.clienteId)?.nombreFantasia ?? cliente(d.clienteId)?.razonSocial}</span> },
    { key: "np", header: "Nota de pedido", cell: (d) => <Link onClick={(e) => e.stopPropagation()} href={`/ventas/notas-pedido/${d.notaPedidoId}`} className="whitespace-nowrap font-mono text-[12px] hover:underline">{db.notasPedido.find((n) => n.id === d.notaPedidoId)?.numero}</Link> },
    { key: "a", header: "Acopio", cell: (d) => (d.acopioId ? <Link onClick={(e) => e.stopPropagation()} href={`/acopios/${d.acopioId}`} className="whitespace-nowrap font-mono text-[12px] hover:underline">{db.acopios.find((a) => a.id === d.acopioId)?.numero}</Link> : <span className="text-disabled">—</span>) },
    { key: "m", header: "Monto", align: "right", sortable: true, sortValue: (d) => d.monto, cell: (d) => <span className="tnum">{formatMoney(d.monto)}</span> },
    { key: "rd", header: "RD / NC", cell: (d) => <span className="whitespace-nowrap font-mono text-[11px] text-muted">{[db.remitos.find((r) => r.id === d.remitoDevolucionId)?.numero ?? d.remitosRef?.join(", "), db.comprobantes.find((c) => c.id === d.notaCreditoId)?.numero ?? d.notasCreditoRef?.join(", ")].filter(Boolean).join(" · ") || "—"}</span> },
    { key: "mo", header: "Motivo", cell: (d) => <span className="block min-w-[200px] text-[12px] text-muted">{d.motivo}</span> },
  ];
  const candidatas = db.notasPedido.filter((n) => n.estado !== "BORRADOR" && n.estado !== "ANULADA" && n.items.some((i) => i.cantidad - (i.devueltos ?? 0) > 0));
  return (
    <>
      <PageHeader titulo="Devoluciones" descripcion="Devoluciones de notas de pedido (DP): remito de devolución, nota de crédito y saldo de acopio." acciones={puede && <Button onClick={() => setElegir(true)}><Undo2 /> Nueva devolución</Button>} />
      <DataTable rows={filas} columns={columnas} getRowId={(d) => d.id} onRowClick={(d) => router.push(`/ventas/notas-pedido/${d.notaPedidoId}`)} searchText={(d) => `${d.numero} ${cliente(d.clienteId)?.razonSocial} ${d.motivo}`} initialSort={{ key: "f", dir: "desc" }} empty={db.devoluciones.length === 0 ? <VacioGuiado pagina="devoluciones" icono={Undo2} /> : { icono: Undo2, titulo: "No hay devoluciones para el filtro" }} />
      <Dialog open={elegir} onOpenChange={setElegir}>
        <DialogContent size="md" title="Nueva devolución" description="Elegí la nota de pedido a devolver." footer={<><Button variant="secondary" onClick={() => setElegir(false)}>Cancelar</Button><Button disabled={!npId} onClick={() => { setNp(db.notasPedido.find((n) => n.id === npId) ?? null); setElegir(false); }}>Continuar</Button></>}>
          {candidatas.length === 0 && <p className="mb-3 text-[13px] text-muted">No hay notas de pedido confirmadas con mercadería para devolver.</p>}
          <Combobox aria-label="Nota de pedido" value={npId} onChange={setNpId} placeholder="Buscar NP por número o cliente…" opciones={candidatas.map((n) => ({ value: n.id, label: `${n.numero} · ${cliente(n.clienteId)?.nombreFantasia ?? cliente(n.clienteId)?.razonSocial}`, detalle: formatDate(n.fecha) }))} />
        </DialogContent>
      </Dialog>
      {np && <DevolucionDialog np={np} open onOpenChange={(v) => !v && setNp(null)} />}
    </>
  );
}

// ───────────────────────── Obras ─────────────────────────

export function ObrasView() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const cliente = useCliente();
  const puede = usePuede("ventas.editar");
  const [nueva, setNueva] = React.useState<string | null>(null);
  const [elegir, setElegir] = React.useState(params.get("nuevo") === "1");
  const [cliId, setCliId] = React.useState(params.get("cliente") ?? "");
  const filas = db.obras;
  const columnas: Column<Obra>[] = [
    { key: "n", header: "Obra", sortable: true, sortValue: (o) => o.nombre, cell: (o) => <span className="block min-w-[180px] font-medium">{o.nombre}</span> },
    { key: "c", header: "Cliente", sortable: true, sortValue: (o) => cliente(o.clienteId)?.razonSocial ?? "", cell: (o) => <span>{cliente(o.clienteId)?.nombreFantasia ?? cliente(o.clienteId)?.razonSocial}</span> },
    { key: "d", header: "Dirección", cell: (o) => <span className="text-muted">{[o.direccion, o.localidad].filter(Boolean).join(", ") || "—"}</span> },
    { key: "a", header: "Acopios", align: "right", cell: (o) => <span className="tnum">{db.acopios.filter((a) => a.obraIds.includes(o.id)).length || "—"}</span> },
    { key: "np", header: "Notas de pedido", align: "right", cell: (o) => <span className="tnum">{db.notasPedido.filter((n) => n.items.some((i) => i.obraId === o.id)).length || "—"}</span> },
    { key: "e", header: "Estado", cell: (o) => (o.activa ? <Badge variant="success">Activa</Badge> : <Badge>Inactiva</Badge>) },
  ];
  return (
    <>
      <PageHeader titulo="Obras" descripcion="Obras de cada cliente: a qué obra va cada línea de venta y cada acopio." acciones={puede && <Button onClick={() => setElegir(true)}><Plus /> Nueva obra</Button>} />
      <DataTable rows={filas} columns={columnas} getRowId={(o) => o.id} onRowClick={(o) => router.push(`/clientes/${o.clienteId}`)} searchText={(o) => `${o.nombre} ${cliente(o.clienteId)?.razonSocial} ${o.localidad ?? ""}`} initialSort={{ key: "c", dir: "asc" }} empty={db.obras.length === 0 ? <VacioGuiado pagina="obras" icono={HardHat} extra={puede && <Button size="sm" onClick={() => setElegir(true)}><Plus /> Nueva obra</Button>} /> : { icono: HardHat, titulo: "No hay obras para el filtro" }} />
      <Dialog open={elegir} onOpenChange={setElegir}>
        <DialogContent size="sm" title="Nueva obra" description="Elegí el cliente (o crealo acá mismo)." footer={<><Button variant="secondary" onClick={() => setElegir(false)}>Cancelar</Button><Button disabled={!cliId} onClick={() => { setNueva(cliId); setElegir(false); }}>Continuar</Button></>}>
          <SelectorCliente value={cliId} onChange={setCliId} />
        </DialogContent>
      </Dialog>
      {nueva && <NuevaObraDialog clienteId={nueva} open onOpenChange={(v) => !v && setNueva(null)} />}
    </>
  );
}

