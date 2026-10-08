"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { useDb, useSaldosClientes, useSucursalActiva } from "@/store/selectors";
import type { Auditoria } from "@/domain/types";
import { antiguedadDeuda } from "@/domain/cuentasCorrientes";
import { diasCondicionPago } from "@/domain/ventas";
import { CONDICION_PAGO_LABEL, MEDIO_PAGO_LABEL } from "@/domain/estados";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { Select } from "@/components/ui/select";
import { BarrasAgrupadasChart, COLORES } from "@/components/charts";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { diaLocal, enPeriodo } from "@/lib/periodos";
import { nombreUsuario } from "@/lib/referencias";
import { cn } from "@/lib/utils";
import { ReporteLayout } from "./reporte-layout";
import { usePeriodoReporte } from "./reportes-ventas";
import { pesoDespacho } from "@/components/modulos/despachos/documentos";

// ───────────────────────── 7. Compras ─────────────────────────

export function ReporteCompras() {
  const db = useDb();
  const router = useRouter();
  const suc = useSucursalActiva();
  const [periodo, setPeriodo] = usePeriodoReporte();
  const [rubro, setRubro] = React.useState("");
  const filas = React.useMemo(() => {
    return db.proveedores
      .map((prov) => {
        const ocs = db.ordenesCompra.filter((o) => o.proveedorId === prov.id && o.estado !== "BORRADOR" && o.estado !== "CANCELADA" && enPeriodo(o.fechaEmision, periodo) && (!suc || o.sucursalId === suc));
        const items = ocs.flatMap((o) => o.items).filter((i) => !rubro || db.productos.find((p) => p.id === i.productoId)?.rubroId === rubro);
        const emitido = items.reduce((a, i) => a + i.cantidadPedida * i.costoUnitario * (1 - i.descuentoPct / 100), 0);
        const recibido = items.reduce((a, i) => a + i.cantidadRecibida * i.costoUnitario * (1 - i.descuentoPct / 100), 0);
        const recibidas = ocs.filter((o) => o.estado === "RECIBIDA");
        const aTiempo = recibidas.filter((o) => {
          const ult = db.recepciones.filter((r) => r.ordenCompraId === o.id).map((r) => r.fecha).sort().at(-1);
          return ult && diaLocal(ult) <= diaLocal(o.fechaEntregaEstimada);
        }).length;
        // Evolución de costo: primer y último costo de ingreso en el período, ponderado por producto
        const ingresos = db.movimientos.filter((m) => m.tipo === "INGRESO_COMPRA" && enPeriodo(m.fecha, periodo) && db.productos.find((p) => p.id === m.productoId)?.proveedorHabitualId === prov.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
        const porProd = new Map<string, number[]>();
        for (const m of ingresos) porProd.set(m.productoId, [...(porProd.get(m.productoId) ?? []), m.costoUnitario]);
        const vars = [...porProd.values()].filter((v) => v.length > 1).map((v) => (v.at(-1)! - v[0]) / v[0]);
        return { prov, ocs: ocs.length, emitido, recibido, pendiente: emitido - recibido, cumplimiento: recibidas.length ? aTiempo / recibidas.length : null, variacion: vars.length ? vars.reduce((a, b) => a + b, 0) / vars.length : null };
      })
      .filter((f) => f.ocs > 0);
  }, [db, periodo, suc, rubro]);
  type F = (typeof filas)[number];
  const t = filas.reduce((a, f) => ({ e: a.e + f.emitido, r: a.r + f.recibido, n: a.n + f.ocs }), { e: 0, r: 0, n: 0 });
  const conCumpl = filas.filter((f) => f.cumplimiento !== null);
  const columnas: Column<F>[] = [
    { key: "p", header: "Proveedor", footer: "Total", sortable: true, sortValue: (f) => f.prov.razonSocial, cell: (f) => <span className="block min-w-[180px]">{f.prov.razonSocial}</span> },
    { key: "n", header: "OC emitidas", align: "right", footer: <span className="tnum">{t.n}</span>, cell: (f) => <span className="tnum">{f.ocs}</span> },
    { key: "e", header: "Emitido (neto)", align: "right", footer: <span className="tnum">{formatMoney(t.e, { decimals: false })}</span>, sortable: true, sortValue: (f) => f.emitido, cell: (f) => <span className="tnum">{formatMoney(f.emitido, { decimals: false })}</span> },
    { key: "r", header: "Recibido", align: "right", footer: <span className="tnum">{formatMoney(t.r, { decimals: false })}</span>, cell: (f) => <span className="tnum">{formatMoney(f.recibido, { decimals: false })}</span> },
    { key: "pe", header: "Pendiente de recibir", align: "right", footer: <span className="tnum text-accent">{formatMoney(t.e - t.r, { decimals: false })}</span>, sortable: true, sortValue: (f) => f.pendiente, cell: (f) => <span className={cn("tnum", f.pendiente > 0 && "font-medium text-accent")}>{formatMoney(f.pendiente, { decimals: false })}</span> },
    { key: "c", header: "Cumplimiento de plazo", align: "right", sortable: true, sortValue: (f) => f.cumplimiento ?? -1, cell: (f) => (f.cumplimiento === null ? <span className="text-disabled">—</span> : <span className={cn("tnum", f.cumplimiento < 0.7 ? "text-danger" : "text-success")}>{formatPercent(f.cumplimiento, { decimals: 0 })}</span>) },
    { key: "v", header: "Variación de costo", align: "right", sortable: true, sortValue: (f) => f.variacion ?? 0, cell: (f) => (f.variacion === null ? <span className="text-disabled">—</span> : <span className={cn("tnum", f.variacion > 0 ? "text-danger" : "text-success")}>{formatPercent(f.variacion, { signo: true })}</span>) },
  ];
  return (
    <ReporteLayout
      slug="compras"
      titulo="Compras"
      descripcion="Órdenes emitidas, recibido y pendiente por proveedor, cumplimiento de plazos y evolución de costos en el período."
      periodo={periodo}
      onPeriodo={setPeriodo}
      filtros={<Select size="sm" className="w-[180px]" aria-label="Rubro" value={rubro} onValueChange={setRubro} options={[{ value: "", label: "Todos los rubros" }, ...db.rubros.map((r) => ({ value: r.id, label: r.nombre }))]} />}
      filtrosTexto={rubro ? db.rubros.find((r) => r.id === rubro)?.nombre : undefined}
      kpis={
        <>
          <KpiCard label="Comprado (emitido)" valor={formatMoney(t.e, { compact: true })} acento subtexto={`${t.n} órdenes`} />
          <KpiCard label="Recibido" valor={formatMoney(t.r, { compact: true })} subtexto={formatPercent(t.e ? t.r / t.e : 0, { decimals: 0 })} />
          <KpiCard label="Pendiente de recibir" valor={formatMoney(t.e - t.r, { compact: true })} />
          <KpiCard label="Cumplimiento promedio" valor={formatPercent(conCumpl.length ? conCumpl.reduce((a, f) => a + (f.cumplimiento ?? 0), 0) / conCumpl.length : 0, { decimals: 0 })} subtexto="OC recibidas en fecha" />
        </>
      }
      graficoTitulo="Emitido vs recibido por proveedor"
      grafico={<BarrasAgrupadasChart data={filas.map((f) => ({ clave: f.prov.razonSocial.split(" ")[0], emitido: Math.round(f.emitido), recibido: Math.round(f.recibido) }))} series={[{ key: "emitido", nombre: "Emitido", color: COLORES.barra }, { key: "recibido", nombre: "Recibido", color: COLORES.barraAlt }]} />}
      exportar={() => ({
        head: ["Proveedor", "OC emitidas", "Emitido neto", "Recibido", "Pendiente", "Cumplimiento %", "Variación de costo %"],
        rows: filas.map((f) => [f.prov.razonSocial, f.ocs, Math.round(f.emitido), Math.round(f.recibido), Math.round(f.pendiente), f.cumplimiento === null ? "" : Math.round(f.cumplimiento * 100), f.variacion === null ? "" : Math.round(f.variacion * 1000) / 10]),
        foot: ["Total", t.n, Math.round(t.e), Math.round(t.r), Math.round(t.e - t.r), "", ""],
      })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(f) => f.prov.id} onRowClick={(f) => router.push(`/proveedores/${f.prov.id}`)} initialSort={{ key: "e", dir: "desc" }} showFooter empty={{ titulo: "Sin compras en el período", descripcion: "Sale de las órdenes de compra confirmadas y de los ingresos de mercadería. Probá con otro período o cargá la primera compra." }} />
    </ReporteLayout>
  );
}

// ───────────────────────── 9. Cobranzas y antigüedad ─────────────────────────

export function ReporteCobranzas() {
  const db = useDb();
  const router = useRouter();
  const suc = useSucursalActiva();
  const saldos = useSaldosClientes();
  const [periodo, setPeriodo] = usePeriodoReporte("30D");
  const cobs = db.cobranzas.filter((c) => enPeriodo(c.fecha, periodo) && (!suc || c.sucursalId === suc));
  const porMedio = new Map<string, number>();
  for (const c of cobs) for (const m of c.medios) porMedio.set(m.medio, (porMedio.get(m.medio) ?? 0) + m.importe);
  const porDia = new Map<string, number>();
  for (const c of cobs) porDia.set(diaLocal(c.fecha), (porDia.get(diaLocal(c.fecha)) ?? 0) + c.total);
  const filas = db.clientes
    .filter((c) => !suc || c.sucursalPreferidaId === suc)
    .map((c) => {
      const ant = antiguedadDeuda(db.comprobantes.filter((x) => x.clienteId === c.id), new Date());
      const dias: number[] = [];
      for (const cob of db.cobranzas.filter((x) => x.clienteId === c.id))
        for (const i of cob.imputaciones) {
          const f = db.comprobantes.find((x) => x.id === i.comprobanteId);
          if (f?.estado === "PAGADO") dias.push(Math.max(0, Math.round((new Date(cob.fecha).getTime() - new Date(f.fecha).getTime()) / 86_400_000)));
        }
      return { c, ant, saldo: saldos.get(c.id)?.saldo ?? 0, prom: dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : null, pactado: diasCondicionPago(c.condicionPago) };
    })
    .filter((f) => f.saldo > 0.009 || f.prom !== null);
  type F = (typeof filas)[number];
  const total = cobs.reduce((a, c) => a + c.total, 0);
  const totAnt = filas.reduce((a, f) => ({ a: a.a + f.ant["0-30"], b: a.b + f.ant["31-60"], c: a.c + f.ant["61-90"], d: a.d + f.ant["+90"] }), { a: 0, b: 0, c: 0, d: 0 });
  const columnas: Column<F>[] = [
    { key: "c", header: "Cliente", footer: "Total", cell: (f) => <span className="block min-w-[160px]">{f.c.nombreFantasia ?? f.c.razonSocial}</span> },
    { key: "s", header: "Saldo", align: "right", sortable: true, sortValue: (f) => f.saldo, footer: <span className="tnum">{formatMoney(filas.reduce((a, f) => a + f.saldo, 0), { decimals: false })}</span>, cell: (f) => <span className="font-medium tnum">{formatMoney(f.saldo, { decimals: false })}</span> },
    { key: "a", header: "0–30", align: "right", footer: <span className="tnum">{formatMoney(totAnt.a, { decimals: false })}</span>, cell: (f) => <span className="tnum text-muted">{formatMoney(f.ant["0-30"], { decimals: false })}</span> },
    { key: "b", header: "31–60", align: "right", footer: <span className="tnum">{formatMoney(totAnt.b, { decimals: false })}</span>, cell: (f) => <span className="tnum">{formatMoney(f.ant["31-60"], { decimals: false })}</span> },
    { key: "cc", header: "61–90", align: "right", footer: <span className="tnum">{formatMoney(totAnt.c, { decimals: false })}</span>, cell: (f) => <span className="tnum text-warning">{formatMoney(f.ant["61-90"], { decimals: false })}</span> },
    { key: "d", header: "+90", align: "right", footer: <span className="tnum text-danger">{formatMoney(totAnt.d, { decimals: false })}</span>, cell: (f) => <span className={cn("tnum", f.ant["+90"] > 0 && "font-medium text-danger")}>{formatMoney(f.ant["+90"], { decimals: false })}</span> },
    { key: "p", header: "Días prom. de cobro", align: "right", sortable: true, sortValue: (f) => f.prom ?? -1, cell: (f) => (f.prom === null ? <span className="text-disabled">—</span> : <span className={cn("tnum", f.prom > f.pactado + 5 ? "font-medium text-danger" : "")}>{formatNumber(f.prom, 0)} d</span>) },
    { key: "pc", header: "Condición pactada", cell: (f) => <span className="whitespace-nowrap text-muted">{CONDICION_PAGO_LABEL[f.c.condicionPago]}</span> },
  ];
  return (
    <ReporteLayout
      slug="cobranzas"
      titulo="Cobranzas y antigüedad"
      descripcion="Qué se cobró y con qué medios, la antigüedad de la deuda por cliente y cuánto tardan en pagar frente a lo pactado."
      periodo={periodo}
      onPeriodo={setPeriodo}
      kpis={
        <>
          <KpiCard label="Cobrado en el período" valor={formatMoney(total, { compact: true })} acento subtexto={`${cobs.length} recibos`} />
          {[...porMedio.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, v]) => (
            <KpiCard key={m} label={MEDIO_PAGO_LABEL[m]} valor={formatMoney(v, { compact: true })} subtexto={formatPercent(total ? v / total : 0, { decimals: 0 })} />
          ))}
        </>
      }
      graficoTitulo="Cobrado por día"
      grafico={<BarrasAgrupadasChart data={[...porDia.entries()].sort().map(([k, v]) => ({ clave: format(parseISO(k), "dd/MM"), cobrado: Math.round(v) }))} series={[{ key: "cobrado", nombre: "Cobrado", color: COLORES.barraAlt }]} />}
      exportar={() => ({
        head: ["Cliente", "Saldo", "0-30", "31-60", "61-90", "+90", "Días promedio de cobro", "Condición pactada"],
        rows: filas.map((f) => [f.c.razonSocial, Math.round(f.saldo), Math.round(f.ant["0-30"]), Math.round(f.ant["31-60"]), Math.round(f.ant["61-90"]), Math.round(f.ant["+90"]), f.prom === null ? "" : Math.round(f.prom), CONDICION_PAGO_LABEL[f.c.condicionPago]]),
        foot: ["Total", Math.round(filas.reduce((a, f) => a + f.saldo, 0)), Math.round(totAnt.a), Math.round(totAnt.b), Math.round(totAnt.c), Math.round(totAnt.d), "", ""],
      })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(f) => f.c.id} onRowClick={(f) => router.push(`/cuentas-corrientes/clientes/${f.c.id}`)} initialSort={{ key: "s", dir: "desc" }} showFooter empty={{ titulo: "Sin deuda ni cobranzas", descripcion: "Sale de las facturas a clientes en cuenta corriente y de los recibos de cobro." }} />
    </ReporteLayout>
  );
}

