"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useAcopiosProveedorResumen, useDb, usePendientes, useSucursalActiva, useUnidadNegocio, useVeCircuito2 } from "@/store/selectors";
import { ahorroAcopio } from "@/domain/acopiosProveedor";
import { minutosEspera, minutosPreparacion, minutosTotal, promedio } from "@/domain/despachos";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { Segmented } from "@/components/ui/tabs";
import { BarrasAgrupadasChart, COLORES } from "@/components/charts";
import { formatDate, formatMoney } from "@/lib/format";
import { diaLocal, enPeriodo } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { ReporteLayout } from "./reporte-layout";
import { usePeriodoReporte } from "./reportes-ventas";

// ───────────────────────── Pendientes de entrega ─────────────────────────

export function ReportePendientes() {
  const db = useDb();
  const router = useRouter();
  const suc = useSucursalActiva();
  const un = useUnidadNegocio();
  const veC2 = useVeCircuito2();
  const [dim, setDim] = React.useState<"cliente" | "producto" | "antiguedad">("cliente");
  const np = new Map(db.notasPedido.map((n) => [n.id, n]));
  const lineas = usePendientes().filter((l) => {
    const n = np.get(l.notaPedidoId)!;
    return (!suc || n.sucursalId === suc) && (veC2 || n.circuito !== 2) && (!un || db.productos.find((p) => p.id === l.productoId)?.unidadNegocioId === un);
  });
  const tramo = (dias: number) => (dias <= 7 ? "0–7 días" : dias <= 15 ? "8–15 días" : dias <= 30 ? "16–30 días" : "Más de 30 días");
  const m = new Map<string, { clave: string; nombre: string; lineas: number; pesos: number; costo: number; viejo: number }>();
  for (const l of lineas) {
    const n = np.get(l.notaPedidoId)!;
    const dias = Math.floor((Date.now() - Date.parse(n.fecha)) / 86_400_000);
    const p = db.productos.find((x) => x.id === l.productoId);
    const k = dim === "cliente" ? l.clienteId : dim === "producto" ? l.productoId : tramo(dias);
    const nombre = dim === "cliente" ? (db.clientes.find((c) => c.id === k)?.razonSocial ?? k) : dim === "producto" ? `${p?.codigo} ${p?.nombre}` : k;
    const x = m.get(k) ?? { clave: k, nombre, lineas: 0, pesos: 0, costo: 0, viejo: 0 };
    x.lineas++;
    x.pesos += l.pendiente * l.precio;
    x.costo += l.pendiente * (p?.costoPromedio ?? 0);
    x.viejo = Math.max(x.viejo, dias);
    m.set(k, x);
  }
  const filas = [...m.values()];
  type F = (typeof filas)[number];
  const t = filas.reduce((a, f) => ({ l: a.l + f.lineas, p: a.p + f.pesos, c: a.c + f.costo }), { l: 0, p: 0, c: 0 });
  const columnas: Column<F>[] = [
    { key: "n", header: dim === "cliente" ? "Cliente" : dim === "producto" ? "Artículo" : "Antigüedad", footer: "Total", sortable: true, sortValue: (f) => f.nombre, cell: (f) => <span className="block min-w-[200px]">{f.nombre}</span> },
    { key: "l", header: "Líneas", align: "right", footer: <span className="tnum">{t.l}</span>, cell: (f) => <span className="tnum">{f.lineas}</span> },
    { key: "p", header: "$ comprometido (precio)", align: "right", sortable: true, sortValue: (f) => f.pesos, footer: <span className="tnum text-accent">{formatMoney(t.p, { decimals: false })}</span>, cell: (f) => <span className="font-medium tnum">{formatMoney(f.pesos, { decimals: false })}</span> },
    { key: "c", header: "A costo de hoy", align: "right", footer: <span className="tnum">{formatMoney(t.c, { decimals: false })}</span>, cell: (f) => <span className="tnum text-muted">{formatMoney(f.costo, { decimals: false })}</span> },
    { key: "v", header: "Más antiguo (días)", align: "right", sortable: true, sortValue: (f) => f.viejo, cell: (f) => <span className={cn("tnum", f.viejo > 30 && "font-medium text-danger")}>{f.viejo}</span> },
  ];
  return (
    <ReporteLayout
      slug="pendientes-entrega"
      titulo="Pendientes de entrega"
      descripcion="Lo vendido o retirado de acopio que todavía no se entregó: por cliente, por artículo o por antigüedad."
      filtros={<Segmented value={dim} onChange={setDim} options={[{ value: "cliente", label: "Por cliente" }, { value: "producto", label: "Por artículo" }, { value: "antiguedad", label: "Por antigüedad" }]} />}
      kpis={
        <>
          <KpiCard label="$ comprometido" valor={formatMoney(t.p, { compact: true })} acento />
          <KpiCard label="Líneas" valor={String(t.l)} />
          <KpiCard label="A costo de reposición" valor={formatMoney(t.c, { compact: true })} />
          <KpiCard label="Más de 30 días" valor={String(lineas.filter((l) => Date.now() - Date.parse(np.get(l.notaPedidoId)!.fecha) > 30 * 86_400_000).length)} />
        </>
      }
      exportar={() => ({ head: ["Grupo", "Líneas", "$ comprometido", "Costo hoy", "Más antiguo (días)"], rows: filas.map((f) => [f.nombre, f.lineas, Math.round(f.pesos), Math.round(f.costo), f.viejo]), foot: ["Total", t.l, Math.round(t.p), Math.round(t.c), ""] })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(f) => f.clave} onRowClick={() => router.push("/pendientes-entrega")} initialSort={{ key: "p", dir: "desc" }} showFooter empty={{ titulo: "Sin entregas pendientes", descripcion: "Sale de lo vendido o retirado de acopio que todavía no tiene remito hecho." }} />
    </ReporteLayout>
  );
}

