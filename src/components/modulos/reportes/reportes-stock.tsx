"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { addDays } from "date-fns";
import { toast } from "sonner";
import { FilePlus2 } from "lucide-react";
import { useStore } from "@/store";
import { useAcopiosConSaldo, useDb, usePosiciones, usePuede, useSucursalActiva } from "@/store/selectors";
import { pendienteItem } from "@/domain/acopios";
import { obtenerPrecio } from "@/domain/precios";
import { cantidadReposicion } from "@/domain/productos";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { BarrasAgrupadasChart, COLORES } from "@/components/charts";
import { formatDate, formatMoney, formatNumber, formatPercent, formatQty, unidadCorta } from "@/lib/format";
import { cn, newId } from "@/lib/utils";
import { MovimientosTab } from "@/components/modulos/stock/movimientos-tab";
import { ReporteLayout } from "./reporte-layout";

// ───────────────────────── 5. Valorización de inventario ─────────────────────────

export function ReporteValorizacion() {
  const db = useDb();
  const suc = useSucursalActiva();
  const posiciones = usePosiciones();
  const [lista, setLista] = React.useState("lst_cor");
  const deps = suc ? db.depositos.filter((d) => d.sucursalId === suc) : db.depositos;
  const filas = React.useMemo(
    () =>
      [...posiciones.values()]
        .map((pos) => {
          const fis = deps.reduce((a, d) => a + Math.max(0, pos.porDeposito[d.id]?.fisico ?? 0), 0);
          const p = pos.producto;
          const precio = obtenerPrecio(p.id, lista, db.precios);
          return { p, fis, porDep: Object.fromEntries(deps.map((d) => [d.id, Math.max(0, pos.porDeposito[d.id]?.fisico ?? 0) * p.costoPromedio])), prom: fis * p.costoPromedio, ult: fis * p.costoUltimo, venta: fis * precio };
        })
        .filter((f) => f.fis > 0),
    [posiciones, deps, db.precios, lista],
  );
  type F = (typeof filas)[number];
  const t = filas.reduce((a, f) => ({ prom: a.prom + f.prom, ult: a.ult + f.ult, venta: a.venta + f.venta }), { prom: 0, ult: 0, venta: 0 });
  const porRubro = db.rubros.map((r) => {
    const fs = filas.filter((f) => f.p.rubroId === r.id);
    return { clave: r.nombre, ...Object.fromEntries(deps.map((d) => [d.id, Math.round(fs.reduce((a, f) => a + f.porDep[d.id], 0))])) };
  });
  const columnas: Column<F>[] = [
    { key: "p", header: "Producto", footer: "Total", sortable: true, sortValue: (f) => f.p.codigo, cell: (f) => <span className="block min-w-[200px]"><span className="mr-1.5 whitespace-nowrap font-mono text-[11px] text-muted">{f.p.codigo}</span>{f.p.nombre}</span> },
    { key: "r", header: "Rubro", hideOnMobile: true, cell: (f) => <span className="whitespace-nowrap text-muted">{db.rubros.find((r) => r.id === f.p.rubroId)?.nombre}</span> },
    { key: "q", header: "Físico", align: "right", cell: (f) => <span className="tnum">{formatNumber(f.fis)} {unidadCorta(f.p.unidad)}</span> },
    ...deps.map((d) => ({ key: d.id, header: d.nombre.replace("Depósito ", "Dep. "), align: "right" as const, footer: <span className="tnum">{formatMoney(filas.reduce((a, f) => a + f.porDep[d.id], 0), { decimals: false })}</span>, cell: (f: F) => <span className="tnum text-muted">{formatMoney(f.porDep[d.id], { decimals: false })}</span> })),
    { key: "prom", header: "A costo promedio", align: "right", footer: <span className="tnum text-accent">{formatMoney(t.prom, { decimals: false })}</span>, sortable: true, sortValue: (f) => f.prom, cell: (f) => <span className="font-medium tnum">{formatMoney(f.prom, { decimals: false })}</span> },
    { key: "ult", header: "A costo último", align: "right", footer: <span className="tnum">{formatMoney(t.ult, { decimals: false })}</span>, cell: (f) => <span className="tnum">{formatMoney(f.ult, { decimals: false })}</span> },
    { key: "dif", header: "Diferencia", align: "right", footer: <span className="tnum">{formatMoney(t.ult - t.prom, { decimals: false })}</span>, sortable: true, sortValue: (f) => f.ult - f.prom, cell: (f) => <span className={cn("tnum", f.ult - f.prom > 0 ? "text-danger" : f.ult - f.prom < 0 ? "text-success" : "text-muted")}>{formatMoney(f.ult - f.prom, { decimals: false })}</span> },
    { key: "v", header: "A precio de venta", align: "right", footer: <span className="tnum">{formatMoney(t.venta, { decimals: false })}</span>, sortable: true, sortValue: (f) => f.venta, cell: (f) => <span className="tnum">{formatMoney(f.venta, { decimals: false })}</span> },
  ];
  return (
    <ReporteLayout
      slug="valorizacion"
      titulo="Valorización de inventario"
      descripcion="Cuánto vale el stock por depósito y rubro, a costo promedio y a costo último, y el margen potencial embebido a precio de venta."
      filtros={<Select size="sm" className="w-[190px]" aria-label="Lista de precios" value={lista} onValueChange={setLista} options={db.listasPrecios.map((l) => ({ value: l.id, label: `Venta a lista ${l.nombre}` }))} />}
      filtrosTexto={`Precio de venta: lista ${db.listasPrecios.find((l) => l.id === lista)?.nombre}`}
      kpis={
        <>
          <KpiCard label="Inventario a costo promedio" valor={formatMoney(t.prom, { compact: true })} acento />
          <KpiCard label="A costo de reposición (último)" valor={formatMoney(t.ult, { compact: true })} subtexto={`${formatMoney(t.ult - t.prom, { compact: true })} vs promedio`} />
          <KpiCard label="A precio de venta" valor={formatMoney(t.venta, { compact: true })} />
          <KpiCard label="Margen potencial embebido" valor={formatMoney(t.venta - t.prom, { compact: true })} subtexto={formatPercent(t.venta ? (t.venta - t.prom) / t.venta : 0)} />
        </>
      }
      graficoTitulo="Valor por rubro y depósito (costo promedio)"
      grafico={<BarrasAgrupadasChart data={porRubro} series={deps.map((d, i) => ({ key: d.id, nombre: d.nombre, color: i ? COLORES.barra : COLORES.barraAlt }))} />}
      exportar={() => ({
        head: ["Código", "Producto", "Rubro", "Físico", "Unidad", ...deps.map((d) => `${d.nombre} (costo prom.)`), "A costo promedio", "A costo último", "Diferencia", "A precio de venta"],
        rows: filas.map((f) => [f.p.codigo, f.p.nombre, db.rubros.find((r) => r.id === f.p.rubroId)?.nombre, f.fis, f.p.unidad, ...deps.map((d) => Math.round(f.porDep[d.id])), Math.round(f.prom), Math.round(f.ult), Math.round(f.ult - f.prom), Math.round(f.venta)]),
        foot: ["Total", "", "", "", "", ...deps.map((d) => Math.round(filas.reduce((a, f) => a + f.porDep[d.id], 0))), Math.round(t.prom), Math.round(t.ult), Math.round(t.ult - t.prom), Math.round(t.venta)],
      })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(f) => f.p.id} searchText={(f) => `${f.p.codigo} ${f.p.nombre}`} initialSort={{ key: "prom", dir: "desc" }} showFooter pageSize={100} />
    </ReporteLayout>
  );
}