// ───────────────────────── 10. Despachos ─────────────────────────

export function ReporteDespachos() {
  const db = useDb();
  const suc = useSucursalActiva();
  const [periodo, setPeriodo] = usePeriodoReporte("30D");
  const entregas = db.despachos.filter((d) => (d.estado === "ENTREGADO" || (d.estado === "FINALIZADO" && d.modalidad === "RETIRA")) && d.fechaEntrega && enPeriodo(d.fechaEntrega, periodo) && (!suc || d.sucursalId === suc));
  const aTiempo = (d: (typeof entregas)[number]) => diaLocal(d.fechaEntrega!) <= diaLocal(d.fechaProgramada);
  const porDia = new Map<string, { envio: number; mostrador: number }>();
  for (const d of entregas) {
    const k = diaLocal(d.fechaEntrega!);
    const x = porDia.get(k) ?? { envio: 0, mostrador: 0 };
    if (d.modalidad === "RETIRA") x.mostrador++;
    else x.envio++;
    porDia.set(k, x);
  }
  const filas = [
    ...db.vehiculos.map((v) => ({ id: v.id, nombre: `${v.patente} · ${v.descripcion}`, ds: entregas.filter((d) => d.vehiculoId === v.id) })),
    { id: "mostrador", nombre: "Retiro en mostrador", ds: entregas.filter((d) => d.modalidad === "RETIRA") },
  ].map((f) => ({ ...f, n: f.ds.length, kg: f.ds.reduce((a, d) => a + pesoDespacho(d, db.productos), 0), aTiempo: f.ds.length ? f.ds.filter(aTiempo).length / f.ds.length : null, reprog: f.ds.reduce((a, d) => a + (d.reprogramaciones ?? 0), 0) }));
  type F = (typeof filas)[number];
  const kg = filas.reduce((a, f) => a + (f.id === "mostrador" ? 0 : f.kg), 0);
  const columnas: Column<F>[] = [
    { key: "v", header: "Vehículo", footer: "Total", cell: (f) => f.nombre },
    { key: "n", header: "Entregas", align: "right", footer: <span className="tnum">{entregas.length}</span>, cell: (f) => <span className="tnum">{f.n}</span> },
    { key: "kg", header: "Kg transportados", align: "right", footer: <span className="tnum">{formatNumber(kg, 0)}</span>, cell: (f) => <span className="tnum">{formatNumber(f.kg, 0)}</span> },
    { key: "t", header: "% a tiempo", align: "right", cell: (f) => (f.aTiempo === null ? <span className="text-disabled">—</span> : <span className={cn("tnum", f.aTiempo < 0.85 ? "text-danger" : "text-success")}>{formatPercent(f.aTiempo, { decimals: 0 })}</span>) },
    { key: "r", header: "Reprogramaciones", align: "right", cell: (f) => <span className="tnum">{f.reprog}</span> },
  ];
  return (
    <ReporteLayout
      slug="despachos"
      titulo="Despachos"
      descripcion="Entregas por día y por vehículo, puntualidad (entregado en o antes de la fecha programada), reprogramaciones y kilos transportados."
      periodo={periodo}
      onPeriodo={setPeriodo}
      kpis={
        <>
          <KpiCard label="Entregas" valor={String(entregas.length)} acento />
          <KpiCard label="% a tiempo" valor={formatPercent(entregas.length ? entregas.filter(aTiempo).length / entregas.length : 0, { decimals: 0 })} />
          <KpiCard label="Kg transportados" valor={`${formatNumber(kg / 1000, 1)} t`} />
          <KpiCard label="Reprogramaciones" valor={String(db.despachos.filter((d) => d.reprogramaciones).reduce((a, d) => a + (d.reprogramaciones ?? 0), 0))} />
        </>
      }
      graficoTitulo="Entregas por día"
      grafico={<BarrasAgrupadasChart formato="number" data={[...porDia.entries()].sort().map(([k, v]) => ({ clave: format(parseISO(k), "dd/MM"), ...v }))} series={[{ key: "envio", nombre: "Envío", color: COLORES.barraAlt }, { key: "mostrador", nombre: "Mostrador", color: COLORES.barra }]} />}
      exportar={() => ({
        head: ["Remito", "Cliente", "Programado", "Entregado", "Vehículo", "Kg", "A tiempo", "Reprogramaciones"],
        rows: entregas.map((d) => [d.numero, db.clientes.find((c) => c.id === d.clienteId)?.razonSocial, formatDate(d.fechaProgramada), formatDateTime(d.fechaEntrega), db.vehiculos.find((v) => v.id === d.vehiculoId)?.patente ?? "Mostrador", Math.round(pesoDespacho(d, db.productos)), aTiempo(d) ? "Sí" : "No", d.reprogramaciones ?? 0]),
      })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(f) => f.id} showFooter empty={{ titulo: "Sin entregas en el período", descripcion: "Sale de los despachos entregados (envíos a obra y retiros por mostrador). Probá con otro período." }} />
    </ReporteLayout>
  );
}