// ───────────────────────── Acopios con proveedores ─────────────────────────

export function ReporteAcopiosProveedores() {
  const db = useDb();
  const router = useRouter();
  const veC2 = useVeCircuito2();
  const filas = useAcopiosProveedorResumen()
    .filter((a) => a.estado !== "CANCELADO" && (veC2 || a.acopio.circuito !== 2))
    .map((a) => ({ ...a, ahorro: ahorroAcopio(a.acopio, db.ordenesCompra, db.productos), prov: db.proveedores.find((p) => p.id === a.acopio.proveedorId)?.razonSocial ?? "" }));
  type F = (typeof filas)[number];
  const t = filas.reduce((x, a) => ({ s: x.s + a.saldo, p: x.p + a.pendientePesos, d: x.d + a.deuda, h: x.h + a.ahorro }), { s: 0, p: 0, d: 0, h: 0 });
  const columnas: Column<F>[] = [
    { key: "n", header: "Acopio", footer: "Total", cell: (a) => <span className="whitespace-nowrap font-mono text-[12px]">{a.acopio.numero}</span> },
    { key: "ci", header: "Circuito", cell: (a) => <CircuitoBadge circuito={a.acopio.circuito} corto /> },
    { key: "p", header: "Proveedor", sortable: true, sortValue: (a) => a.prov, cell: (a) => <span className="block min-w-[170px]">{a.prov}</span> },
    { key: "i", header: "Importe", align: "right", cell: (a) => <span className="tnum">{formatMoney(a.acopio.importe, { decimals: false })}</span> },
    { key: "s", header: "Saldo disponible", align: "right", footer: <span className="tnum">{formatMoney(t.s, { decimals: false })}</span>, cell: (a) => <span className="tnum">{formatMoney(a.saldo, { decimals: false })}</span> },
    { key: "pr", header: "Pendiente de retirar", align: "right", footer: <span className="tnum text-accent">{formatMoney(t.p, { decimals: false })}</span>, cell: (a) => <span className="font-medium tnum">{formatMoney(a.pendientePesos, { decimals: false })}</span> },
    { key: "d", header: "Deuda", align: "right", footer: <span className="tnum">{formatMoney(t.d, { decimals: false })}</span>, cell: (a) => <span className={cn("tnum", a.deuda > 0 && "text-danger")}>{formatMoney(a.deuda, { decimals: false })}</span> },
    { key: "h", header: "Ahorro (congelado vs hoy)", align: "right", sortable: true, sortValue: (a) => a.ahorro, footer: <span className="tnum text-success">{formatMoney(t.h, { decimals: false })}</span>, cell: (a) => <span className="tnum text-success">{formatMoney(a.ahorro, { decimals: false })}</span> },
    { key: "v", header: "Vence", cell: (a) => <span className="text-muted">{formatDate(a.acopio.fechaVencimiento)}</span> },
  ];
  return (
    <ReporteLayout
      slug="acopios-proveedores"
      titulo="Acopios con proveedores"
      descripcion="Saldo disponible, mercadería pendiente de retirar, deuda en cuenta corriente y ahorro por haber congelado costos."
      kpis={
        <>
          <KpiCard label="Pendiente de retirar" valor={formatMoney(t.p, { compact: true })} acento />
          <KpiCard label="Saldo sin pedir" valor={formatMoney(t.s, { compact: true })} />
          <KpiCard label="Le debemos" valor={formatMoney(t.d, { compact: true })} />
          <KpiCard label="Ahorro por costo congelado" valor={<span className="text-success">{formatMoney(t.h, { compact: true })}</span>} />
        </>
      }
      exportar={() => ({ head: ["Acopio", "Circuito", "Proveedor", "Importe", "Saldo disponible", "Pendiente de retirar", "Deuda", "Ahorro", "Vencimiento"], rows: filas.map((a) => [a.acopio.numero, `AC${a.acopio.circuito}`, a.prov, Math.round(a.acopio.importe), Math.round(a.saldo), Math.round(a.pendientePesos), Math.round(a.deuda), Math.round(a.ahorro), formatDate(a.acopio.fechaVencimiento)]), foot: ["Total", "", "", "", Math.round(t.s), Math.round(t.p), Math.round(t.d), Math.round(t.h), ""] })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(a) => a.acopio.id} onRowClick={(a) => router.push(`/proveedores/acopios/${a.acopio.id}`)} showFooter initialSort={{ key: "pr", dir: "desc" }} empty={{ titulo: "Sin acopios con proveedores", descripcion: "Sale de los acopios con proveedores vigentes: lo pagado o pactado y lo que falta retirar a costo congelado." }} />
    </ReporteLayout>
  );
}

