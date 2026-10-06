"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Landmark, Wallet } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useSaldosClientes, useSaldosProveedores, useSucursalActiva } from "@/store/selectors";
import type { Cheque, Cliente, Proveedor } from "@/domain/types";
import { antiguedadDeuda } from "@/domain/cuentasCorrientes";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarrasHorizontalesChart } from "@/components/charts";
import { formatDate, formatMoney } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { CobranzaDialog } from "./cobranza-dialog";

export function CuentasView() {
  const params = useSearchParams();
  const router = useRouter();
  const verPagos = usePuede("ctacte.pagar");
  const tab = params.get("tab") ?? "clientes";
  return (
    <>
      <PageHeader titulo="Cuentas corrientes" descripcion="Saldos, antigüedad de deuda, cobranzas con imputación, pagos a proveedores y cartera de cheques." />
      <Tabs value={tab} onValueChange={(v) => router.replace(`/cuentas-corrientes?tab=${v}`, { scroll: false })}>
        <TabsList className="mb-4">
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          {verPagos && <TabsTrigger value="proveedores">Proveedores</TabsTrigger>}
          <TabsTrigger value="cheques">Cartera de cheques</TabsTrigger>
        </TabsList>
        <TabsContent value="clientes"><ClientesCC filtroInicial={params.get("filtro")} /></TabsContent>
        {verPagos && <TabsContent value="proveedores"><ProveedoresCC /></TabsContent>}
        <TabsContent value="cheques"><Cheques /></TabsContent>
      </Tabs>
    </>
  );
}

