"use client";

import { useMovimientos } from "@/lib/datos/hooks";
import * as React from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useDb, useFiltroMetricas, useSaldosClientes } from "@/store/selectors";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import type { EstadoInicial } from "@/domain/types";
import { claveFecha, pedidosVendidos, rankingProductos, type FiltroMetricas, type Rango } from "@/domain/metricas";
import { calcularRentabilidadACostoActual, calcularRentabilidadItem } from "@/domain/ventas";
import { TIPO_CLIENTE_LABEL } from "@/domain/estados";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { Select } from "@/components/ui/select";
import { NumberInput } from "@/components/ui/input";
import { BarrasAgrupadasChart, COLORES, DispersionChart, ParetoChart } from "@/components/charts";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { periodoAnterior, periodoDesdePreset, diasDelPeriodo, variacion, type Periodo } from "@/lib/periodos";
import { nombreUsuario } from "@/lib/referencias";
import { cn } from "@/lib/utils";
import { ReporteLayout } from "./reporte-layout";

export function usePeriodoReporte(preset: "MES" | "90D" | "30D" = "90D") {
  return React.useState<Periodo>(() => periodoDesdePreset(preset));
}

// ───────────────────────── 1. Ventas ─────────────────────────

type Dim = "dia" | "semana" | "mes" | "sucursal" | "vendedor" | "rubro" | "cliente" | "tipo" | "lista";
const DIMS: { value: Dim; label: string }[] = [
  { value: "dia", label: "Por día" },
  { value: "semana", label: "Por semana" },
  { value: "mes", label: "Por mes" },
  { value: "sucursal", label: "Por sucursal" },
  { value: "vendedor", label: "Por vendedor" },
  { value: "rubro", label: "Por rubro" },
  { value: "cliente", label: "Por cliente" },
  { value: "tipo", label: "Por tipo de cliente" },
  { value: "lista", label: "Por lista de precios" },
];

interface FilaVentas {
  clave: string;
  label: string;
  unidades: number;
  facturado: number;
  costo: number;
  margen: number;
  margenPct: number;
  delta: number | null;
}

function agrupar(db: EstadoInicial, r: Rango, suc: FiltroMetricas, dim: Dim) {
  const m = new Map<string, { label: string; unidades: number; facturado: number; costo: number }>();
  for (const v of pedidosVendidos(db, r, suc)) {
    const p = v.pedido;
    const cli = db.clientes.find((c) => c.id === p.clienteId);
    for (const it of p.items) {
      let clave: string;
      let label: string;
      switch (dim) {
        case "dia":
        case "semana":
        case "mes":
          clave = claveFecha(v.fecha, dim);
          label = dim === "mes" ? format(parseISO(clave + "-01"), "MMMM yyyy", { locale: es }) : dim === "semana" ? `Semana del ${format(parseISO(clave), "dd/MM")}` : format(parseISO(clave), "EEE dd/MM", { locale: es });
          break;
        case "sucursal":
          clave = p.sucursalId;
          label = db.sucursales.find((s) => s.id === clave)?.nombre ?? clave;
          break;
        case "vendedor":
          clave = p.vendedorId;
          label = nombreUsuario(db, clave);
          break;
        case "rubro": {
          clave = db.productos.find((x) => x.id === it.productoId)?.rubroId ?? "";
          label = db.rubros.find((x) => x.id === clave)?.nombre ?? clave;
          break;
        }
        case "cliente":
          clave = p.clienteId;
          label = cli?.nombreFantasia ?? cli?.razonSocial ?? clave;
          break;
        case "tipo":
          clave = cli?.tipo ?? "";
          label = TIPO_CLIENTE_LABEL[clave] ?? clave;
          break;
        default:
          clave = cli?.listaPreciosId ?? "";
          label = db.listasPrecios.find((l) => l.id === clave)?.nombre ?? clave;
      }
      const rent = calcularRentabilidadItem(it, p.descuentoPct);
      const x = m.get(clave) ?? { label, unidades: 0, facturado: 0, costo: 0 };
      x.unidades += it.cantidad;
      x.facturado += rent.ingreso;
      x.costo += rent.costo;
      m.set(clave, x);
    }
  }
  return m;
}