// ───────────────────────── Tiempos de despacho ─────────────────────────

export function ReporteTiemposDespacho() {
  const db = useDb();
  const suc = useSucursalActiva();
  const [periodo, setPeriodo] = usePeriodoReporte("30D");
  const [dim, setDim] = React.useState<"dia" | "deposito" | "posicion" | "operario">("dia");
  const ds = db.despachos.filter((d) => d.fechaFin && enPeriodo(d.fechaFin, periodo) && (!suc || d.sucursalId === suc));
  const clave = (d: (typeof ds)[number]) => (dim === "dia" ? diaLocal(d.fechaFin!) : dim === "deposito" ? (db.depositos.find((x) => x.id === d.depositoId)?.nombre ?? "") : dim === "posicion" ? d.posicion : (db.usuarios.find((u) => u.id === d.operarioId)?.nombre ?? "Sin operario"));
  const m = new Map<string, typeof ds>();
  for (const d of ds) m.set(clave(d), [...(m.get(clave(d)) ?? []), d]);
  const filas = [...m.entries()].map(([k, l]) => ({ k, n: l.length, esp: promedio(l.map((d) => minutosEspera(d))), prep: promedio(l.map((d) => minutosPreparacion(d))), tot: promedio(l.map((d) => minutosTotal(d))), lentos: l.filter((d) => (minutosTotal(d) ?? 0) > 90).length }));
  type F = (typeof filas)[number];
  const columnas: Column<F>[] = [
    { key: "k", header: dim === "dia" ? "Día" : dim === "deposito" ? "Depósito" : dim === "posicion" ? "Posición" : "Operario", sortable: true, sortValue: (f) => f.k, cell: (f) => <span>{dim === "dia" ? formatDate(new Date(`${f.k}T12:00:00`), "EEE dd/MM") : f.k}</span> },
    { key: "n", header: "Despachos", align: "right", cell: (f) => <span className="tnum">{f.n}</span> },
    { key: "e", header: "Espera prom. (min)", align: "right", cell: (f) => <span className="tnum">{f.esp ?? "—"}</span> },
    { key: "p", header: "Preparación prom. (min)", align: "right", cell: (f) => <span className="font-medium tnum">{f.prep ?? "—"}</span> },
    { key: "t", header: "Total prom. (min)", align: "right", sortable: true, sortValue: (f) => f.tot ?? 0, cell: (f) => <span className={cn("tnum", (f.tot ?? 0) > 90 ? "font-semibold text-danger" : (f.tot ?? 0) > 45 ? "font-semibold text-warning" : "")}>{f.tot ?? "—"}</span> },
    { key: "l", header: "Más de 90 min", align: "right", cell: (f) => <span className="tnum">{f.lentos}</span> },
  ];
  return (
    <ReporteLayout
      slug="tiempos-despacho"
      titulo="Tiempos de despacho"
      descripcion="Promedio de espera, preparación y total por día, depósito, posición de carga y operario."
      periodo={periodo}
      onPeriodo={setPeriodo}
      filtros={<Segmented value={dim} onChange={setDim} options={[{ value: "dia", label: "Por día" }, { value: "deposito", label: "Por depósito" }, { value: "posicion", label: "Por posición" }, { value: "operario", label: "Por operario" }]} />}
      kpis={
        <>
          <KpiCard label="Despachos finalizados" valor={String(ds.length)} />
          <KpiCard label="Espera promedio" valor={`${promedio(ds.map((d) => minutosEspera(d))) ?? "—"} min`} />
          <KpiCard label="Preparación promedio" valor={`${promedio(ds.map((d) => minutosPreparacion(d))) ?? "—"} min`} acento />
          <KpiCard label="Total promedio" valor={`${promedio(ds.map((d) => minutosTotal(d))) ?? "—"} min`} />
        </>
      }
      graficoTitulo="Minutos promedio"
      grafico={<BarrasAgrupadasChart data={filas.sort((a, b) => a.k.localeCompare(b.k)).map((f) => ({ clave: dim === "dia" ? f.k.slice(5) : f.k, espera: f.esp ?? 0, preparacion: f.prep ?? 0 }))} series={[{ key: "espera", nombre: "Espera", color: COLORES.barraAlt }, { key: "preparacion", nombre: "Preparación", color: COLORES.acento }]} />}
      exportar={() => ({ head: ["Grupo", "Despachos", "Espera prom.", "Preparación prom.", "Total prom.", "Más de 90 min"], rows: filas.map((f) => [f.k, f.n, f.esp, f.prep, f.tot, f.lentos]) })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(f) => f.k} initialSort={{ key: "k", dir: "asc" }} empty={{ titulo: "Sin despachos finalizados en el período", descripcion: "Sale de los tiempos de espera y preparación de cada despacho del depósito. Probá con otro período." }} />
    </ReporteLayout>
  );
}

