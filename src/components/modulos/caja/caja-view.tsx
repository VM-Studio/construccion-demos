"use client";
/**
 * Caja chica: lo que hay en cada cajón, en pesos y en dólares. Los cobros y pagos en efectivo
 * entran y salen solos (con link a la venta o al pago); los gastos sueltos, transferencias y
 * préstamos entre cajas se cargan acá; el arqueo compara el sistema con lo contado.
 */
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeftRight, Calculator, Ban, Minus, Plus, Settings2, Wallet } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede } from "@/store/selectors";
import type { Caja, Moneda, MovimientoCaja } from "@/domain/types";
import { CATEGORIAS_CAJA, DENOMINACIONES, movimientosConSaldo, prestamosPendientes, saldoCaja, TIPO_MOVIMIENTO_CAJA_LABEL, totalBilletes } from "@/domain/caja";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DateRangePicker } from "@/components/shared/filter-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NumberInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PRESETS_LISTADO, diaLocal, periodoDesdePreset, type Periodo } from "@/lib/periodos";
import { formatUSD } from "@/lib/tipo-cambio";
import { cn } from "@/lib/utils";

const m$ = (n: number, moneda: Moneda) => (moneda === "USD" ? formatUSD(n) : formatMoney(n));
const deInput = (v: string) => {
  const [y, mo, d] = v.split("-").map(Number);
  const n = new Date();
  return new Date(y, mo - 1, d, n.getHours(), n.getMinutes()).toISOString();
};