// ───────────────────────── 12. Auditoría ─────────────────────────

export function ReporteAuditoria() {
  const db = useDb();
  const [periodo, setPeriodo] = usePeriodoReporte("90D");
  const [usuario, setUsuario] = React.useState("");
  const [entidad, setEntidad] = React.useState("");
  const [accion, setAccion] = React.useState("");
  const entidades = [...new Set(db.auditoria.map((a) => a.entidad))].sort();
  const acciones = [...new Set(db.auditoria.map((a) => a.accion))].sort();
  const filas = db.auditoria.filter((a) => enPeriodo(a.fecha, periodo) && (!usuario || a.usuarioId === usuario) && (!entidad || a.entidad === entidad) && (!accion || a.accion === accion));
  const columnas: Column<Auditoria>[] = [
    { key: "f", header: "Fecha y hora", sortable: true, sortValue: (a) => a.fecha, cell: (a) => <span className="whitespace-nowrap text-muted">{formatDateTime(a.fecha)}</span> },
    { key: "u", header: "Usuario", sortable: true, sortValue: (a) => nombreUsuario(db, a.usuarioId), cell: (a) => <span className="whitespace-nowrap">{nombreUsuario(db, a.usuarioId)}</span> },
    { key: "a", header: "Acción", sortable: true, sortValue: (a) => a.accion, cell: (a) => <span className="font-medium">{a.accion}</span> },
    { key: "e", header: "Entidad", cell: (a) => <span className="text-muted">{a.entidad}</span> },
    { key: "d", header: "Detalle", cell: (a) => <span className="block max-w-[420px] truncate text-muted">{a.detalle}</span> },
  ];
  return (
    <ReporteLayout
      slug="auditoria"
      titulo="Auditoría"
      descripcion="Quién hizo qué y cuándo: cada operación del sistema queda registrada y no se puede borrar."
      periodo={periodo}
      onPeriodo={setPeriodo}
      filtros={
        <>
          <Select size="sm" className="w-[160px]" aria-label="Usuario" value={usuario} onValueChange={setUsuario} options={[{ value: "", label: "Todos los usuarios" }, ...db.usuarios.map((u) => ({ value: u.id, label: u.nombre }))]} />
          <Select size="sm" className="w-[170px]" aria-label="Entidad" value={entidad} onValueChange={setEntidad} options={[{ value: "", label: "Todas las entidades" }, ...entidades.map((e) => ({ value: e, label: e }))]} />
          <Select size="sm" className="w-[220px]" aria-label="Acción" value={accion} onValueChange={setAccion} options={[{ value: "", label: "Todas las acciones" }, ...acciones.map((e) => ({ value: e, label: e }))]} />
        </>
      }
      kpis={
        <>
          <KpiCard label="Eventos" valor={String(filas.length)} acento />
          <KpiCard label="Usuarios activos" valor={String(new Set(filas.map((f) => f.usuarioId)).size)} />
          <KpiCard label="Excepciones autorizadas" valor={String(filas.filter((f) => f.accion.startsWith("Autorizó")).length)} subtexto="crédito y retiros impagos" />
          <KpiCard label="Anulaciones y ajustes" valor={String(filas.filter((f) => /Anuló|ajuste/i.test(f.accion)).length)} />
        </>
      }
      exportar={() => ({ head: ["Fecha", "Usuario", "Acción", "Entidad", "Detalle"], rows: filas.map((a) => [formatDateTime(a.fecha), nombreUsuario(db, a.usuarioId), a.accion, a.entidad, a.detalle]) })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(a) => a.id} searchText={(a) => `${a.accion} ${a.detalle} ${a.entidad}`} initialSort={{ key: "f", dir: "desc" }} pageSize={50} empty={{ titulo: "Sin eventos para el filtro", descripcion: "Cada alta, cambio, anulación y descarga queda registrada acá con usuario y fecha." }} />
    </ReporteLayout>
  );
}