// ───────────────────────── Remitos sin firmar / sin facturar ─────────────────────────

export function ReporteRemitosPendientes() {
  const db = useDb();
  const router = useRouter();
  const suc = useSucursalActiva();
  const veC2 = useVeCircuito2();
  const [periodo, setPeriodo] = usePeriodoReporte("30D");
  const [tipo, setTipo] = React.useState<"firmar" | "facturar">("firmar");
  const filas = db.remitos.filter((r) => r.estado === "HECHO" && r.tipo !== "TRANSFERENCIA" && enPeriodo(r.fechaEntrega ?? r.fecha, periodo) && (!suc || r.sucursalId === suc) && (veC2 || r.circuito !== 2) && (tipo === "firmar" ? !r.firmadoAdjuntoId : !r.facturado));
  type F = (typeof filas)[number];
  const cli = (id?: string) => db.clientes.find((c) => c.id === id);
  const columnas: Column<F>[] = [
    { key: "n", header: "Remito", sortable: true, sortValue: (r) => r.numero, cell: (r) => <span className="whitespace-nowrap font-mono text-[12px]">{r.numero}</span> },
    { key: "ci", header: "Circuito", cell: (r) => <CircuitoBadge circuito={r.circuito} corto /> },
    { key: "f", header: "Entrega", sortable: true, sortValue: (r) => r.fechaEntrega ?? r.fecha, cell: (r) => <span className="text-muted">{formatDate(r.fechaEntrega ?? r.fecha)}</span> },
    { key: "c", header: "Cliente", cell: (r) => <span className="block min-w-[160px]">{cli(r.clienteId)?.razonSocial}</span> },
    { key: "t", header: "Tipo", cell: (r) => <span className="text-muted">{r.tipo === "DESACOPIO" ? "Desacopio" : r.tipo === "DEVOLUCION" ? "Devolución" : "Venta"}</span> },
    { key: "v", header: "Valor declarado", align: "right", cell: (r) => <span className="tnum">{formatMoney(r.valorDeclarado, { decimals: false })}</span> },
    { key: "d", header: "Días", align: "right", sortable: true, sortValue: (r) => Date.now() - Date.parse(r.fechaEntrega ?? r.fecha), cell: (r) => <span className="tnum">{Math.floor((Date.now() - Date.parse(r.fechaEntrega ?? r.fecha)) / 86_400_000)}</span> },
  ];
  return (
    <ReporteLayout
      slug="remitos-pendientes"
      titulo="Remitos sin firmar y sin facturar"
      descripcion="Remitos entregados que todavía no tienen el remito firmado subido o que no se facturaron."
      periodo={periodo}
      onPeriodo={setPeriodo}
      filtros={<Segmented value={tipo} onChange={setTipo} options={[{ value: "firmar", label: "Sin remito firmado" }, { value: "facturar", label: "Sin facturar" }]} />}
      kpis={
        <>
          <KpiCard label={tipo === "firmar" ? "Sin remito firmado" : "Sin facturar"} valor={String(filas.length)} acento />
          <KpiCard label="Valor declarado" valor={formatMoney(filas.reduce((a, r) => a + r.valorDeclarado, 0), { compact: true })} />
        </>
      }
      exportar={() => ({ head: ["Remito", "Circuito", "Entrega", "Cliente", "Tipo", "Valor declarado"], rows: filas.map((r) => [r.numero, `AC${r.circuito}`, formatDate(r.fechaEntrega ?? r.fecha), cli(r.clienteId)?.razonSocial, r.tipo, Math.round(r.valorDeclarado)]) })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(r) => r.id} onRowClick={(r) => router.push(`/remitos/${r.id}`)} initialSort={{ key: "f", dir: "desc" }} empty={{ titulo: "Nada pendiente", descripcion: "Sale de los remitos hechos que todavía no tienen el remito firmado adjunto o no se facturaron." }} />
    </ReporteLayout>
  );
}