export function ReporteVentas() {
  const db = useDb();
  const suc = useFiltroMetricas();
  const [periodo, setPeriodo] = usePeriodoReporte();
  const [dim, setDim] = React.useState<Dim>("semana");
  const filas: FilaVentas[] = React.useMemo(() => {
    const act = agrupar(db, periodo, suc, dim);
    const ant = ["dia", "semana", "mes"].includes(dim) ? new Map() : agrupar(db, periodoAnterior(periodo), suc, dim);
    return [...act.entries()]
      .map(([clave, x]) => ({ clave, label: x.label, unidades: x.unidades, facturado: x.facturado, costo: x.costo, margen: x.facturado - x.costo, margenPct: x.facturado ? (x.facturado - x.costo) / x.facturado : 0, delta: ant.size ? variacion(x.facturado, ant.get(clave)?.facturado ?? 0) : null }))
      .sort((a, b) => (["dia", "semana", "mes"].includes(dim) ? a.clave.localeCompare(b.clave) : b.facturado - a.facturado));
  }, [db, periodo, suc, dim]);
  const tot = filas.reduce((a, f) => ({ facturado: a.facturado + f.facturado, costo: a.costo + f.costo, unidades: a.unidades + f.unidades }), { facturado: 0, costo: 0, unidades: 0 });
  const totAnt = React.useMemo(() => [...agrupar(db, periodoAnterior(periodo), suc, "sucursal").values()].reduce((a, x) => a + x.facturado, 0), [db, periodo, suc]);
  const columnas: Column<FilaVentas>[] = [
    { key: "label", header: DIMS.find((d) => d.value === dim)?.label.replace("Por ", "").replace(/^./, (c) => c.toUpperCase()) ?? "", footer: "Total", cell: (f) => <span className="capitalize">{f.label}</span>, sortable: true, sortValue: (f) => f.clave },
    { key: "u", header: "Unidades", align: "right", footer: <span className="tnum">{formatNumber(tot.unidades, 0)}</span>, sortable: true, sortValue: (f) => f.unidades, cell: (f) => <span className="tnum text-muted">{formatNumber(f.unidades, 0)}</span> },
    { key: "f", header: "Facturado (neto)", align: "right", footer: <span className="tnum">{formatMoney(tot.facturado, { decimals: false })}</span>, sortable: true, sortValue: (f) => f.facturado, cell: (f) => <span className="tnum">{formatMoney(f.facturado, { decimals: false })}</span> },
    { key: "c", header: "Costo", align: "right", footer: <span className="tnum">{formatMoney(tot.costo, { decimals: false })}</span>, cell: (f) => <span className="tnum text-muted">{formatMoney(f.costo, { decimals: false })}</span> },
    { key: "m", header: "Margen $", align: "right", footer: <span className="tnum text-accent">{formatMoney(tot.facturado - tot.costo, { decimals: false })}</span>, sortable: true, sortValue: (f) => f.margen, cell: (f) => <span className="font-medium tnum">{formatMoney(f.margen, { decimals: false })}</span> },
    { key: "mp", header: "Margen %", align: "right", footer: <span className="tnum">{formatPercent(tot.facturado ? (tot.facturado - tot.costo) / tot.facturado : 0)}</span>, sortable: true, sortValue: (f) => f.margenPct, cell: (f) => <span className="tnum">{formatPercent(f.margenPct)}</span> },
    ...(["dia", "semana", "mes"].includes(dim)
      ? []
      : [{ key: "d", header: "Δ vs anterior", align: "right" as const, cell: (f: FilaVentas) => (f.delta === null ? <span className="text-disabled">nuevo</span> : <span className={cn("tnum", f.delta >= 0 ? "text-success" : "text-danger")}>{formatPercent(f.delta, { signo: true })}</span>) }]),
  ];
  return (
    <ReporteLayout
      slug="ventas"
      titulo="Ventas"
      descripcion="Facturación, costo y margen del período con el desglose que elijas, comparado con el período anterior."
      periodo={periodo}
      onPeriodo={setPeriodo}
      filtros={<Select size="sm" className="w-[190px]" aria-label="Desglose" value={dim} onValueChange={(v) => setDim(v as Dim)} options={DIMS} />}
      filtrosTexto={DIMS.find((d) => d.value === dim)?.label}
      kpis={
        <>
          <KpiCard label="Facturado neto" valor={formatMoney(tot.facturado, { compact: true })} acento variacion={{ valor: variacion(tot.facturado, totAnt), periodo: "período anterior" }} />
          <KpiCard label="Margen bruto" valor={formatMoney(tot.facturado - tot.costo, { compact: true })} subtexto={formatPercent(tot.facturado ? (tot.facturado - tot.costo) / tot.facturado : 0)} />
          <KpiCard label="Pedidos vendidos" valor={String(pedidosVendidos(db, periodo, suc).length)} />
          <KpiCard label="Ticket promedio" valor={formatMoney(tot.facturado / Math.max(1, pedidosVendidos(db, periodo, suc).length), { compact: true })} />
        </>
      }
      graficoTitulo="Facturado y margen"
      grafico={<BarrasAgrupadasChart data={filas.map((f) => ({ clave: f.label, facturado: Math.round(f.facturado), margen: Math.round(f.margen) }))} series={[{ key: "facturado", nombre: "Facturado", color: COLORES.barra }, { key: "margen", nombre: "Margen", color: COLORES.acento }]} />}
      exportar={() => ({
        head: ["Desglose", "Unidades", "Facturado neto", "Costo", "Margen $", "Margen %", "Δ % vs anterior"],
        rows: filas.map((f) => [f.label, f.unidades, Math.round(f.facturado), Math.round(f.costo), Math.round(f.margen), Math.round(f.margenPct * 1000) / 10, f.delta === null ? "" : Math.round(f.delta * 1000) / 10]),
        foot: ["Total", tot.unidades, Math.round(tot.facturado), Math.round(tot.costo), Math.round(tot.facturado - tot.costo), tot.facturado ? Math.round(((tot.facturado - tot.costo) / tot.facturado) * 1000) / 10 : 0, ""],
      })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(f) => f.clave} showFooter pageSize={100} empty={{ titulo: "Sin ventas en el período", descripcion: "Sale de las notas de pedido confirmadas, con el costo congelado de cada línea. Probá con otro período o cargá la primera venta." }} />
    </ReporteLayout>
  );
}

