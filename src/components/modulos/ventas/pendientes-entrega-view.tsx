"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Download, PackageCheck } from "lucide-react";
import { useDb, usePendientes, useSucursalActiva, useUnidadNegocio, useVeCircuito2 } from "@/store/selectors";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Combobox } from "@/components/shared/combobox";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Segmented } from "@/components/ui/tabs";
import { formatDate, formatMoney } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { aCSV, descargarArchivo } from "@/lib/utils";
import { PendientesTabla, useFilasPendientes } from "./pendientes-tabla";

type Grupo = "cliente" | "producto" | "fecha" | "deposito";

/** Vista consolidada de todo lo vendido o retirado de acopio que todavía no se entregó. */
export function PendientesEntregaView() {
  const db = useDb();
  const params = useSearchParams();
  const sucursal = useSucursalActiva();
  const un = useUnidadNegocio();
  const veC2 = useVeCircuito2();
  const todas = usePendientes();
  const [grupo, setGrupo] = React.useState<Grupo>(params.get("tipo") === "clientes" ? "cliente" : "cliente");
  const [deposito, setDeposito] = React.useState("");
  const [cliente, setCliente] = React.useState("");
  const [sinProgramar, setSinProgramar] = React.useState(false);
  const [atrasados, setAtrasados] = React.useState(params.get("filtro") === "atrasados");
  const np = React.useMemo(() => new Map(db.notasPedido.map((n) => [n.id, n])), [db.notasPedido]);
  const unDe = React.useMemo(() => new Map(db.productos.map((p) => [p.id, p.unidadNegocioId])), [db.productos]);
  const base = React.useMemo(() => todas.filter((l) => {
    const n = np.get(l.notaPedidoId)!;
    return (veC2 || n.circuito !== 2) && (!sucursal || n.sucursalId === sucursal) && (!un || unDe.get(l.productoId) === un);
  }), [todas, np, veC2, sucursal, un, unDe]);
  const filas = useFilasPendientes(base);
  const hoy = diaLocal(new Date());
  const esAtrasado = (f: (typeof filas)[number]) => (f.programada ? diaLocal(f.programada) < hoy && !f.despacho : !f.despacho && f.dias > 15);
  const vis = filas.filter((f) => (!deposito || f.depositoId === deposito) && (!cliente || f.clienteId === cliente) && (!sinProgramar || !f.despacho) && (!atrasados || esAtrasado(f)));
  const visKeys = new Set(vis.map((f) => f.key));
  const lineasVis = base.filter((l) => visKeys.has(l.itemId));

  const claveGrupo = (f: (typeof filas)[number]) =>
    grupo === "cliente" ? f.clienteId : grupo === "producto" ? f.productoId : grupo === "deposito" ? f.depositoId : f.programada ? diaLocal(f.programada) : "sin-fecha";
  const nombreGrupo = (k: string) =>
    grupo === "cliente" ? (db.clientes.find((c) => c.id === k)?.nombreFantasia ?? db.clientes.find((c) => c.id === k)?.razonSocial ?? k)
      : grupo === "producto" ? `${db.productos.find((p) => p.id === k)?.codigo} · ${db.productos.find((p) => p.id === k)?.nombre}`
        : grupo === "deposito" ? (db.depositos.find((d) => d.id === k)?.nombre ?? k)
          : k === "sin-fecha" ? "Sin fecha programada" : formatDate(new Date(`${k}T12:00:00`), "EEEE d 'de' MMMM");
  const grupos = new Map<string, typeof vis>();
  for (const f of vis) grupos.set(claveGrupo(f), [...(grupos.get(claveGrupo(f)) ?? []), f]);
  const orden = [...grupos.entries()].sort((a, b) => (grupo === "fecha" ? a[0].localeCompare(b[0]) : b[1].reduce((s, f) => s + f.pendiente * f.precio, 0) - a[1].reduce((s, f) => s + f.pendiente * f.precio, 0)));

  const exportar = () =>
    descargarArchivo("pendientes-de-entrega.csv", aCSV(["Cliente", "Obra", "NP", "Origen", "Código", "Artículo", "Pendiente", "Unidad", "$ pendiente", "Programado", "Modalidad", "Despacho", "Días"], vis.map((f) => {
      const p = db.productos.find((x) => x.id === f.productoId);
      return [db.clientes.find((c) => c.id === f.clienteId)?.razonSocial, db.obras.find((o) => o.id === f.obraId)?.nombre, f.numeroNP, f.origen, p?.codigo, p?.nombre, f.pendiente, p?.unidad, Math.round(f.pendiente * f.precio), f.programada ? formatDate(f.programada) : "", f.modalidad === "ENVIO" ? "Envío" : "Retira", f.despacho?.numero ?? "Sin programar", f.dias];
    })));

  const check = (label: string, v: boolean, set: (b: boolean) => void) => (
    <label className="flex h-8 items-center gap-2 whitespace-nowrap rounded-control border border-border px-2.5 text-[12px] text-muted">
      <Checkbox checked={v} onCheckedChange={(x) => set(!!x)} aria-label={label} /> {label}
    </label>
  );
  return (
    <>
      <PageHeader titulo="Pendientes de entrega" descripcion="Todo lo vendido o retirado de acopio que todavía está en el depósito, y a quién se le programó cada entrega." acciones={<Button variant="secondary" onClick={exportar}><Download /> Exportar CSV</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5" data-tour="pendientes-kpis">
        <KpiCard label="Líneas pendientes" valor={String(filas.length)} />
        <KpiCard label="$ pendiente de entrega" valor={formatMoney(filas.reduce((a, f) => a + f.pendiente * f.precio, 0), { compact: true })} acento />
        <KpiCard label="Sin programar" valor={String(filas.filter((f) => !f.despacho).length)} onClick={() => setSinProgramar(true)} />
        <KpiCard label="Programados para hoy" valor={String(filas.filter((f) => f.programada && diaLocal(f.programada) === hoy).length)} />
        <KpiCard label="Atrasados" valor={<span className={filas.some(esAtrasado) ? "text-danger" : ""}>{filas.filter(esAtrasado).length}</span>} onClick={() => setAtrasados(true)} />
      </div>
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <span className="text-[12px] text-muted">Agrupar por</span>
        <Segmented value={grupo} onChange={setGrupo} options={[{ value: "cliente", label: "Cliente" }, { value: "producto", label: "Producto" }, { value: "fecha", label: "Fecha programada" }, { value: "deposito", label: "Depósito" }]} />
        <div className="w-[170px]"><Select size="sm" aria-label="Depósito" value={deposito} onValueChange={setDeposito} options={[{ value: "", label: "Todos los depósitos" }, ...db.depositos.map((d) => ({ value: d.id, label: d.nombre }))]} /></div>
        <div className="w-[210px]"><Combobox aria-label="Cliente" className="h-8" value={cliente} onChange={(v) => setCliente(v === cliente ? "" : v)} placeholder="Todos los clientes" opciones={[...new Set(filas.map((f) => f.clienteId))].map((id) => ({ value: id, label: db.clientes.find((c) => c.id === id)?.nombreFantasia ?? db.clientes.find((c) => c.id === id)?.razonSocial ?? id }))} /></div>
        {check("Sin programar", sinProgramar, setSinProgramar)}
        {check("Atrasados", atrasados, setAtrasados)}
      </Card>
      {orden.length === 0 ? (
        <Card><EmptyState icono={PackageCheck} titulo="No hay entregas pendientes para el filtro" /></Card>
      ) : (
        <div className="space-y-4">
          {orden.map(([k, fs]) => {
            const keys = new Set(fs.map((f) => f.key));
            return (
              <section key={k}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
                  <h2 className="text-[14px] font-semibold first-letter:uppercase">{nombreGrupo(k)}</h2>
                  <span className="text-[12px] text-muted tnum">{fs.length} líneas · {formatMoney(fs.reduce((a, f) => a + f.pendiente * f.precio, 0))}</span>
                </div>
                <PendientesTabla lineas={lineasVis.filter((l) => keys.has(l.itemId))} mostrarCliente={grupo !== "cliente"} />
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