function ClientesCC({ filtroInicial }: { filtroInicial?: string | null }) {
  const db = useDb();
  const router = useRouter();
  const saldos = useSaldosClientes();
  const sucursalId = useSucursalActiva();
  const puedeCobrar = usePuede("ctacte.cobrar");
  const [filtro, setFiltro] = React.useState(filtroInicial ?? "");
  const [cobrar, setCobrar] = React.useState(false);
  React.useEffect(() => setFiltro(filtroInicial ?? ""), [filtroInicial]);

  const clientes = db.clientes.filter((c) => !sucursalId || c.sucursalPreferidaId === sucursalId);
  const ids = new Set(clientes.map((c) => c.id));
  const comps = db.comprobantes.filter((c) => c.clienteId && ids.has(c.clienteId));
  const ant = antiguedadDeuda(comps, new Date());
  const total = clientes.reduce((a, c) => a + (saldos.get(c.id)?.saldo ?? 0), 0);
  const vencido = clientes.reduce((a, c) => a + (saldos.get(c.id)?.vencido ?? 0), 0);
  const mes = diaLocal(new Date()).slice(0, 7);
  const cobradoMes = db.cobranzas.filter((c) => ids.has(c.clienteId) && diaLocal(c.fecha).slice(0, 7) === mes).reduce((a, c) => a + c.total, 0);
  const excedido = (c: Cliente) => c.limiteCredito > 0 && (saldos.get(c.id)?.saldo ?? 0) > c.limiteCredito;

  // Último cobro y días promedio de cobro (de facturas pagadas)
  const stats = React.useMemo(() => {
    const m = new Map<string, { ultimo?: string; dias: number[] }>();
    for (const cob of db.cobranzas) {
      const x = m.get(cob.clienteId) ?? { dias: [] };
      if (!x.ultimo || cob.fecha > x.ultimo) x.ultimo = cob.fecha;
      for (const i of cob.imputaciones) {
        const f = db.comprobantes.find((c) => c.id === i.comprobanteId);
        if (f && f.estado === "PAGADO") x.dias.push(Math.max(0, Math.round((new Date(cob.fecha).getTime() - new Date(f.fecha).getTime()) / 86_400_000)));
      }
      m.set(cob.clienteId, x);
    }
    return m;
  }, [db.cobranzas, db.comprobantes]);

  const filas = clientes.filter((c) => {
    const s = saldos.get(c.id);
    if (filtro === "vencidos") return (s?.vencido ?? 0) > 0;
    if (filtro === "excedidos") return excedido(c);
    if (filtro === "con-saldo") return Math.abs(s?.saldo ?? 0) > 0.009;
    return true;
  });

  const columnas: Column<Cliente>[] = [
    { key: "razon", header: "Cliente", sortable: true, sortValue: (c) => c.razonSocial, cell: (c) => <span className="block min-w-[180px] font-medium">{c.nombreFantasia ?? c.razonSocial}</span> },
    { key: "saldo", header: "Saldo total", align: "right", sortable: true, sortValue: (c) => saldos.get(c.id)?.saldo ?? 0, footer: <span className="tnum">{formatMoney(filas.reduce((a, c) => a + (saldos.get(c.id)?.saldo ?? 0), 0), { decimals: false })}</span>, cell: (c) => <span className="font-medium tnum">{formatMoney(saldos.get(c.id)?.saldo ?? 0, { decimals: false })}</span> },
    { key: "venc", header: "Vencido", align: "right", sortable: true, sortValue: (c) => saldos.get(c.id)?.vencido ?? 0, footer: <span className="tnum text-danger">{formatMoney(filas.reduce((a, c) => a + (saldos.get(c.id)?.vencido ?? 0), 0), { decimals: false })}</span>, cell: (c) => { const v = saldos.get(c.id)?.vencido ?? 0; return <span className={cn("tnum", v > 0 ? "font-medium text-danger" : "text-disabled")}>{v > 0 ? formatMoney(v, { decimals: false }) : "—"}</span>; } },
    { key: "aven", header: "A vencer", align: "right", hideOnMobile: true, cell: (c) => <span className="tnum text-muted">{formatMoney(saldos.get(c.id)?.aVencer ?? 0, { decimals: false })}</span> },
    { key: "lim", header: "Límite", align: "right", hideOnMobile: true, cell: (c) => <span className="tnum text-muted">{c.limiteCredito ? formatMoney(c.limiteCredito, { compact: true }) : "Contado"}</span> },
    {
      key: "uso",
      header: "% uso",
      width: 120,
      sortable: true,
      sortValue: (c) => (c.limiteCredito ? (saldos.get(c.id)?.saldo ?? 0) / c.limiteCredito : 0),
      cell: (c) => {
        if (!c.limiteCredito) return <span className="text-disabled">—</span>;
        const u = (saldos.get(c.id)?.saldo ?? 0) / c.limiteCredito;
        return <div className="flex items-center gap-2"><Progress value={u} className="w-14" tone={u > 1 ? "danger" : u > 0.8 ? "accent" : "ink"} /><span className={cn("text-[11px] tnum", u > 1 ? "font-medium text-danger" : "text-muted")}>{Math.round(u * 100)} %</span></div>;
      },
    },
    { key: "ult", header: "Último cobro", hideOnMobile: true, sortable: true, sortValue: (c) => stats.get(c.id)?.ultimo ?? "", cell: (c) => <span className="text-muted">{formatDate(stats.get(c.id)?.ultimo)}</span> },
    {
      key: "dias",
      header: "Días prom. de cobro",
      align: "right",
      hideOnMobile: true,
      cell: (c) => {
        const d = stats.get(c.id)?.dias ?? [];
        return d.length ? <span className="tnum">{Math.round(d.reduce((a, b) => a + b, 0) / d.length)} d</span> : <span className="text-disabled">—</span>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total por cobrar" valor={formatMoney(total, { compact: true })} acento />
        <KpiCard label="Vencido" valor={<span className="text-danger">{formatMoney(vencido, { compact: true })}</span>} subtexto={<button className="font-medium text-danger hover:underline" onClick={() => setFiltro("vencidos")}>Ver clientes</button>} />
        <KpiCard label="Cobrado este mes" valor={formatMoney(cobradoMes, { compact: true })} />
        <KpiCard label="Excedidos de límite" valor={String(clientes.filter(excedido).length)} subtexto={<button className="font-medium hover:underline" onClick={() => setFiltro("excedidos")}>Ver excedidos</button>} />
      </div>
      <Card>
        <CardHeader><CardTitle>Antigüedad de deuda</CardTitle><span className="text-[12px] text-muted">días desde la emisión</span></CardHeader>
        <CardContent className="pb-2">
          <BarrasHorizontalesChart alto={180} resaltar="+90 días" data={(Object.entries(ant) as [string, number][]).map(([k, v]) => ({ clave: `${k} días`, valor: v }))} />
        </CardContent>
      </Card>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(c) => c.id}
        searchText={(c) => `${c.razonSocial} ${c.nombreFantasia ?? ""} ${c.cuit}`}
        searchPlaceholder="Cliente o CUIT"
        onRowClick={(c) => router.push(`/cuentas-corrientes/clientes/${c.id}`)}
        initialSort={{ key: "saldo", dir: "desc" }}
        showFooter
        rowClassName={(c) => (excedido(c) ? "bg-danger-soft/40" : undefined)}
        empty={{ icono: Landmark, titulo: "Sin cuentas corrientes" }}
        filters={<Select size="sm" className="w-[190px]" aria-label="Filtro" value={filtro} onValueChange={setFiltro} options={[{ value: "", label: "Todos los clientes" }, { value: "con-saldo", label: "Con saldo" }, { value: "vencidos", label: "Con deuda vencida" }, { value: "excedidos", label: "Excedidos de límite" }]} />}
        actions={puedeCobrar && <Button size="sm" onClick={() => setCobrar(true)}><Wallet /> Registrar cobro</Button>}
      />
      <CobranzaDialog open={cobrar} onOpenChange={setCobrar} />
    </div>
  );
}

function ProveedoresCC() {
  const db = useDb();
  const router = useRouter();
  const saldos = useSaldosProveedores();
  const total = db.proveedores.reduce((a, p) => a + (saldos.get(p.id)?.saldo ?? 0), 0);
  const vencido = db.proveedores.reduce((a, p) => a + (saldos.get(p.id)?.vencido ?? 0), 0);
  const mes = diaLocal(new Date()).slice(0, 7);
  const pagadoMes = db.pagosProveedores.filter((p) => diaLocal(p.fecha).slice(0, 7) === mes).reduce((a, p) => a + p.total, 0);
  const proximo = (id: string) =>
    db.comprobantes
      .filter((c) => c.proveedorId === id && c.saldoPendiente > 0.009 && c.vencimiento)
      .map((c) => c.vencimiento!)
      .sort()[0];
  const columnas: Column<Proveedor>[] = [
    { key: "razon", header: "Proveedor", sortable: true, sortValue: (p) => p.razonSocial, cell: (p) => <span className="block min-w-[180px] font-medium">{p.razonSocial}</span> },
    { key: "saldo", header: "Saldo", align: "right", sortable: true, sortValue: (p) => saldos.get(p.id)?.saldo ?? 0, footer: <span className="tnum">{formatMoney(total, { decimals: false })}</span>, cell: (p) => <span className="font-medium tnum">{formatMoney(saldos.get(p.id)?.saldo ?? 0, { decimals: false })}</span> },
    { key: "venc", header: "Vencido", align: "right", sortable: true, sortValue: (p) => saldos.get(p.id)?.vencido ?? 0, cell: (p) => { const v = saldos.get(p.id)?.vencido ?? 0; return <span className={cn("tnum", v > 0 ? "font-medium text-danger" : "text-disabled")}>{v > 0 ? formatMoney(v, { decimals: false }) : "—"}</span>; } },
    { key: "prox", header: "Próximo vencimiento", sortable: true, sortValue: (p) => proximo(p.id) ?? "", cell: (p) => <span className="text-muted">{formatDate(proximo(p.id))}</span> },
    { key: "cond", header: "Facturas pendientes", align: "right", cell: (p) => <span className="tnum">{saldos.get(p.id)?.comprobantesPendientes ?? 0}</span> },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Total a pagar" valor={formatMoney(total, { compact: true })} acento />
        <KpiCard label="Vencido" valor={<span className={vencido > 0 ? "text-danger" : ""}>{formatMoney(vencido, { compact: true })}</span>} />
        <KpiCard label="Pagado este mes" valor={formatMoney(pagadoMes, { compact: true })} />
      </div>
      <DataTable rows={db.proveedores} columns={columnas} getRowId={(p) => p.id} searchText={(p) => `${p.razonSocial} ${p.cuit}`} onRowClick={(p) => router.push(`/cuentas-corrientes/proveedores/${p.id}`)} initialSort={{ key: "saldo", dir: "desc" }} showFooter empty={{ icono: Landmark, titulo: "Sin proveedores" }} />
    </div>
  );
}

function Cheques() {
  const db = useDb();
  const puede = usePuede("ctacte.cobrar");
  const [estado, setEstado] = React.useState("EN_CARTERA");
  const filas = db.cheques.filter((c) => !estado || c.estado === estado);
  const enCartera = db.cheques.filter((c) => c.estado === "EN_CARTERA");
  const columnas: Column<Cheque>[] = [
    { key: "tipo", header: "Tipo", cell: (c) => (c.tipo === "ECHEQ" ? "eCheq" : "Cheque") },
    { key: "banco", header: "Banco", sortable: true, sortValue: (c) => c.banco, cell: (c) => c.banco },
    { key: "num", header: "Número", cell: (c) => <span className="font-mono text-[12px]">{c.numero}</span> },
    { key: "importe", header: "Importe", align: "right", sortable: true, sortValue: (c) => c.importe, footer: <span className="tnum">{formatMoney(filas.reduce((a, c) => a + c.importe, 0), { decimals: false })}</span>, cell: (c) => <span className="font-medium tnum">{formatMoney(c.importe)}</span> },
    { key: "cobro", header: "Fecha de cobro", sortable: true, sortValue: (c) => c.fechaCobro, cell: (c) => <span className={cn(c.estado === "EN_CARTERA" && diaLocal(c.fechaCobro) <= diaLocal(new Date()) ? "font-medium text-accent" : "text-muted")}>{formatDate(c.fechaCobro)}</span> },
    { key: "cliente", header: "Librado por (cliente)", cell: (c) => <span className="block min-w-[160px]">{db.clientes.find((x) => x.id === c.clienteId)?.razonSocial}</span> },
    { key: "estado", header: "Estado", sortable: true, sortValue: (c) => c.estado, cell: (c) => <StatusBadge tipo="CHEQUE" estado={c.estado} /> },
    { key: "prov", header: "Entregado a", hideOnMobile: true, cell: (c) => <span className="text-muted">{c.proveedorId ? db.proveedores.find((p) => p.id === c.proveedorId)?.razonSocial : "—"}</span> },
    {
      key: "acc",
      header: "",
      cell: (c) =>
        puede && c.estado === "EN_CARTERA" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="ghost">Acciones</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => { const r = useStore.getState().cambiarEstadoCheque(c.id, "DEPOSITADO"); if (r.ok) toast.success("Cheque depositado"); else toast.error(r.error); }}>Depositar</DropdownMenuItem>
              <DropdownMenuItem danger onSelect={() => { const r = useStore.getState().cambiarEstadoCheque(c.id, "RECHAZADO"); if (r.ok) toast.success("Cheque marcado como rechazado"); else toast.error(r.error); }}>Marcar rechazado</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="En cartera" valor={formatMoney(enCartera.reduce((a, c) => a + c.importe, 0), { compact: true })} acento subtexto={`${enCartera.length} cheques`} />
        <KpiCard label="Cobrables hoy o vencidos" valor={String(enCartera.filter((c) => diaLocal(c.fechaCobro) <= diaLocal(new Date())).length)} subtexto="listos para depositar" />
        <KpiCard label="Entregados a proveedores" valor={String(db.cheques.filter((c) => c.estado === "ENTREGADO").length)} subtexto="se usan como medio de pago en Registrar pago" />
      </div>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(c) => c.id}
        searchText={(c) => `${c.banco} ${c.numero} ${db.clientes.find((x) => x.id === c.clienteId)?.razonSocial}`}
        initialSort={{ key: "cobro", dir: "asc" }}
        showFooter
        empty={{ icono: Wallet, titulo: "Sin cheques" }}
        filters={<Select size="sm" className="w-[190px]" aria-label="Estado" value={estado} onValueChange={setEstado} options={[{ value: "", label: "Todos" }, { value: "EN_CARTERA", label: "En cartera" }, { value: "DEPOSITADO", label: "Depositados" }, { value: "ENTREGADO", label: "Entregados a proveedor" }, { value: "RECHAZADO", label: "Rechazados" }]} />}
      />
    </div>
  );
}