// ───────────────────────── 2. Rentabilidad por pedido ─────────────────────────

export function ReporteRentabilidadPedidos() {
  const db = useDb();
  const router = useRouter();
  const suc = useFiltroMetricas();
  const [periodo, setPeriodo] = usePeriodoReporte();
  const [umbral, setUmbral] = React.useState(0);
  const costo = React.useCallback((id: string) => db.productos.find((p) => p.id === id)?.costoUltimo ?? 0, [db.productos]);
  const filas = React.useMemo(
    () =>
      pedidosVendidos(db, periodo, suc)
        .map((v) => {
          const hoy = calcularRentabilidadACostoActual(v.pedido, costo);
          return { ...v, costoHoy: hoy.costo, margenHoy: hoy.margenBruto, margenHoyPct: hoy.margenPct, cliente: db.clientes.find((c) => c.id === v.pedido.clienteId) };
        })
        .filter((f) => !umbral || f.margenPct * 100 < umbral),
    [db, periodo, suc, umbral, costo],
  );
  type F = (typeof filas)[number];
  const t = filas.reduce((a, f) => ({ i: a.i + f.ingreso, c: a.c + f.costo, ch: a.ch + f.costoHoy }), { i: 0, c: 0, ch: 0 });
  const columnas: Column<F>[] = [
    { key: "n", header: "Nota de pedido", footer: "Total", sortable: true, sortValue: (f) => f.pedido.numero, cell: (f) => <span className="whitespace-nowrap font-mono text-[12px]">{f.pedido.numero}</span> },
    { key: "ci", header: "Circuito", cell: (f) => <CircuitoBadge circuito={f.pedido.circuito} corto /> },
    { key: "or", header: "Origen", cell: (f) => <span className="text-[12px] text-muted">{f.pedido.origen === "ACOPIO" ? "Acopio" : "Nueva"}</span> },
    { key: "cli", header: "Cliente", cell: (f) => <span className="block min-w-[150px]">{f.cliente?.nombreFantasia ?? f.cliente?.razonSocial}</span> },
    { key: "fe", header: "Fecha venta", sortable: true, sortValue: (f) => f.fecha, cell: (f) => <span className="text-muted">{formatDate(f.fecha)}</span> },
    { key: "i", header: "Ingreso", align: "right", footer: <span className="tnum">{formatMoney(t.i, { decimals: false })}</span>, sortable: true, sortValue: (f) => f.ingreso, cell: (f) => <span className="tnum">{formatMoney(f.ingreso, { decimals: false })}</span> },
    { key: "c", header: "Costo snapshot", align: "right", footer: <span className="tnum">{formatMoney(t.c, { decimals: false })}</span>, cell: (f) => <span className="tnum text-muted">{formatMoney(f.costo, { decimals: false })}</span> },
    { key: "m", header: "Margen $", align: "right", footer: <span className="tnum text-accent">{formatMoney(t.i - t.c, { decimals: false })}</span>, sortable: true, sortValue: (f) => f.margen, cell: (f) => <span className="font-medium tnum">{formatMoney(f.margen, { decimals: false })}</span> },
    { key: "mp", header: "Margen %", align: "right", footer: <span className="tnum">{formatPercent(t.i ? (t.i - t.c) / t.i : 0)}</span>, sortable: true, sortValue: (f) => f.margenPct, cell: (f) => <span className={cn("tnum", f.margenPct < 0.15 ? "font-medium text-danger" : "")}>{formatPercent(f.margenPct)}</span> },
    { key: "ch", header: "Costo actual", align: "right", footer: <span className="tnum">{formatMoney(t.ch, { decimals: false })}</span>, cell: (f) => <span className="tnum text-muted">{formatMoney(f.costoHoy, { decimals: false })}</span> },
    { key: "mh", header: "Margen si vendieras hoy", align: "right", footer: <span className="tnum">{formatPercent(t.i ? (t.i - t.ch) / t.i : 0)}</span>, sortable: true, sortValue: (f) => f.margenHoyPct, cell: (f) => <span className={cn("tnum", f.margenHoyPct < f.margenPct - 0.005 ? "text-danger" : "text-success")}>{formatPercent(f.margenHoyPct)}</span> },
  ];
  return (
    <ReporteLayout
      slug="rentabilidad-pedidos"
      titulo="Rentabilidad por pedido"
      descripcion="Margen de cada pedido con el costo congelado al venderlo, y cuánto quedaría si lo vendieras hoy al mismo precio: el efecto de la inflación."
      periodo={periodo}
      onPeriodo={setPeriodo}
      filtros={
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Margen menor a
          <NumberInput aria-label="Umbral de margen" value={umbral} min={0} className="h-8 w-20" onValueChange={setUmbral} />% <span className="text-[11px]">(0 = todos)</span>
        </label>
      }
      filtrosTexto={umbral ? `Margen < ${umbral} %` : undefined}
      kpis={
        <>
          <KpiCard label="Pedidos" valor={String(filas.length)} />
          <KpiCard label="Margen bruto" valor={formatMoney(t.i - t.c, { compact: true })} acento subtexto={formatPercent(t.i ? (t.i - t.c) / t.i : 0)} />
          <KpiCard label="Margen a costo de hoy" valor={formatMoney(t.i - t.ch, { compact: true })} subtexto={formatPercent(t.i ? (t.i - t.ch) / t.i : 0)} />
          <KpiCard label="Erosión por inflación" valor={<span className={t.ch > t.c ? "text-danger" : "text-success"}>{formatMoney(t.ch - t.c, { compact: true })}</span>} subtexto="costo hoy − costo al vender" />
        </>
      }
      exportar={() => ({
        head: ["Nota de pedido", "Cliente", "Fecha", "Ingreso", "Costo snapshot", "Margen $", "Margen %", "Costo actual", "Margen hoy %"],
        rows: filas.map((f) => [f.pedido.numero, f.cliente?.razonSocial, formatDate(f.fecha), Math.round(f.ingreso), Math.round(f.costo), Math.round(f.margen), Math.round(f.margenPct * 1000) / 10, Math.round(f.costoHoy), Math.round(f.margenHoyPct * 1000) / 10]),
        foot: ["Total", "", "", Math.round(t.i), Math.round(t.c), Math.round(t.i - t.c), t.i ? Math.round(((t.i - t.c) / t.i) * 1000) / 10 : 0, Math.round(t.ch), t.i ? Math.round(((t.i - t.ch) / t.i) * 1000) / 10 : 0],
      })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(f) => f.pedido.id} searchText={(f) => `${f.pedido.numero} ${f.cliente?.razonSocial}`} onRowClick={(f) => router.push(`/ventas/notas-pedido/${f.pedido.id}`)} initialSort={{ key: "mp", dir: "asc" }} showFooter pageSize={50} empty={{ titulo: "Sin pedidos para el filtro", descripcion: "Sale de las notas de pedido confirmadas: precio de venta contra el costo congelado de cada línea." }} />
    </ReporteLayout>
  );
}

