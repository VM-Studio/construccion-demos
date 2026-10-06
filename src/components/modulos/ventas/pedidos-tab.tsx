"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { useDb, usePuede, useRentabilidadPedidos, useSucursalActiva } from "@/store/selectors";
import type { Pedido } from "@/domain/types";
import { porcentajeDespachado } from "@/domain/ventas";
import { ESTADOS, TIPO_COMPROBANTE_LABEL } from "@/domain/estados";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DateRangePicker } from "@/components/shared/filter-bar";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { diaLocal, enPeriodo, periodoDesdePreset, type Periodo } from "@/lib/periodos";
import { cn } from "@/lib/utils";

const OPC_ESTADO = Object.keys(ESTADOS)
  .filter((k) => k.startsWith("PEDIDO."))
  .map((k) => ({ value: k.slice(7), label: ESTADOS[k].label }));

export function PedidosTab() {
  const db = useDb();
  const router = useRouter();
  const sucursalId = useSucursalActiva();
  const rent = useRentabilidadPedidos();
  const verMargen = usePuede("margenes.ver");
  const puedeCrear = usePuede("ventas.editar");
  const [periodo, setPeriodo] = React.useState<Periodo>(() => periodoDesdePreset("90D"));
  const [estado, setEstado] = React.useState("");
  const [vendedor, setVendedor] = React.useState("");
  const [modalidad, setModalidad] = React.useState("");
  const [cliente, setCliente] = React.useState("");

  const cli = React.useMemo(() => new Map(db.clientes.map((c) => [c.id, c])), [db.clientes]);
  const base = db.pedidos.filter((p) => !sucursalId || p.sucursalId === sucursalId);
  const activo = (p: Pedido) => !["BORRADOR", "CANCELADO"].includes(p.estado);
  const filas = base.filter(
    (p) =>
      (enPeriodo(p.fecha, periodo) || (!estado && ["BORRADOR", "CONFIRMADO", "EN_PREPARACION", "DESPACHADO_PARCIAL"].includes(p.estado))) &&
      (!estado || p.estado === estado) &&
      (!vendedor || p.vendedorId === vendedor) &&
      (!modalidad || p.modalidadEntrega === modalidad) &&
      (!cliente || p.clienteId === cliente),
  );

  const mes = diaLocal(new Date()).slice(0, 7);
  const delMes = base.filter((p) => activo(p) && diaLocal(p.fecha).slice(0, 7) === mes);
  const pendDespacho = base.filter((p) => activo(p) && porcentajeDespachado(p) < 1).length;
  const pendFacturar = base.filter((p) => activo(p) && !p.comprobanteId).length;
  const vendidos = base.filter((p) => p.estado === "FACTURADO" || p.estado === "DESPACHADO");
  const ing = vendidos.reduce((a, p) => a + (rent.get(p.id)?.ingreso ?? 0), 0);
  const mrg = vendidos.reduce((a, p) => a + (rent.get(p.id)?.margenBruto ?? 0), 0);

  const columnas: Column<Pedido>[] = [
    { key: "numero", header: "Número", sortable: true, sortValue: (p) => p.numero, cell: (p) => <span className="whitespace-nowrap font-mono text-[12px]">{p.numero}</span> },
    { key: "cliente", header: "Cliente", sortable: true, sortValue: (p) => cli.get(p.clienteId)?.razonSocial ?? "", cell: (p) => <span className="block min-w-[160px]">{cli.get(p.clienteId)?.nombreFantasia ?? cli.get(p.clienteId)?.razonSocial}</span> },
    { key: "sucursal", header: "Sucursal", hideOnMobile: true, cell: (p) => <span className="whitespace-nowrap text-muted">{db.sucursales.find((s) => s.id === p.sucursalId)?.nombre.replace("Sucursal ", "")}</span> },
    { key: "fecha", header: "Fecha", sortable: true, sortValue: (p) => p.fecha, cell: (p) => <span className="text-muted">{formatDate(p.fecha)}</span> },
    { key: "entrega", header: "Entrega", hideOnMobile: true, sortable: true, sortValue: (p) => p.fechaEntregaComprometida ?? "", cell: (p) => <span className="text-muted">{formatDate(p.fechaEntregaComprometida)}</span> },
    { key: "modalidad", header: "Modalidad", hideOnMobile: true, cell: (p) => <Badge>{p.modalidadEntrega === "ENVIO" ? "Envío" : "Retira"}</Badge> },
    { key: "estado", header: "Estado", sortable: true, sortValue: (p) => p.estado, cell: (p) => <StatusBadge tipo="PEDIDO" estado={p.estado} /> },
    { key: "total", header: "Total", align: "right", sortable: true, sortValue: (p) => p.total, cell: (p) => <span className="tnum">{formatMoney(p.total, { decimals: false })}</span> },
    ...(verMargen
      ? [{
          key: "margen",
          header: "Margen %",
          align: "right" as const,
          sortable: true,
          sortValue: (p: Pedido) => rent.get(p.id)?.margenPct ?? 0,
          cell: (p: Pedido) => {
            const m = rent.get(p.id)?.margenPct ?? 0;
            return p.estado === "BORRADOR" ? <span className="text-disabled">—</span> : <span className={cn("tnum", m < 0.1 ? "text-danger" : "text-ink")}>{formatPercent(m)}</span>;
          },
        }]
      : []),
    {
      key: "desp",
      header: "Despachado",
      width: 120,
      hideOnMobile: true,
      sortable: true,
      sortValue: porcentajeDespachado,
      cell: (p) => (
        <div className="flex items-center gap-2">
          <Progress value={porcentajeDespachado(p)} className="w-14" tone={porcentajeDespachado(p) >= 1 ? "success" : "ink"} />
          <span className="text-[11px] text-muted tnum">{Math.round(porcentajeDespachado(p) * 100)} %</span>
        </div>
      ),
    },
    {
      key: "comp",
      header: "Comprobante",
      hideOnMobile: true,
      cell: (p) => {
        const c = db.comprobantes.find((x) => x.id === p.comprobanteId);
        return c ? <span className="whitespace-nowrap text-[12px] text-muted">{TIPO_COMPROBANTE_LABEL[c.tipo].replace("Factura ", "F")} {c.numero}</span> : <span className="text-disabled">—</span>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Pedidos del mes" valor={String(delMes.length)} acento subtexto={formatMoney(delMes.reduce((a, p) => a + p.total, 0), { compact: true })} />
        <KpiCard label="Pendientes de despacho" valor={String(pendDespacho)} subtexto={<Link href="/despachos" className="hover:underline">Ir a despachos</Link>} />
        <KpiCard label="Pendientes de facturar" valor={String(pendFacturar)} />
        {verMargen ? <KpiCard label="Margen promedio" valor={formatPercent(ing ? mrg / ing : 0)} subtexto="pedidos vendidos" /> : <KpiCard label="Clientes con pedidos" valor={String(new Set(delMes.map((p) => p.clienteId)).size)} subtexto="este mes" />}
      </div>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(p) => p.id}
        searchText={(p) => `${p.numero} ${cli.get(p.clienteId)?.razonSocial} ${cli.get(p.clienteId)?.nombreFantasia ?? ""}`}
        searchPlaceholder="Número o cliente"
        onRowClick={(p) => router.push(`/ventas/pedidos/${p.id}`)}
        initialSort={{ key: "fecha", dir: "desc" }}
        empty={{ icono: FileText, titulo: "No hay pedidos", accion: puedeCrear ? <Button size="sm" onClick={() => router.push("/ventas/pedidos/nuevo")}><Plus />Nuevo pedido</Button> : undefined }}
        filters={
          <>
            <DateRangePicker value={periodo} onChange={setPeriodo} presets={[{ value: "MES", label: "Este mes" }, { value: "30D", label: "30 días" }, { value: "90D", label: "90 días" }]} />
            <Select size="sm" className="w-[160px]" aria-label="Estado" value={estado} onValueChange={setEstado} options={[{ value: "", label: "Todos los estados" }, ...OPC_ESTADO]} />
            <Select size="sm" className="w-[150px]" aria-label="Vendedor" value={vendedor} onValueChange={setVendedor} options={[{ value: "", label: "Todos los vendedores" }, ...db.usuarios.filter((u) => u.rol === "VENTAS").map((u) => ({ value: u.id, label: u.nombre }))]} />
            <Select size="sm" className="w-[190px]" aria-label="Cliente" value={cliente} onValueChange={setCliente} options={[{ value: "", label: "Todos los clientes" }, ...db.clientes.map((c) => ({ value: c.id, label: c.nombreFantasia ?? c.razonSocial }))]} />
            <Select size="sm" className="w-[130px]" aria-label="Modalidad" value={modalidad} onValueChange={setModalidad} options={[{ value: "", label: "Envío y retira" }, { value: "ENVIO", label: "Envío" }, { value: "RETIRA", label: "Retira" }]} />
          </>
        }
        actions={puedeCrear && <Button size="sm" onClick={() => router.push("/ventas/pedidos/nuevo")}><Plus /> Nuevo pedido</Button>}
      />
    </div>
  );
}