export function CajaView() {
  const db = useDb();
  const puedeOperar = usePuede("caja.operar");
  const puedeAdmin = usePuede("caja.administrar");
  const cajas = db.cajas.filter((c) => c.activa).sort((a, b) => a.orden - b.orden);
  const [cajaId, setCajaId] = React.useState<string>(cajas[0]?.id ?? "");
  const caja = db.cajas.find((c) => c.id === cajaId) ?? cajas[0];
  const [moneda, setMoneda] = React.useState<Moneda>("ARS");
  const [periodo, setPeriodo] = React.useState<Periodo>(() => periodoDesdePreset("30D"));
  const [dialogo, setDialogo] = React.useState<"INGRESO" | "EGRESO" | "ENTRE" | "ARQUEO" | "CAJAS" | null>(null);
  const [anular, setAnular] = React.useState<MovimientoCaja | null>(null);
  const prestamos = prestamosPendientes(db.movimientosCaja);
  const nombreCaja = (id?: string) => db.cajas.find((c) => c.id === id)?.nombre ?? "";
  const movs = React.useMemo(() => (caja ? movimientosConSaldo(caja.id, db.movimientosCaja).filter((m) => m.moneda === moneda && m.fecha >= periodo.desde && m.fecha <= periodo.hasta) : []), [caja, db.movimientosCaja, moneda, periodo]);
  const ingresos = movs.filter((m) => !m.anulado && m.signo === 1).reduce((a, m) => a + m.importe, 0);
  const egresos = movs.filter((m) => !m.anulado && m.signo === -1).reduce((a, m) => a + m.importe, 0);

  /** Link al origen del movimiento: el recibo lleva a la venta que pagó. */
  const origen = (m: MovimientoCaja) => {
    if (m.referenciaTipo === "RECIBO") {
      const rec = db.cobranzas.find((r) => r.id === m.referenciaId);
      const np = rec?.imputaciones.map((i) => db.comprobantes.find((c) => c.id === i.comprobanteId)?.notaPedidoId).find(Boolean);
      return np ? { href: `/ventas/notas-pedido/${np}`, texto: `Venta ${db.notasPedido.find((n) => n.id === np)?.numero ?? ""}` } : { href: `/ventas/recibos?id=${m.referenciaId}`, texto: `Recibo ${rec?.numero ?? ""}` };
    }
    if (m.referenciaTipo === "ORDEN_PAGO") return { href: `/compras/ordenes-pago?id=${m.referenciaId}`, texto: `Pago ${db.pagosProveedores.find((p) => p.id === m.referenciaId)?.numero ?? ""}` };
    return null;
  };
  const columnas: Column<(typeof movs)[number]>[] = [
    { key: "f", header: "Fecha", sortable: true, sortValue: (m) => m.fecha, cell: (m) => <span className="whitespace-nowrap text-muted">{formatDateTime(m.fecha)}</span> },
    {
      key: "c",
      header: "Concepto",
      cell: (m) => {
        const o = origen(m);
        return (
          <span className={cn("block min-w-[200px]", m.anulado && "text-muted line-through")}>
            {m.concepto}
            {m.tipo !== "INGRESO" && m.tipo !== "EGRESO" && <Badge className="ml-2">{TIPO_MOVIMIENTO_CAJA_LABEL[m.tipo]}</Badge>}
            {o && <Link href={o.href} onClick={(e) => e.stopPropagation()} className="ml-2 text-[12px] text-muted underline underline-offset-2 hover:text-ink">{o.texto}</Link>}
            {m.anulado && <span className="block text-[11px] no-underline">Anulado{m.motivoAnulacion ? `: ${m.motivoAnulacion}` : ""}</span>}
          </span>
        );
      },
    },
    { key: "cat", header: "Categoría", cell: (m) => <span className="text-[12px] text-muted">{m.categoria ?? (m.referenciaTipo === "RECIBO" ? "Cobros" : m.referenciaTipo === "ORDEN_PAGO" ? "Pagos a proveedores" : "—")}</span>, hideOnMobile: true },
    { key: "u", header: "Usuario", cell: (m) => <span className="text-[12px] text-muted">{db.usuarios.find((u) => u.id === m.usuarioId)?.nombre ?? ""}</span>, hideOnMobile: true },
    { key: "i", header: "Ingreso", align: "right", cell: (m) => (m.signo === 1 ? <span className={cn("tnum text-success", m.anulado && "text-muted line-through")}>{m$(m.importe, m.moneda)}</span> : null) },
    { key: "e", header: "Egreso", align: "right", cell: (m) => (m.signo === -1 ? <span className={cn("tnum", m.anulado && "text-muted line-through")}>{m$(m.importe, m.moneda)}</span> : null) },
    { key: "s", header: "Saldo", align: "right", cell: (m) => <span className="font-medium tnum">{m$(m.saldo, m.moneda)}</span> },
    {
      key: "a",
      header: "",
      align: "right",
      cell: (m) => (puedeOperar && !m.anulado && m.referenciaTipo === "MANUAL" ? <Button size="icon-sm" variant="ghost" aria-label="Anular movimiento" onClick={(e) => { e.stopPropagation(); setAnular(m); }}><Ban className="text-muted" /></Button> : null),
    },
  ];
  if (!caja)
    return (
      <>
        <PageHeader titulo="Caja chica" acciones={puedeAdmin && <Button onClick={() => setDialogo("CAJAS")}><Plus /> Crear caja</Button>} />
        <Card className="p-8 text-center text-[13px] text-muted">No hay cajas activas.</Card>
        {dialogo === "CAJAS" && <CajasDialog onClose={() => setDialogo(null)} />}
      </>
    );
  return (
    <>
      <PageHeader
        titulo="Caja chica"
        acciones={
          <>
            {puedeAdmin && <Button variant="ghost" onClick={() => setDialogo("CAJAS")}><Settings2 /> Cajas</Button>}
            {puedeOperar && (
              <>
                <Button variant="secondary" onClick={() => setDialogo("ARQUEO")}><Calculator /> Arqueo</Button>
                {cajas.length > 1 && <Button variant="secondary" onClick={() => setDialogo("ENTRE")}><ArrowLeftRight /> Entre cajas</Button>}
                <Button variant="secondary" onClick={() => setDialogo("EGRESO")}><Minus /> Egreso</Button>
                <Button onClick={() => setDialogo("INGRESO")}><Plus /> Ingreso</Button>
              </>
            )}
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cajas.map((c) => (
          <button key={c.id} onClick={() => setCajaId(c.id)} className={cn("rounded-card border bg-surface p-3 text-left transition-colors", c.id === caja.id ? "border-ink" : "border-border hover:border-border-strong")}>
            <div className="flex items-center gap-2 text-[13px] font-medium"><Wallet className="size-4 text-muted" /> {c.nombre}</div>
            <div className="mt-1 text-[20px] font-semibold tnum">{formatMoney(saldoCaja(c.id, "ARS", db.movimientosCaja))}</div>
            <div className="text-[12px] text-muted tnum">{formatUSD(saldoCaja(c.id, "USD", db.movimientosCaja))}</div>
          </button>
        ))}
      </div>
      {prestamos.length > 0 && (
        <Card className="mb-4 p-3">
          <h3 className="mb-2 text-[13px] font-semibold">Préstamos entre cajas sin devolver</h3>
          <ul className="space-y-1 text-[13px]">
            {prestamos.map((p) => (
              <li key={`${p.acreedorId}${p.deudorId}${p.moneda}`}>
                <b>{nombreCaja(p.deudorId)}</b> le debe a <b>{nombreCaja(p.acreedorId)}</b> <span className="tnum">{m$(p.saldo, p.moneda)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Tabs defaultValue="mov">
        <TabsList className="mb-3">
          <TabsTrigger value="mov">Movimientos</TabsTrigger>
          <TabsTrigger value="arq">Arqueos</TabsTrigger>
        </TabsList>
        <TabsContent value="mov">
          <div className="mb-3 grid grid-cols-3 gap-3">
            <Card className="p-3"><div className="text-[12px] text-muted">Ingresos del período</div><div className="font-semibold text-success tnum">{m$(ingresos, moneda)}</div></Card>
            <Card className="p-3"><div className="text-[12px] text-muted">Egresos del período</div><div className="font-semibold tnum">{m$(egresos, moneda)}</div></Card>
            <Card className="p-3"><div className="text-[12px] text-muted">Saldo actual</div><div className="font-semibold tnum">{m$(saldoCaja(caja.id, moneda, db.movimientosCaja), moneda)}</div></Card>
          </div>
          <DataTable
            rows={movs}
            columns={columnas}
            getRowId={(m) => m.id}
            searchText={(m) => `${m.concepto} ${m.categoria ?? ""}`}
            initialSort={{ key: "f", dir: "desc" }}
            empty={{ icono: Wallet, titulo: "Sin movimientos en el período" }}
            filters={
              <>
                <Segmented value={moneda} onChange={setMoneda} options={[{ value: "ARS", label: "Pesos" }, { value: "USD", label: "Dólares" }]} />
                <DateRangePicker value={periodo} onChange={setPeriodo} presets={PRESETS_LISTADO} />
              </>
            }
          />
        </TabsContent>
        <TabsContent value="arq">
          <Card>
            <table className="w-full text-table">
              <thead className="bg-[#FAFAF8] text-[12px] text-muted">
                <tr><th className="h-9 px-3 text-left font-medium">Fecha</th><th className="h-9 px-3 text-left font-medium">Usuario</th><th className="h-9 px-3 text-right font-medium">Sistema</th><th className="h-9 px-3 text-right font-medium">Contado</th><th className="h-9 px-3 text-right font-medium">Diferencia</th><th className="h-9 px-3 text-left font-medium">Observaciones</th></tr>
              </thead>
              <tbody>
                {db.arqueosCaja.filter((a) => a.cajaId === caja.id).sort((a, b) => b.fecha.localeCompare(a.fecha)).map((a) => (
                  <tr key={a.id} className="h-9 border-t border-border">
                    <td className="px-3 text-muted">{formatDateTime(a.fecha)}</td>
                    <td className="px-3 text-muted">{db.usuarios.find((u) => u.id === a.usuarioId)?.nombre}</td>
                    <td className="px-3 text-right tnum">{m$(a.saldoSistema, a.moneda)}</td>
                    <td className="px-3 text-right tnum">{m$(a.contado, a.moneda)}</td>
                    <td className={cn("px-3 text-right font-medium tnum", Math.abs(a.diferencia) > 0.009 ? (a.diferencia < 0 ? "text-danger" : "text-warning") : "text-success")}>{Math.abs(a.diferencia) < 0.01 ? "Coincide" : m$(a.diferencia, a.moneda)}</td>
                    <td className="px-3 text-[12px] text-muted">{a.observaciones}</td>
                  </tr>
                ))}
                {!db.arqueosCaja.some((a) => a.cajaId === caja.id) && <tr><td colSpan={6} className="py-8 text-center text-[13px] text-muted">Todavía no se hicieron arqueos de esta caja.</td></tr>}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
      {(dialogo === "INGRESO" || dialogo === "EGRESO") && <MovimientoDialog tipo={dialogo} cajaId={caja.id} onClose={() => setDialogo(null)} />}
      {dialogo === "ENTRE" && <EntreCajasDialog origenId={caja.id} onClose={() => setDialogo(null)} />}
      {dialogo === "ARQUEO" && <ArqueoDialog caja={caja} onClose={() => setDialogo(null)} />}
      {dialogo === "CAJAS" && <CajasDialog onClose={() => setDialogo(null)} />}
      {anular && <AnularMovimientoDialog mov={anular} onClose={() => setAnular(null)} />}
    </>
  );
}

function MovimientoDialog({ tipo, cajaId, onClose }: { tipo: "INGRESO" | "EGRESO"; cajaId: string; onClose: () => void }) {
  const db = useDb();
  const [d, setD] = React.useState({ cajaId, fecha: diaLocal(new Date()), moneda: "ARS" as Moneda, importe: 0, concepto: "", categoria: "", apertura: false });
  const [cargando, setCargando] = React.useState(false);
  const guardar = async () => {
    setCargando(true);
    const r = await useStore.getState().registrarMovimientoCaja({ cajaId: d.cajaId, fecha: deInput(d.fecha), tipo: d.apertura ? "APERTURA" : tipo, moneda: d.moneda, importe: d.importe, concepto: d.concepto || (d.apertura ? "Saldo inicial" : ""), categoria: d.categoria || undefined });
    setCargando(false);
    if (!r.ok) return toast.error(r.error);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="md" title={tipo === "INGRESO" ? "Ingreso de caja" : "Egreso de caja"} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={cargando} onClick={guardar}>Guardar</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Caja"><Select value={d.cajaId} onValueChange={(v) => setD({ ...d, cajaId: v })} options={db.cajas.filter((c) => c.activa).map((c) => ({ value: c.id, label: c.nombre }))} /></FormField>
          <FormField label="Fecha" htmlFor="mc-f"><Input id="mc-f" type="date" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></FormField>
          <FormField label="Moneda"><Segmented value={d.moneda} onChange={(v) => setD({ ...d, moneda: v })} options={[{ value: "ARS", label: "Pesos" }, { value: "USD", label: "Dólares" }]} /></FormField>
          <FormField label="Importe" htmlFor="mc-i"><NumberInput id="mc-i" value={d.importe} min={0} onValueChange={(v) => setD({ ...d, importe: v })} /></FormField>
          <FormField label="Concepto" required className="sm:col-span-2" htmlFor="mc-c"><Input id="mc-c" autoFocus value={d.concepto} onChange={(e) => setD({ ...d, concepto: e.target.value })} placeholder={tipo === "EGRESO" ? "Ej. Pago Gabriel flete" : "Ej. Aporte de socios"} /></FormField>
          <FormField label="Categoría" className="sm:col-span-2"><Select value={d.categoria} onValueChange={(v) => setD({ ...d, categoria: v })} options={[{ value: "", label: "Sin categoría" }, ...CATEGORIAS_CAJA.map((c) => ({ value: c, label: c }))]} /></FormField>
          {tipo === "INGRESO" && <label className="flex items-center gap-2 text-[13px] sm:col-span-2"><Switch checked={d.apertura} onCheckedChange={(v) => setD({ ...d, apertura: v })} /> Es el saldo inicial de la caja</label>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EntreCajasDialog({ origenId, onClose }: { origenId: string; onClose: () => void }) {
  const db = useDb();
  const cajas = db.cajas.filter((c) => c.activa);
  const [d, setD] = React.useState({ origenId, destinoId: cajas.find((c) => c.id !== origenId)?.id ?? "", tipo: "TRANSFERENCIA" as "TRANSFERENCIA" | "PRESTAMO" | "DEVOLUCION_PRESTAMO", moneda: "ARS" as Moneda, importe: 0, concepto: "" });
  const [cargando, setCargando] = React.useState(false);
  const deuda = prestamosPendientes(db.movimientosCaja).find((p) => p.deudorId === d.origenId && p.acreedorId === d.destinoId && p.moneda === d.moneda)?.saldo ?? 0;
  const guardar = async () => {
    setCargando(true);
    const r = await useStore.getState().transferirEntreCajas({ ...d, fecha: new Date().toISOString(), concepto: d.concepto || undefined });
    setCargando(false);
    if (!r.ok) return toast.error(r.error);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="md" title="Movimiento entre cajas" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={cargando} onClick={guardar}>Guardar</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Qué es" className="sm:col-span-2"><Segmented value={d.tipo} onChange={(v) => setD({ ...d, tipo: v })} options={[{ value: "TRANSFERENCIA", label: "Transferencia" }, { value: "PRESTAMO", label: "Préstamo" }, { value: "DEVOLUCION_PRESTAMO", label: "Devolución de préstamo" }]} /></FormField>
          <FormField label="Sale de"><Select value={d.origenId} onValueChange={(v) => setD({ ...d, origenId: v })} options={cajas.map((c) => ({ value: c.id, label: c.nombre }))} /></FormField>
          <FormField label="Entra en"><Select value={d.destinoId} onValueChange={(v) => setD({ ...d, destinoId: v })} options={cajas.filter((c) => c.id !== d.origenId).map((c) => ({ value: c.id, label: c.nombre }))} /></FormField>
          <FormField label="Moneda"><Segmented value={d.moneda} onChange={(v) => setD({ ...d, moneda: v })} options={[{ value: "ARS", label: "Pesos" }, { value: "USD", label: "Dólares" }]} /></FormField>
          <FormField label="Importe" htmlFor="ec-i" hint={d.tipo === "DEVOLUCION_PRESTAMO" ? `Debe ${m$(deuda, d.moneda)}` : undefined}><NumberInput id="ec-i" value={d.importe} min={0} onValueChange={(v) => setD({ ...d, importe: v })} /></FormField>
          <FormField label="Detalle (opcional)" className="sm:col-span-2" htmlFor="ec-c"><Input id="ec-c" value={d.concepto} onChange={(e) => setD({ ...d, concepto: e.target.value })} /></FormField>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Arqueo con contador de billetes (la "calculadora $" de la planilla). */
function ArqueoDialog({ caja, onClose }: { caja: Caja; onClose: () => void }) {
  const db = useDb();
  const puedeAjustar = usePuede("caja.administrar");
  const [moneda, setMoneda] = React.useState<Moneda>("ARS");
  const [billetes, setBilletes] = React.useState<Record<number, number>>({});
  const [obs, setObs] = React.useState("");
  const [ajustar, setAjustar] = React.useState(false);
  const [cargando, setCargando] = React.useState(false);
  const lista = DENOMINACIONES[moneda].map((denominacion) => ({ denominacion, cantidad: billetes[denominacion] ?? 0 }));
  const contado = totalBilletes(lista);
  const sistema = saldoCaja(caja.id, moneda, db.movimientosCaja);
  const dif = Math.round((contado - sistema) * 100) / 100;
  const guardar = async () => {
    setCargando(true);
    const r = await useStore.getState().registrarArqueo({ cajaId: caja.id, moneda, contado, billetes: lista, observaciones: obs || undefined, ajustar });
    setCargando(false);
    if (!r.ok) return toast.error(r.error);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="md" title={`Arqueo · ${caja.nombre}`} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={cargando} onClick={guardar}>Guardar arqueo</Button></>}>
        <div className="space-y-3">
          <Segmented value={moneda} onChange={(v) => { setMoneda(v); setBilletes({}); }} options={[{ value: "ARS", label: "Pesos" }, { value: "USD", label: "Dólares" }]} />
          <table className="w-full text-table">
            <thead className="text-[12px] text-muted"><tr><th className="h-8 text-left font-medium">Billete</th><th className="h-8 w-[120px] text-right font-medium">Cantidad</th><th className="h-8 text-right font-medium">Subtotal</th></tr></thead>
            <tbody>
              {lista.map((b) => (
                <tr key={b.denominacion} className="border-t border-border">
                  <td className="py-1 tnum">{m$(b.denominacion, moneda)}</td>
                  <td className="py-1"><NumberInput aria-label={`Billetes de ${b.denominacion}`} value={b.cantidad} min={0} onValueChange={(v) => setBilletes({ ...billetes, [b.denominacion]: Math.max(0, Math.round(v)) })} className="h-7" /></td>
                  <td className="py-1 text-right tnum">{m$(b.denominacion * b.cantidad, moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 rounded-control border border-border p-3 text-[13px]">
            <dt className="text-muted">Contado</dt><dd className="text-right font-medium tnum">{m$(contado, moneda)}</dd>
            <dt className="text-muted">Según el sistema</dt><dd className="text-right tnum">{m$(sistema, moneda)}</dd>
            <dt className="font-semibold">Diferencia</dt><dd className={cn("text-right font-semibold tnum", Math.abs(dif) < 0.01 ? "text-success" : "text-danger")}>{Math.abs(dif) < 0.01 ? "Coincide" : `${dif > 0 ? "Sobran" : "Faltan"} ${m$(Math.abs(dif), moneda)}`}</dd>
          </dl>
          {Math.abs(dif) >= 0.01 && puedeAjustar && <label className="flex items-center gap-2 text-[13px]"><Switch checked={ajustar} onCheckedChange={setAjustar} /> Ajustar la caja a lo contado</label>}
          <FormField label="Observaciones" htmlFor="arq-o"><Input id="arq-o" value={obs} onChange={(e) => setObs(e.target.value)} /></FormField>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CajasDialog({ onClose }: { onClose: () => void }) {
  const db = useDb();
  const [nueva, setNueva] = React.useState("");
  const guardar = async (data: { nombre: string; activa: boolean; sucursalId?: string; descripcion?: string }, id?: string) => {
    const r = await useStore.getState().guardarCaja(data, id);
    if (!r.ok) toast.error(r.error);
    return r.ok;
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="md" title="Cajas" footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}>
        <ul className="divide-y divide-border rounded-control border border-border">
          {[...db.cajas].sort((a, b) => a.orden - b.orden).map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
              <Input defaultValue={c.nombre} className="h-8 flex-1" aria-label="Nombre de la caja" onBlur={(e) => e.target.value.trim() !== c.nombre && void guardar({ nombre: e.target.value, activa: c.activa, sucursalId: c.sucursalId, descripcion: c.descripcion }, c.id)} />
              <div className="w-[150px]"><Select size="sm" aria-label="Sucursal" value={c.sucursalId ?? ""} onValueChange={(v) => void guardar({ nombre: c.nombre, activa: c.activa, sucursalId: v || undefined, descripcion: c.descripcion }, c.id)} options={[{ value: "", label: "Todas" }, ...db.sucursales.map((s) => ({ value: s.id, label: s.nombre }))]} /></div>
              <label className="flex items-center gap-1.5 text-[12px] text-muted"><Switch checked={c.activa} onCheckedChange={(v) => void guardar({ nombre: c.nombre, activa: v, sucursalId: c.sucursalId, descripcion: c.descripcion }, c.id)} /> Activa</label>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nombre de la nueva caja (ej. Caja Sucursal 2)" />
          <Button disabled={!nueva.trim()} onClick={async () => { if (await guardar({ nombre: nueva, activa: true })) setNueva(""); }}><Plus /> Crear</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnularMovimientoDialog({ mov, onClose }: { mov: MovimientoCaja; onClose: () => void }) {
  const [motivo, setMotivo] = React.useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        size="sm"
        title="¿Anular este movimiento?"
        description={`${mov.concepto} · ${m$(mov.importe, mov.moneda)}${mov.grupoId ? " (se anulan las dos cajas)" : ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Volver</Button>
            <Button variant="danger" disabled={!motivo.trim()} onClick={async () => { const r = await useStore.getState().anularMovimientoCaja(mov.id, motivo); if (!r.ok) return toast.error(r.error); onClose(); }}>Anular</Button>
          </>
        }
      >
        <FormField label="Motivo" required htmlFor="amc-m"><Input id="amc-m" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></FormField>
      </DialogContent>
    </Dialog>
  );
}