// ───────────────────────── 3. Rentabilidad por producto ─────────────────────────

export function ReporteRentabilidadProductos() {
  const dbBase = useDb();
  const { movimientos } = useMovimientos(); // kardex leído del servidor
  const db = React.useMemo(() => ({ ...dbBase, movimientos }), [dbBase, movimientos]);
  const router = useRouter();
  const suc = useFiltroMetricas();
  const [periodo, setPeriodo] = usePeriodoReporte();
  const [rubro, setRubro] = React.useState("");
  const dias = diasDelPeriodo(periodo);
  const filas = React.useMemo(() => {
    const dep = suc.sucursalId ? db.sucursales.find((s) => s.id === suc.sucursalId)?.depositoId : null;
    return rankingProductos(db, periodo, suc)
      .map((r) => {
        const p = db.productos.find((x) => x.id === r.productoId)!;
        const fisicoHoy = db.stock.filter((s) => s.productoId === p.id && (!dep || s.depositoId === dep)).reduce((a, s) => a + s.cantidadFisica, 0);
        const movsDesde = db.movimientos.filter((m) => m.productoId === p.id && (!dep || m.depositoId === dep) && m.fecha >= periodo.desde).reduce((a, m) => a + m.signo * m.cantidad, 0);
        const promedio = (fisicoHoy + (fisicoHoy - movsDesde)) / 2;
        const ventaDiaria = r.unidades / dias;
        return { ...r, p, rotacion: promedio > 0 ? r.unidades / promedio : 0, diasStock: ventaDiaria > 0 ? fisicoHoy / ventaDiaria : Infinity };
      })
      .filter((f) => !rubro || f.p.rubroId === rubro);
  }, [db, periodo, suc, rubro, dias]);
  type F = (typeof filas)[number];
  const t = filas.reduce((a, f) => ({ f: a.f + f.facturado, c: a.c + f.costo }), { f: 0, c: 0 });
  const columnas: Column<F>[] = [
    { key: "p", header: "Producto", footer: "Total", sortable: true, sortValue: (f) => f.p.nombre, cell: (f) => <span className="block min-w-[200px]"><span className="mr-1.5 whitespace-nowrap font-mono text-[11px] text-muted">{f.p.codigo}</span>{f.p.nombre}</span> },
    { key: "u", header: "Unidades", align: "right", sortable: true, sortValue: (f) => f.unidades, cell: (f) => <span className="tnum">{formatNumber(f.unidades)}</span> },
    { key: "f", header: "Facturado", align: "right", footer: <span className="tnum">{formatMoney(t.f, { decimals: false })}</span>, sortable: true, sortValue: (f) => f.facturado, cell: (f) => <span className="tnum">{formatMoney(f.facturado, { decimals: false })}</span> },
    { key: "c", header: "Costo", align: "right", cell: (f) => <span className="tnum text-muted">{formatMoney(f.costo, { decimals: false })}</span> },
    { key: "m", header: "Margen $", align: "right", footer: <span className="tnum text-accent">{formatMoney(t.f - t.c, { decimals: false })}</span>, sortable: true, sortValue: (f) => f.margen, cell: (f) => <span className="font-medium tnum">{formatMoney(f.margen, { decimals: false })}</span> },
    { key: "mp", header: "Margen %", align: "right", sortable: true, sortValue: (f) => f.margenPct, cell: (f) => <span className="tnum">{formatPercent(f.margenPct)}</span> },
    { key: "rot", header: "Rotación", align: "right", sortable: true, sortValue: (f) => f.rotacion, cell: (f) => <span className="tnum">{formatNumber(f.rotacion, 1)}×</span> },
    { key: "dias", header: "Días de stock", align: "right", sortable: true, sortValue: (f) => (Number.isFinite(f.diasStock) ? f.diasStock : 99999), cell: (f) => <span className={cn("tnum", f.diasStock < 15 ? "font-medium text-danger" : f.diasStock > 120 ? "text-warning" : "")}>{Number.isFinite(f.diasStock) ? formatNumber(f.diasStock, 0) : "∞"}</span> },
  ];
  return (
    <ReporteLayout
      slug="rentabilidad-productos"
      titulo="Rentabilidad por producto"
      descripcion="Qué productos dejan más margen, cuánto rotan y cuántos días de stock quedan al ritmo de venta del período."
      periodo={periodo}
      onPeriodo={setPeriodo}
      filtros={<Select size="sm" className="w-[180px]" aria-label="Rubro" value={rubro} onValueChange={setRubro} options={[{ value: "", label: "Todos los rubros" }, ...db.rubros.map((r) => ({ value: r.id, label: r.nombre }))]} />}
      filtrosTexto={rubro ? db.rubros.find((r) => r.id === rubro)?.nombre : undefined}
      kpis={
        <>
          <KpiCard label="Productos vendidos" valor={String(filas.length)} />
          <KpiCard label="Margen bruto" valor={formatMoney(t.f - t.c, { compact: true })} acento subtexto={formatPercent(t.f ? (t.f - t.c) / t.f : 0)} />
          <KpiCard label="Con menos de 15 días de stock" valor={String(filas.filter((f) => f.diasStock < 15).length)} />
          <KpiCard label="Más de 120 días de stock" valor={String(filas.filter((f) => f.diasStock > 120).length)} subtexto="stock inmovilizado" />
        </>
      }
      graficoTitulo="Margen % vs unidades vendidas (tamaño = margen $): arriba a la derecha, los que conviene empujar"
      grafico={<DispersionChart data={filas.map((f) => ({ nombre: f.p.nombre, x: Math.max(1, f.unidades), y: f.margenPct, z: Math.max(0, f.margen) }))} />}
      exportar={() => ({
        head: ["Código", "Producto", "Unidades", "Facturado", "Costo", "Margen $", "Margen %", "Rotación", "Días de stock"],
        rows: filas.map((f) => [f.p.codigo, f.p.nombre, f.unidades, Math.round(f.facturado), Math.round(f.costo), Math.round(f.margen), Math.round(f.margenPct * 1000) / 10, Math.round(f.rotacion * 10) / 10, Number.isFinite(f.diasStock) ? Math.round(f.diasStock) : ""]),
        foot: ["Total", "", "", Math.round(t.f), Math.round(t.c), Math.round(t.f - t.c), t.f ? Math.round(((t.f - t.c) / t.f) * 1000) / 10 : 0, "", ""],
      })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(f) => f.productoId} searchText={(f) => `${f.p.codigo} ${f.p.nombre}`} onRowClick={(f) => router.push(`/productos?id=${f.productoId}`)} initialSort={{ key: "m", dir: "desc" }} showFooter pageSize={50} empty={{ titulo: "Sin ventas en el período", descripcion: "Sale de las notas de pedido confirmadas, con el costo congelado de cada línea. Probá con otro período o cargá la primera venta." }} />
    </ReporteLayout>
  );
}

