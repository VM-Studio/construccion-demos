"use client";
/**
 * Ventas por Mercado Libre: la factura sale a nombre del comprador (nombre y CUIT/DNI), baja el
 * stock y, cuando Mercado Pago acredita la plata, se registra lo acreditado y la diferencia queda
 * como comisión (así la factura queda cancelada aunque no entre el total).
 */
import * as React from "react";
import { toast } from "sonner";
import { Plus, ShoppingBag, Wallet } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useUsuario } from "@/store/selectors";
import type { Circuito, Comprobante, Producto } from "@/domain/types";
import { precioLista } from "@/domain/precios";
import { calcularTotales } from "@/domain/ventas";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { ItemsGrid, type LineaBase } from "@/components/shared/items-grid";
import { PrintPreview } from "@/components/shared/print-layout";
import { ComprobanteDocumento } from "@/components/modulos/cuentas/documentos";
import { AccionesComprobante } from "./ventas-listados";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NumberInput } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { newId } from "@/lib/utils";
import { obtenerDb } from "@/lib/datos/almacen";

const CLIENTE_MELI = "__MELI__";
const r2 = (n: number) => Math.round(n * 100) / 100;

export function MercadoLibreView() {
  const db = useDb();
  const puede = usePuede("ventas.facturar");
  const [nueva, setNueva] = React.useState(false);
  const [acreditar, setAcreditar] = React.useState<Comprobante | null>(null);
  const [ver, setVer] = React.useState<Comprobante | null>(null);
  const meli = db.clientes.find((c) => c.codigo === "MELI");
  const filas = db.comprobantes.filter((c) => c.tipo === "FACTURA" && (c.ventaML || (meli && c.clienteId === meli.id)));
  const vigentes = filas.filter((c) => c.estado !== "ANULADO");
  const comision = (c: Comprobante) => db.cobranzas.filter((r) => !r.anulado && r.imputaciones.some((i) => i.comprobanteId === c.id)).flatMap((r) => r.medios).filter((m) => m.medio === "COMISION").reduce((a, m) => a + m.importe, 0);
  const columnas: Column<Comprobante>[] = [
    { key: "f", header: "Fecha", sortable: true, sortValue: (c) => c.fecha, cell: (c) => <span className="text-muted">{formatDate(c.fecha)}</span> },
    { key: "n", header: "Factura", cell: (c) => <span className="whitespace-nowrap font-mono text-[12px]">{c.numero}</span> },
    { key: "ml", header: "Venta ML", cell: (c) => <span className="font-mono text-[12px] text-muted">{c.ventaML ?? "—"}</span> },
    { key: "c", header: "Comprador", cell: (c) => <span className="block min-w-[150px]">{c.compradorNombre ?? "—"}<span className="block text-[11px] text-muted">{c.compradorDoc ?? ""}</span></span> },
    { key: "t", header: "Total", align: "right", sortable: true, sortValue: (c) => c.total, cell: (c) => <span className="tnum">{formatMoney(c.total)}</span> },
    { key: "co", header: "Comisión", align: "right", cell: (c) => <span className="text-muted tnum">{comision(c) ? formatMoney(comision(c)) : "—"}</span> },
    { key: "e", header: "Estado", cell: (c) => (c.estado === "PENDIENTE" || c.estado === "PARCIAL" ? <Badge variant="warning">Falta acreditar</Badge> : <StatusBadge tipo="COMPROBANTE" estado={c.estado} />) },
    {
      key: "a",
      header: "",
      align: "right",
      cell: (c) =>
        c.saldoPendiente > 0.009 && c.estado !== "ANULADO" && puede ? (
          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setAcreditar(c); }}><Wallet /> Acreditación</Button>
        ) : null,
    },
  ];
  return (
    <>
      <PageHeader titulo="Mercado Libre" acciones={puede && <Button onClick={() => setNueva(true)}><Plus /> Nueva venta Mercado Libre</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Vendido" valor={formatMoney(vigentes.reduce((a, c) => a + c.total, 0), { compact: true })} acento subtexto={`${vigentes.length} ventas`} />
        <KpiCard label="Falta acreditar" valor={formatMoney(vigentes.reduce((a, c) => a + c.saldoPendiente, 0), { compact: true })} />
        <KpiCard label="Comisiones" valor={formatMoney(vigentes.reduce((a, c) => a + comision(c), 0), { compact: true })} />
      </div>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(c) => c.id}
        onRowClick={setVer}
        searchText={(c) => `${c.numero} ${c.ventaML ?? ""} ${c.compradorNombre ?? ""} ${c.compradorDoc ?? ""}`}
        initialSort={{ key: "f", dir: "desc" }}
        empty={{ icono: ShoppingBag, titulo: "Todavía no hay ventas por Mercado Libre" }}
      />
      {nueva && <NuevaVentaMLDialog onClose={() => setNueva(false)} />}
      {acreditar && <AcreditacionDialog factura={acreditar} onClose={() => setAcreditar(null)} />}
      {ver && (
        <PrintPreview open onOpenChange={(v) => !v && setVer(null)} titulo={`Factura ${ver.numero}`} acciones={<AccionesComprobante comprobante={db.comprobantes.find((c) => c.id === ver.id) ?? ver} onAnulado={() => setVer(null)} />}>
          <ComprobanteDocumento comprobante={db.comprobantes.find((c) => c.id === ver.id) ?? ver} />
        </PrintPreview>
      )}
    </>
  );
}

