"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, Plus } from "lucide-react";
import { useAcopiosConSaldo, useDb, usePuede, useSucursalActiva, type AcopioConSaldo } from "@/store/selectors";
import { ESTADOS } from "@/domain/estados";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACTIVOS = new Set(["VIGENTE", "RETIRADO_PARCIAL", "VENCIDO"]);

export function AcopiosView() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const sucursalId = useSucursalActiva();
  const todos = useAcopiosConSaldo();
  const verMargen = usePuede("margenes.ver");
  const puedeCrear = usePuede("acopios.editar");
  const [estado, setEstado] = React.useState("");
  const [cliente, setCliente] = React.useState("");
  const [porVencer, setPorVencer] = React.useState(params.get("filtro") === "por-vencer");
  const [conSaldo, setConSaldo] = React.useState(false);
  React.useEffect(() => setPorVencer(params.get("filtro") === "por-vencer"), [params]);

  const base = todos.filter((a) => !sucursalId || a.acopio.sucursalId === sucursalId);
  const activos = base.filter((a) => ACTIVOS.has(a.estado));
  const filas = base.filter(
    (a) =>
      (!estado || a.estado === estado) &&
      (!cliente || a.acopio.clienteId === cliente) &&
      (!porVencer || (ACTIVOS.has(a.estado) && a.diasParaVencer <= 15)) &&
      (!conSaldo || a.deuda.aPrecioPactado > 0),
  );
  const pactado = activos.reduce((s, a) => s + a.deuda.aPrecioPactado, 0);
  const actual = activos.reduce((s, a) => s + a.deuda.aCostoActual, 0);
  const exposicion = activos.reduce((s, a) => s + a.deuda.exposicion, 0);
  const vencen30 = activos.filter((a) => a.diasParaVencer >= 0 && a.diasParaVencer <= 30).length;
  const cli = (id: string) => db.clientes.find((c) => c.id === id);

  const columnas: Column<AcopioConSaldo>[] = [
    { key: "numero", header: "Número", footer: "Total", sortable: true, sortValue: (a) => a.acopio.numero, cell: (a) => <span className="whitespace-nowrap font-mono text-[12px]">{a.acopio.numero}</span> },
    { key: "cliente", header: "Cliente", sortable: true, sortValue: (a) => cli(a.acopio.clienteId)?.razonSocial ?? "", cell: (a) => <span className="block min-w-[160px]">{cli(a.acopio.clienteId)?.nombreFantasia ?? cli(a.acopio.clienteId)?.razonSocial}</span> },
    { key: "suc", header: "Sucursal", hideOnMobile: true, cell: (a) => <span className="whitespace-nowrap text-muted">{db.sucursales.find((s) => s.id === a.acopio.sucursalId)?.nombre.replace("Sucursal ", "")}</span> },
    { key: "inicio", header: "Inicio", hideOnMobile: true, sortable: true, sortValue: (a) => a.acopio.fechaInicio, cell: (a) => <span className="text-muted">{formatDate(a.acopio.fechaInicio)}</span> },
    {
      key: "venc",
      header: "Vencimiento",
      sortable: true,
      sortValue: (a) => a.acopio.fechaVencimiento,
      cell: (a) => (
        <span className={cn("whitespace-nowrap", ACTIVOS.has(a.estado) && a.diasParaVencer < 0 ? "font-medium text-danger" : ACTIVOS.has(a.estado) && a.diasParaVencer <= 15 ? "font-medium text-warning" : "text-muted")}>
          {formatDate(a.acopio.fechaVencimiento)}
          {ACTIVOS.has(a.estado) && a.diasParaVencer >= 0 && a.diasParaVencer <= 30 && <span className="ml-1 text-[11px]">({a.diasParaVencer} d)</span>}
        </span>
      ),
    },
    { key: "estado", header: "Estado", sortable: true, sortValue: (a) => a.estado, cell: (a) => <StatusBadge tipo="ACOPIO" estado={a.estado} /> },
    { key: "total", header: "Total pactado", align: "right", sortable: true, sortValue: (a) => a.acopio.total, cell: (a) => <span className="tnum">{formatMoney(a.acopio.total, { decimals: false })}</span> },
    {
      key: "pagado",
      header: "Pago",
      cell: (a) => (a.pagadoPct >= 0.999 ? <Badge variant="success">Pagado</Badge> : <Badge variant="warning">Saldo {formatMoney(a.acopio.total - a.acopio.montoPagado, { compact: true })}</Badge>),
    },
    {
      key: "ret",
      header: "% retirado",
      width: 120,
      sortable: true,
      sortValue: (a) => a.retiradoPct,
      cell: (a) => (
        <div className="flex items-center gap-2">
          <Progress value={a.retiradoPct} className="w-14" tone={a.retiradoPct >= 1 ? "success" : "accent"} />
          <span className="text-[11px] text-muted tnum">{Math.round(a.retiradoPct * 100)} %</span>
        </div>
      ),
    },
    { key: "saldo", header: "Saldo pendiente", align: "right", footer: <span className="tnum text-accent">{formatMoney(filas.reduce((x, a) => x + a.deuda.aPrecioPactado, 0), { decimals: false })}</span>, sortable: true, sortValue: (a) => a.deuda.aPrecioPactado, cell: (a) => <span className={cn("font-medium tnum", a.deuda.aPrecioPactado > 0 && "text-accent")}>{formatMoney(a.deuda.aPrecioPactado, { decimals: false })}</span> },
    ...(verMargen
      ? [{
          key: "margen",
          header: "Margen actual",
          align: "right" as const,
          sortable: true,
          sortValue: (a: AcopioConSaldo) => a.deuda.margenActualPct,
          cell: (a: AcopioConSaldo) => (a.deuda.aPrecioPactado > 0 ? <span className={cn("tnum", a.deuda.margenActualPct < 0.1 ? "text-danger" : "text-ink")}>{formatPercent(a.deuda.margenActualPct)}</span> : <span className="text-disabled">—</span>),
        }]
      : []),
  ];

  return (
    <>
      <PageHeader
        titulo="Acopios"
        descripcion="Mercadería vendida y cobrada que el cliente retira en partes: lo que todavía debemos entregar es deuda de mercadería."
        acciones={puedeCrear && <Button onClick={() => router.push("/acopios/nuevo")}><Plus /> Nuevo acopio</Button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Acopios vigentes" valor={String(activos.length)} icono={Boxes} />
        <KpiCard label="Deuda de mercadería" valor={formatMoney(pactado, { compact: true })} acento subtexto="a precio pactado" />
        {verMargen && <KpiCard label="Deuda a costo de reposición" valor={formatMoney(actual, { compact: true })} subtexto="lo que cuesta hoy reponerlo" />}
        {verMargen && (
          <KpiCard
            label="Exposición"
            valor={<span className={exposicion > 0 ? "text-danger" : "text-success"}>{exposicion > 0 ? "+" : ""}{formatMoney(exposicion, { compact: true })}</span>}
            subtexto={exposicion > 0 ? "el costo subió desde que se pactó" : "el costo bajó desde que se pactó"}
          />
        )}
        <KpiCard label="Vencen en 30 días" valor={String(vencen30)} subtexto={<button className="font-medium text-warning hover:underline" onClick={() => setPorVencer(true)}>Ver por vencer</button>} />
      </div>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(a) => a.acopio.id}
        searchText={(a) => `${a.acopio.numero} ${cli(a.acopio.clienteId)?.razonSocial} ${cli(a.acopio.clienteId)?.nombreFantasia ?? ""}`}
        searchPlaceholder="Número o cliente"
        onRowClick={(a) => router.push(`/acopios/${a.acopio.id}`)}
        initialSort={{ key: "saldo", dir: "desc" }}
        showFooter
        rowClassName={(a) => (a.estado === "VENCIDO" ? "bg-danger-soft/40" : undefined)}
        empty={{ icono: Boxes, titulo: "Sin acopios", descripcion: "Registrá el primer acopio de un cliente.", accion: puedeCrear ? <Button size="sm" onClick={() => router.push("/acopios/nuevo")}><Plus />Nuevo acopio</Button> : undefined }}
        filters={
          <>
            <Select size="sm" className="w-[160px]" aria-label="Estado" value={estado} onValueChange={setEstado} options={[{ value: "", label: "Todos los estados" }, ...Object.keys(ESTADOS).filter((k) => k.startsWith("ACOPIO.")).map((k) => ({ value: k.slice(7), label: ESTADOS[k].label }))]} />
            <Select size="sm" className="w-[200px]" aria-label="Cliente" value={cliente} onValueChange={setCliente} options={[{ value: "", label: "Todos los clientes" }, ...db.clientes.filter((c) => base.some((a) => a.acopio.clienteId === c.id)).map((c) => ({ value: c.id, label: c.nombreFantasia ?? c.razonSocial }))]} />
            <label className="flex items-center gap-2 text-[13px] text-muted"><Checkbox checked={porVencer} onCheckedChange={(v) => setPorVencer(!!v)} /> Por vencer (15 días)</label>
            <label className="flex items-center gap-2 text-[13px] text-muted"><Checkbox checked={conSaldo} onCheckedChange={(v) => setConSaldo(!!v)} /> Con saldo</label>
          </>
        }
      />
    </>
  );
}