// ───────────────────────── 4. Rentabilidad por cliente ─────────────────────────

export function ReporteRentabilidadClientes() {
  const db = useDb();
  const router = useRouter();
  const suc = useFiltroMetricas();
  const saldos = useSaldosClientes();
  const [periodo, setPeriodo] = usePeriodoReporte();
  const filas = React.useMemo(() => {
    const m = new Map<string, { f: number; c: number; n: number }>();
    for (const v of pedidosVendidos(db, periodo, suc)) {
      const x = m.get(v.pedido.clienteId) ?? { f: 0, c: 0, n: 0 };
      x.f += v.ingreso;
      x.c += v.costo;
      x.n++;
      m.set(v.pedido.clienteId, x);
    }
    const total = [...m.values()].reduce((a, x) => a + x.f, 0);
    let acum = 0;
    return [...m.entries()]
      .map(([id, x]) => ({ id, cliente: db.clientes.find((c) => c.id === id)!, ...x }))
      .sort((a, b) => b.f - a.f)
      .map((x) => {
        acum += x.f;
        return { ...x, margen: x.f - x.c, margenPct: x.f ? (x.f - x.c) / x.f : 0, share: total ? x.f / total : 0, acumulado: total ? acum / total : 0, ticket: x.n ? x.f / x.n : 0, deuda: saldos.get(x.id)?.saldo ?? 0 };
      });
  }, [db, periodo, suc, saldos]);
  type F = (typeof filas)[number];
  const total = filas.reduce((a, f) => a + f.f, 0);
  const n80 = filas.findIndex((f) => f.acumulado >= 0.8) + 1;
  const columnas: Column<F>[] = [
    { key: "c", header: "Cliente", footer: "Total", cell: (f) => <span className="block min-w-[160px]">{f.cliente.nombreFantasia ?? f.cliente.razonSocial}</span> },
    { key: "f", header: "Facturado", align: "right", footer: <span className="tnum">{formatMoney(total, { decimals: false })}</span>, sortable: true, sortValue: (f) => f.f, cell: (f) => <span className="tnum">{formatMoney(f.f, { decimals: false })}</span> },
    { key: "m", header: "Margen $", align: "right", sortable: true, sortValue: (f) => f.margen, cell: (f) => <span className="font-medium tnum">{formatMoney(f.margen, { decimals: false })}</span> },
    { key: "mp", header: "Margen %", align: "right", sortable: true, sortValue: (f) => f.margenPct, cell: (f) => <span className="tnum">{formatPercent(f.margenPct)}</span> },
    { key: "s", header: "% del total", align: "right", cell: (f) => <span className="tnum">{formatPercent(f.share)}</span> },
    { key: "a", header: "% acumulado", align: "right", cell: (f) => <span className={cn("tnum", f.acumulado <= 0.8 ? "font-medium text-accent" : "text-muted")}>{formatPercent(f.acumulado)}</span> },
    { key: "t", header: "Ticket prom.", align: "right", cell: (f) => <span className="tnum">{formatMoney(f.ticket, { compact: true })}</span> },
    { key: "n", header: "Pedidos", align: "right", sortable: true, sortValue: (f) => f.n, cell: (f) => <span className="tnum">{f.n}</span> },
    { key: "d", header: "Deuda actual", align: "right", sortable: true, sortValue: (f) => f.deuda, cell: (f) => <span className={cn("tnum", f.deuda > 0 && "text-danger")}>{formatMoney(f.deuda, { decimals: false })}</span> },
  ];
  return (
    <ReporteLayout
      slug="rentabilidad-clientes"
      titulo="Rentabilidad por cliente"
      descripcion="Facturación, margen y concentración de clientes. Pareto: cuántos clientes explican el 80 % de la venta."
      periodo={periodo}
      onPeriodo={setPeriodo}
      kpis={
        <>
          <KpiCard label="Clientes con compras" valor={String(filas.length)} />
          <KpiCard label="Concentración" valor={`${n80} clientes`} acento subtexto={`hacen el 80 % de la venta (${formatPercent(filas.length ? n80 / filas.length : 0, { decimals: 0 })} de la cartera)`} />
          <KpiCard label="Margen bruto" valor={formatMoney(filas.reduce((a, f) => a + f.margen, 0), { compact: true })} />
          <KpiCard label="Ticket promedio" valor={formatMoney(total / Math.max(1, filas.reduce((a, f) => a + f.n, 0)), { compact: true })} />
        </>
      }
      graficoTitulo="Pareto de clientes"
      grafico={<ParetoChart data={filas.map((f) => ({ clave: f.cliente.nombreFantasia ?? f.cliente.razonSocial, valor: Math.round(f.f), acumulado: f.acumulado }))} />}
      exportar={() => ({
        head: ["Cliente", "Facturado", "Margen $", "Margen %", "% del total", "% acumulado", "Ticket promedio", "Pedidos", "Deuda actual"],
        rows: filas.map((f) => [f.cliente.razonSocial, Math.round(f.f), Math.round(f.margen), Math.round(f.margenPct * 1000) / 10, Math.round(f.share * 1000) / 10, Math.round(f.acumulado * 1000) / 10, Math.round(f.ticket), f.n, Math.round(f.deuda)]),
        foot: ["Total", Math.round(total), "", "", 100, "", "", filas.reduce((a, f) => a + f.n, 0), ""],
      })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(f) => f.id} onRowClick={(f) => router.push(`/ventas?tab=clientes&cliente=${f.id}`)} showFooter pageSize={50} empty={{ titulo: "Sin ventas en el período", descripcion: "Sale de las notas de pedido confirmadas, con el costo congelado de cada línea. Probá con otro período o cargá la primera venta." }} />
    </ReporteLayout>
  );
}