function NuevaVentaMLDialog({ onClose }: { onClose: () => void }) {
  const db = useDb();
  const usuario = useUsuario();
  const sucursal = db.sucursales.find((s) => s.id === usuario?.sucursalId) ?? db.sucursales[0];
  const lista = db.listasPrecios.find((l) => l.id === "lst_pub")?.id ?? db.listasPrecios[0]?.id ?? "";
  const [comprador, setComprador] = React.useState({ nombre: "", doc: "", venta: "" });
  const [circuito, setCircuito] = React.useState<Circuito>(1);
  const [items, setItems] = React.useState<LineaBase[]>([]);
  const [acreditado, setAcreditado] = React.useState(false);
  const [neto, setNeto] = React.useState(0);
  const [cargando, setCargando] = React.useState(false);
  const t = calcularTotales(items.map((i) => ({ cantidad: i.cantidad, precioUnitario: i.precio ?? 0, descuentoPct: i.descuentoPct })), 0, circuito === 1 ? db.config.ivaPct : 0);
  const crear = async () => {
    if (!comprador.nombre.trim()) return toast.error("Cargá el nombre del comprador.");
    if (!items.length) return toast.error("Agregá lo que se vendió.");
    if (acreditado && (neto <= 0 || neto > t.total + 0.01)) return toast.error("El importe acreditado tiene que ser mayor a cero y no superar el total.");
    setCargando(true);
    const medios = acreditado ? [{ medio: "MERCADOPAGO" as const, importe: r2(neto), referencia: comprador.venta ? `Venta ML ${comprador.venta}` : undefined }, ...(t.total - neto > 0.009 ? [{ medio: "COMISION" as const, importe: r2(t.total - neto), referencia: "Comisión Mercado Libre" }] : [])] : undefined;
    const r = await useStore.getState().crearVenta(
      {
        clienteId: CLIENTE_MELI,
        sucursalId: sucursal?.id ?? "",
        depositoId: sucursal?.depositoId ?? "",
        fecha: new Date().toISOString(),
        circuito,
        origen: "NUEVA",
        formaPago: "CUENTA_CORRIENTE",
        items: items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, precioUnitario: i.precio ?? 0, descuentoPct: i.descuentoPct, unidadVenta: i.unidadVenta })),
        descuentoPct: 0,
        pendienteEntrega: false,
        modalidadEntrega: "RETIRA",
        observaciones: comprador.venta ? `Mercado Libre · venta ${comprador.venta}` : "Mercado Libre",
      },
      undefined,
      { retiraAhora: true, facturar: true, cobro: medios ? { medios } : undefined, datosFactura: { ventaML: comprador.venta.trim() || undefined, compradorNombre: comprador.nombre.trim(), compradorDoc: comprador.doc.replace(/\D/g, "") || undefined } },
    );
    setCargando(false);
    if (!r.ok) return toast.error(r.error);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        size="xl"
        title="Nueva venta Mercado Libre"
        footer={
          <>
            <span className="mr-auto text-[13px] text-muted">Total <b className="text-ink tnum">{formatMoney(t.total)}</b></span>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button loading={cargando} onClick={crear}>Facturar venta</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <FormField label="Comprador" required className="sm:col-span-2" htmlFor="ml-n"><Input id="ml-n" autoFocus value={comprador.nombre} onChange={(e) => setComprador({ ...comprador, nombre: e.target.value })} /></FormField>
            <FormField label="CUIT / DNI" htmlFor="ml-d"><Input id="ml-d" inputMode="numeric" value={comprador.doc} onChange={(e) => setComprador({ ...comprador, doc: e.target.value })} /></FormField>
            <FormField label="Nº de venta ML" htmlFor="ml-v"><Input id="ml-v" value={comprador.venta} onChange={(e) => setComprador({ ...comprador, venta: e.target.value })} /></FormField>
            <FormField label="Comprobante" className="sm:col-span-2">
              <Segmented value={String(circuito) as "1" | "2"} onChange={(v) => setCircuito(Number(v) as Circuito)} options={[{ value: "1", label: "Factura fiscal (F1)" }, { value: "2", label: "Interno (F2)" }]} />
            </FormField>
          </div>
          <ItemsGrid
            items={items}
            onChange={setItems}
            crearItem={(p: Producto) => ({ id: newId("l"), productoId: p.id, cantidad: 1, precio: precioLista(p.id, lista, obtenerDb()), descuentoPct: 0 })}
            listaId={lista}
            depositoId={sucursal?.depositoId}
            totales={{ descuentoPct: 0, ivaPct: circuito === 1 ? db.config.ivaPct : 0 }}
          />
          <div className="rounded-card border border-border p-3">
            <label className="flex items-center gap-2 text-[13px]"><Switch checked={acreditado} onCheckedChange={(v) => { setAcreditado(v); if (v && !neto) setNeto(t.total); }} /> Mercado Pago ya acreditó la plata</label>
            {acreditado && (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
                <label className="flex items-center gap-2">Acreditado <NumberInput aria-label="Importe acreditado" value={neto} min={0} onValueChange={setNeto} className="h-8 w-36" /></label>
                <span className="text-muted">Comisión <b className="text-ink tnum">{formatMoney(Math.max(0, t.total - neto))}</b></span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Lo que acreditó Mercado Pago; la diferencia con la factura queda como comisión. */
function AcreditacionDialog({ factura, onClose }: { factura: Comprobante; onClose: () => void }) {
  const [neto, setNeto] = React.useState(factura.saldoPendiente);
  const [cargando, setCargando] = React.useState(false);
  const comision = r2(factura.saldoPendiente - neto);
  const confirmar = async () => {
    setCargando(true);
    const r = await useStore.getState().registrarCobranza({
      clienteId: factura.clienteId!,
      circuito: factura.circuito,
      fecha: new Date().toISOString(),
      sucursalId: factura.sucursalId,
      medios: [{ medio: "MERCADOPAGO", importe: r2(neto), referencia: factura.ventaML ? `Venta ML ${factura.ventaML}` : undefined }, ...(comision > 0.009 ? [{ medio: "COMISION" as const, importe: comision, referencia: "Comisión Mercado Libre" }] : [])],
      imputaciones: [{ comprobanteId: factura.id, importe: factura.saldoPendiente }],
      observaciones: factura.ventaML ? `Acreditación venta ML ${factura.ventaML}` : "Acreditación Mercado Libre",
    });
    setCargando(false);
    if (!r.ok) return toast.error(r.error);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        size="sm"
        title={`Acreditación de ${factura.numero}`}
        description={`${factura.compradorNombre ?? ""} · saldo ${formatMoney(factura.saldoPendiente)}`}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button loading={cargando} disabled={neto <= 0 || neto > factura.saldoPendiente + 0.01} onClick={confirmar}>Registrar</Button>
          </>
        }
      >
        <div className="space-y-3 text-[13px]">
          <FormField label="Importe acreditado por Mercado Pago" htmlFor="acr-n"><NumberInput id="acr-n" value={neto} min={0} onValueChange={setNeto} /></FormField>
          <p>Comisión de Mercado Libre: <b className="tnum">{formatMoney(Math.max(0, comision))}</b></p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