// ───────────────────────── 6. Deuda de mercadería ─────────────────────────

export function ReporteDeudaMercaderia() {
  const db = useDb();
  const router = useRouter();
  const suc = useSucursalActiva();
  const acopios = useAcopiosConSaldo().filter((a) => ["VIGENTE", "RETIRADO_PARCIAL", "VENCIDO"].includes(a.estado) && (!suc || a.acopio.sucursalId === suc));
  const filas = acopios.flatMap((a) =>
    a.acopio.items
      .filter((i) => pendienteItem(i) > 0)
      .map((i) => {
        const p = db.productos.find((x) => x.id === i.productoId)!;
        const q = pendienteItem(i);
        return { id: i.id, a, p, q, pactado: q * i.precioUnitarioPactado, actual: q * p.costoUltimo, exposicion: q * (p.costoUltimo - i.costoUnitarioSnapshot), cliente: db.clientes.find((c) => c.id === a.acopio.clienteId) };
      }),
  );
  type F = (typeof filas)[number];
  const t = filas.reduce((x, f) => ({ p: x.p + f.pactado, a: x.a + f.actual, e: x.e + f.exposicion }), { p: 0, a: 0, e: 0 });
  const porCliente = new Map<string, number>();
  for (const f of filas) porCliente.set(f.cliente?.nombreFantasia ?? f.cliente?.razonSocial ?? "", (porCliente.get(f.cliente?.nombreFantasia ?? f.cliente?.razonSocial ?? "") ?? 0) + f.pactado);
  const columnas: Column<F>[] = [
    { key: "cli", header: "Cliente", footer: "Total", sortable: true, sortValue: (f) => f.cliente?.razonSocial ?? "", cell: (f) => <span className="block min-w-[140px]">{f.cliente?.nombreFantasia ?? f.cliente?.razonSocial}</span> },
    { key: "aco", header: "Acopio", cell: (f) => <span className="whitespace-nowrap font-mono text-[12px]">{f.a.acopio.numero}</span> },
    { key: "p", header: "Producto", cell: (f) => <span className="block min-w-[180px]">{f.p.nombre}</span> },
    { key: "q", header: "Pendiente", align: "right", cell: (f) => <span className="tnum">{formatQty(f.q, f.p.unidad)}</span> },
    { key: "pa", header: "A precio pactado", align: "right", footer: <span className="tnum text-accent">{formatMoney(t.p, { decimals: false })}</span>, sortable: true, sortValue: (f) => f.pactado, cell: (f) => <span className="font-medium tnum">{formatMoney(f.pactado, { decimals: false })}</span> },
    { key: "ca", header: "A costo actual", align: "right", footer: <span className="tnum">{formatMoney(t.a, { decimals: false })}</span>, cell: (f) => <span className="tnum">{formatMoney(f.actual, { decimals: false })}</span> },
    { key: "ex", header: "Exposición", align: "right", footer: <span className={cn("tnum", t.e > 0 ? "text-danger" : "text-success")}>{formatMoney(t.e, { decimals: false })}</span>, sortable: true, sortValue: (f) => f.exposicion, cell: (f) => <span className={cn("tnum", f.exposicion > 0 ? "text-danger" : f.exposicion < 0 ? "text-success" : "text-muted")}>{formatMoney(f.exposicion, { decimals: false })}</span> },
    { key: "ve", header: "Vence", sortable: true, sortValue: (f) => f.a.acopio.fechaVencimiento, cell: (f) => <span className={cn("whitespace-nowrap", f.a.diasParaVencer < 0 ? "font-medium text-danger" : f.a.diasParaVencer <= 30 ? "font-medium text-warning" : "text-muted")}>{formatDate(f.a.acopio.fechaVencimiento)}</span> },
  ];
  return (
    <ReporteLayout
      slug="deuda-mercaderia"
      titulo="Deuda de mercadería (acopios)"
      descripcion="Lo que todavía hay que entregar a cada cliente: a precio pactado, cuánto cuesta hoy reponerlo y cuánto se erosionó el margen."
      kpis={
        <>
          <KpiCard label="Deuda a precio pactado" valor={formatMoney(t.p, { compact: true })} acento />
          <KpiCard label="Costo de reposición hoy" valor={formatMoney(t.a, { compact: true })} subtexto={`margen restante ${formatPercent(t.p ? (t.p - t.a) / t.p : 0)}`} />
          <KpiCard label="Exposición por suba de costos" valor={<span className={t.e > 0 ? "text-danger" : "text-success"}>{formatMoney(t.e, { compact: true })}</span>} />
          <KpiCard label="Vencen en 30 días" valor={String(acopios.filter((a) => a.diasParaVencer >= 0 && a.diasParaVencer <= 30).length)} subtexto={`${acopios.filter((a) => a.diasParaVencer < 0).length} ya vencidos con saldo`} />
        </>
      }
      graficoTitulo="Deuda por cliente (a precio pactado)"
      grafico={<BarrasAgrupadasChart data={[...porCliente.entries()].sort((a, b) => b[1] - a[1]).map(([clave, v]) => ({ clave, deuda: Math.round(v) }))} series={[{ key: "deuda", nombre: "Deuda de mercadería", color: COLORES.acento }]} />}
      exportar={() => ({
        head: ["Cliente", "Acopio", "Producto", "Pendiente", "Unidad", "A precio pactado", "A costo actual", "Exposición", "Vencimiento"],
        rows: filas.map((f) => [f.cliente?.razonSocial, f.a.acopio.numero, f.p.nombre, f.q, f.p.unidad, Math.round(f.pactado), Math.round(f.actual), Math.round(f.exposicion), formatDate(f.a.acopio.fechaVencimiento)]),
        foot: ["Total", "", "", "", "", Math.round(t.p), Math.round(t.a), Math.round(t.e), ""],
      })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(f) => f.id} searchText={(f) => `${f.cliente?.razonSocial} ${f.a.acopio.numero} ${f.p.nombre}`} onRowClick={(f) => router.push(`/acopios/${f.a.acopio.id}`)} initialSort={{ key: "pa", dir: "desc" }} showFooter pageSize={50} empty={{ titulo: "No hay saldos de acopio pendientes" }} />
    </ReporteLayout>
  );
}

// ───────────────────────── 8. Stock crítico y reposición ─────────────────────────

export function ReporteStockCritico() {
  const db = useDb();
  const router = useRouter();
  const posiciones = usePosiciones();
  const puedeOC = usePuede("compras.editar");
  const desde = addDays(new Date(), -30).toISOString();
  const filas = [...posiciones.values()]
    .filter((p) => p.producto.activo && p.estado !== "OK")
    .map((pos) => {
      const p = pos.producto;
      const vendido = db.movimientos.filter((m) => m.productoId === p.id && (m.tipo === "EGRESO_VENTA" || m.tipo === "EGRESO_ACOPIO") && m.fecha >= desde).reduce((a, m) => a + m.cantidad, 0);
      const diaria = vendido / 30;
      return { pos, p, diaria, cobertura: diaria > 0 ? Math.max(0, pos.disponible) / diaria : Infinity, sugerida: cantidadReposicion(p, pos.disponible, pos.enTransito), proveedor: db.proveedores.find((x) => x.id === p.proveedorHabitualId) };
    });
  type F = (typeof filas)[number];
  const porProveedor = new Map<string, F[]>();
  for (const f of filas) if (f.proveedor && f.sugerida > 0) porProveedor.set(f.proveedor.id, [...(porProveedor.get(f.proveedor.id) ?? []), f]);

  const generar = (proveedorId: string) => {
    const prov = db.proveedores.find((p) => p.id === proveedorId)!;
    const items = (porProveedor.get(proveedorId) ?? []).map((f) => ({ id: newId("ioc"), productoId: f.p.id, cantidadPedida: f.sugerida, cantidadRecibida: 0, costoUnitario: f.p.costoUltimo, descuentoPct: 0 }));
    const u = db.usuarios.find((x) => x.id === useStore.getState().ui.usuarioId);
    const suc = u?.sucursalId ?? "suc_norte";
    const r = useStore.getState().guardarOC({ proveedorId, sucursalId: suc, depositoDestinoId: db.sucursales.find((s) => s.id === suc)?.depositoId ?? "dep_norte", fechaEmision: new Date().toISOString(), fechaEntregaEstimada: addDays(new Date(), prov.plazoEntregaDias).toISOString(), items, observaciones: "Reposición sugerida desde el reporte de stock crítico." });
    if (r.ok) {
      toast.success(`OC borrador creada para ${prov.razonSocial}`, { action: { label: "Abrir", onClick: () => router.push(`/compras/oc/${r.data}`) } });
    } else toast.error(r.error);
  };

  const columnas: Column<F>[] = [
    { key: "p", header: "Producto", sortable: true, sortValue: (f) => f.p.codigo, cell: (f) => <span className="block min-w-[200px]"><span className="mr-1.5 whitespace-nowrap font-mono text-[11px] text-muted">{f.p.codigo}</span>{f.p.nombre}</span> },
    { key: "e", header: "Estado", cell: (f) => <StatusBadge tipo="STOCK" estado={f.pos.estado} /> },
    { key: "d", header: "Disponible", align: "right", cell: (f) => <span className={cn("tnum", f.pos.disponible < 0 && "text-danger")}>{formatNumber(f.pos.disponible)}</span> },
    { key: "m", header: "Mínimo", align: "right", cell: (f) => <span className="tnum text-muted">{formatNumber(f.p.stockMinimo)}</span> },
    { key: "t", header: "En tránsito", align: "right", cell: (f) => <span className="tnum text-info">{f.pos.enTransito ? formatNumber(f.pos.enTransito) : "—"}</span> },
    { key: "v", header: "Venta diaria", align: "right", cell: (f) => <span className="tnum">{formatNumber(f.diaria, 1)}</span> },
    { key: "c", header: "Días de cobertura", align: "right", sortable: true, sortValue: (f) => (Number.isFinite(f.cobertura) ? f.cobertura : 9999), cell: (f) => <span className={cn("tnum", f.cobertura < 7 ? "font-medium text-danger" : "")}>{Number.isFinite(f.cobertura) ? formatNumber(f.cobertura, 0) : "∞"}</span> },
    { key: "s", header: "Sugerido reponer", align: "right", cell: (f) => <span className="font-medium text-accent tnum">{formatQty(f.sugerida, f.p.unidad)}</span> },
    { key: "pr", header: "Proveedor", cell: (f) => <span className="block min-w-[150px] text-muted">{f.proveedor?.razonSocial ?? "—"}</span> },
  ];
  return (
    <ReporteLayout
      slug="stock-critico"
      titulo="Stock crítico y reposición sugerida"
      descripcion="Productos bajo mínimo con su cobertura al ritmo de venta de los últimos 30 días y la cantidad sugerida a pedir (mínimo × 2 − disponible − en tránsito, redondeada a pallet)."
      kpis={
        <>
          <KpiCard label="Productos críticos" valor={String(filas.length)} acento />
          <KpiCard label="Sin stock" valor={String(filas.filter((f) => f.pos.estado === "SIN_STOCK").length)} />
          <KpiCard label="Cobertura menor a 7 días" valor={String(filas.filter((f) => f.cobertura < 7).length)} />
          <KpiCard label="Proveedores a contactar" valor={String(porProveedor.size)} />
        </>
      }
      exportar={() => ({
        head: ["Código", "Producto", "Estado", "Disponible", "Mínimo", "En tránsito", "Venta diaria", "Días de cobertura", "Sugerido", "Unidad", "Proveedor"],
        rows: filas.map((f) => [f.p.codigo, f.p.nombre, f.pos.estado, f.pos.disponible, f.p.stockMinimo, f.pos.enTransito, Math.round(f.diaria * 10) / 10, Number.isFinite(f.cobertura) ? Math.round(f.cobertura) : "", f.sugerida, f.p.unidad, f.proveedor?.razonSocial ?? ""]),
      })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(f) => f.p.id} onRowClick={(f) => router.push(`/productos?id=${f.p.id}`)} initialSort={{ key: "c", dir: "asc" }} empty={{ titulo: "No hay productos bajo mínimo" }} />
      {porProveedor.size > 0 && (
        <Card>
          <CardHeader><CardTitle>Generar órdenes de compra borrador</CardTitle></CardHeader>
          <ul className="divide-y divide-border">
            {[...porProveedor.entries()].map(([id, fs]) => (
              <li key={id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{db.proveedores.find((p) => p.id === id)?.razonSocial}</span>
                  <span className="block text-muted">{fs.map((f) => `${formatQty(f.sugerida, f.p.unidad)} ${f.p.nombre}`).join(" · ")}</span>
                </span>
                <span className="tnum text-muted">{formatMoney(fs.reduce((a, f) => a + f.sugerida * f.p.costoUltimo, 0), { compact: true })}</span>
                {puedeOC && <Button size="sm" onClick={() => generar(id)}><FilePlus2 /> Generar OC borrador</Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </ReporteLayout>
  );
}

// ───────────────────────── 11. Movimientos de stock ─────────────────────────

export function ReporteMovimientos() {
  const db = useDb();
  return (
    <ReporteLayout
      slug="movimientos"
      titulo="Movimientos de stock"
      descripcion="Kardex completo orientado a exportación, con totales por tipo de movimiento. Usá los filtros de la tabla y exportá desde ahí o con el botón de arriba (últimos 90 días)."
      exportar={() => {
        const desde = addDays(new Date(), -90).toISOString();
        const movs = db.movimientos.filter((m) => m.fecha >= desde).sort((a, b) => b.fecha.localeCompare(a.fecha));
        return {
          head: ["Fecha", "Código", "Producto", "Depósito", "Tipo", "Cantidad", "Costo unitario", "Valor"],
          rows: movs.map((m) => {
            const p = db.productos.find((x) => x.id === m.productoId);
            return [formatDate(m.fecha, "dd/MM/yyyy HH:mm"), p?.codigo, p?.nombre, db.depositos.find((d) => d.id === m.depositoId)?.nombre, m.tipo, m.signo * m.cantidad, m.costoUnitario, Math.round(m.signo * m.cantidad * m.costoUnitario)];
          }),
        };
      }}
    >
      <MovimientosTab conTotalesPorTipo />
    </ReporteLayout>
  );
}
