"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, Download, FileSearch, Plus } from "lucide-react";
import { useAcopiosResumen, useDb, usePuede, useSucursalActiva, useUnidadNegocio, useVeCircuito2, type AcopioResumen } from "@/store/selectors";
import { estaVencido } from "@/domain/cuentasCorrientes";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { Combobox } from "@/components/shared/combobox";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { aCSV, cn, descargarArchivo } from "@/lib/utils";

export function AcopiosView() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const sucursal = useSucursalActiva();
  const un = useUnidadNegocio();
  const veC2 = useVeCircuito2();
  const puedeCrear = usePuede("acopios.editar");
  const todos = useAcopiosResumen();
  const filtroUrl = params.get("filtro");
  const [estado, setEstado] = React.useState(filtroUrl ? "" : "VIGENTE");
  const [circuito, setCircuito] = React.useState("");
  const [cliente, setCliente] = React.useState("");
  const [forma, setForma] = React.useState("");
  const [porVencer, setPorVencer] = React.useState(filtroUrl === "por-vencer");
  const [conSaldo, setConSaldo] = React.useState(false);
  const [impagos, setImpagos] = React.useState(filtroUrl === "impagos");
  const hoy = new Date();
  const impago = (r: AcopioResumen) => r.acopio.formaPago === "CUENTA_CORRIENTE" && db.comprobantes.some((c) => r.acopio.comprobanteIds.includes(c.id) && estaVencido(c, hoy));

  const base = todos.filter((r) => (veC2 || r.acopio.circuito !== 2) && (!sucursal || r.acopio.sucursalId === sucursal) && (!un || r.acopio.unidadNegocioId === un));
  const filas = base.filter(
    (r) =>
      (!estado || r.estado === estado) &&
      (!circuito || String(r.acopio.circuito) === circuito) &&
      (!cliente || r.acopio.clienteId === cliente) &&
      (!forma || r.acopio.formaPago === forma) &&
      (!porVencer || (r.estado === "VIGENTE" && r.diasParaVencer <= 30) || (porVencer && r.estado === "VENCIDO")) &&
      (!conSaldo || r.saldo > 0.009) &&
      (!impagos || impago(r)),
  );
  const vig = base.filter((r) => r.estado === "VIGENTE");
  const t = filas.reduce((a, r) => ({ i: a.i + r.acopio.importe, re: a.re + r.retirado, s: a.s + r.saldo, p: a.p + r.pendienteEntrega }), { i: 0, re: 0, s: 0, p: 0 });
  const cli = (id: string) => db.clientes.find((c) => c.id === id);
  const obras = (r: AcopioResumen) => db.obras.filter((o) => r.acopio.obraIds.includes(o.id)).map((o) => o.nombre).join(", ");

  const columnas: Column<AcopioResumen>[] = [
    { key: "n", header: "Número", sortable: true, sortValue: (r) => r.acopio.numero, footer: `${filas.length} acopios`, cell: (r) => <span className="whitespace-nowrap font-mono text-[12px]">{r.acopio.numero}</span> },
    { key: "ci", header: "Circuito", cell: (r) => <CircuitoBadge circuito={r.acopio.circuito} corto /> },
    { key: "c", header: "Cliente", sortable: true, sortValue: (r) => cli(r.acopio.clienteId)?.razonSocial ?? "", cell: (r) => <span className="block min-w-[150px]">{cli(r.acopio.clienteId)?.nombreFantasia ?? cli(r.acopio.clienteId)?.razonSocial}</span> },
    { key: "o", header: "Obras", cell: (r) => <span className="block max-w-[200px] truncate text-[12px] text-muted" title={obras(r)}>{obras(r)}</span>, hideOnMobile: true },
    { key: "f", header: "Fecha", sortable: true, sortValue: (r) => r.acopio.fechaCreacion, cell: (r) => <span className="text-muted">{formatDate(r.acopio.fechaCreacion)}</span>, hideOnMobile: true },
    { key: "v", header: "Vencimiento", sortable: true, sortValue: (r) => r.acopio.fechaVencimiento, cell: (r) => <span className={cn("whitespace-nowrap", r.estado === "VIGENTE" && r.diasParaVencer <= 30 ? "font-medium text-warning" : r.estado === "VENCIDO" ? "font-medium text-danger" : "text-muted")}>{formatDate(r.acopio.fechaVencimiento)}</span> },
    { key: "i", header: "Importe", align: "right", sortable: true, sortValue: (r) => r.acopio.importe, footer: <span className="tnum">{formatMoney(t.i, { decimals: false })}</span>, cell: (r) => <span className="tnum">{formatMoney(r.acopio.importe, { decimals: false })}</span> },
    { key: "r", header: "Retirado", align: "right", footer: <span className="tnum">{formatMoney(t.re, { decimals: false })}</span>, cell: (r) => <span className="tnum">{formatMoney(r.retirado, { decimals: false })}</span>, hideOnMobile: true },
    { key: "s", header: "Saldo disponible", align: "right", sortable: true, sortValue: (r) => r.saldo, footer: <span className="tnum text-accent">{formatMoney(t.s, { decimals: false })}</span>, cell: (r) => <span className={cn("font-medium tnum", r.saldo < 0 && "text-danger")}>{formatMoney(r.saldo)}</span> },
    { key: "p", header: "Pendiente entrega", align: "right", sortable: true, sortValue: (r) => r.pendienteEntrega, footer: <span className="tnum">{formatMoney(t.p, { decimals: false })}</span>, cell: (r) => (r.pendienteEntrega > 0.5 ? <span className="tnum">{formatMoney(r.pendienteEntrega, { decimals: false })}</span> : <span className="text-disabled">—</span>) },
    { key: "fp", header: "Forma de pago", cell: (r) => (r.acopio.formaPago === "ANTICIPO" ? <Badge>Anticipo</Badge> : <Badge variant={impago(r) ? "danger" : "info"} className="whitespace-nowrap">Cta. cte. · pagado {formatPercent(r.pagadoPct, { decimals: 0 })}</Badge>) },
    { key: "e", header: "Estado", cell: (r) => <StatusBadge tipo="ACOPIO" estado={r.estado} /> },
  ];

  const exportar = () =>
    descargarArchivo(
      "acopios.csv",
      aCSV(
        ["Número", "Circuito", "Cliente", "Obras", "Fecha", "Vencimiento", "Importe", "Retirado", "Saldo disponible", "Pendiente de entrega", "Forma de pago", "Pagado %", "Estado"],
        filas.map((r) => [r.acopio.numero, `AC${r.acopio.circuito}`, cli(r.acopio.clienteId)?.razonSocial, obras(r), formatDate(r.acopio.fechaCreacion), formatDate(r.acopio.fechaVencimiento), Math.round(r.acopio.importe), Math.round(r.retirado), Math.round(r.saldo * 100) / 100, Math.round(r.pendienteEntrega), r.acopio.formaPago === "ANTICIPO" ? "Anticipo" : "Cuenta corriente", Math.round(r.pagadoPct * 100), r.estado]),
      ),
    );

  const check = (label: string, v: boolean, set: (b: boolean) => void) => (
    <label className="flex h-8 items-center gap-2 whitespace-nowrap rounded-control border border-border px-2.5 text-[12px] text-muted">
      <Checkbox checked={v} onCheckedChange={(x) => set(!!x)} aria-label={label} /> {label}
    </label>
  );

  return (
    <>
      <PageHeader
        titulo="Acopios de clientes"
        descripcion="Acopios por monto con precios congelados: plata del cliente que todavía no retiró."
        acciones={
          <>
            <Button variant="secondary" onClick={exportar}><Download /> Exportar</Button>
            <Button variant="secondary" onClick={() => router.push("/acopios/desacopio")}><FileSearch /> Estado de desacopio</Button>
            {puedeCrear && <Button onClick={() => router.push("/acopios/nuevo")}><Plus /> Nuevo acopio</Button>}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Acopios vigentes" valor={String(vig.length)} icono={Boxes} />
        <KpiCard label="Saldo disponible total" valor={formatMoney(vig.reduce((a, r) => a + r.saldo, 0), { compact: true })} acento subtexto="depositado sin retirar" />
        <KpiCard label="Pendiente de entrega" valor={formatMoney(base.reduce((a, r) => a + r.pendienteEntrega, 0), { compact: true })} subtexto="retirado con NP, sin remitir" />
        <KpiCard label="Cuenta corriente impagos" valor={String(base.filter(impago).length)} subtexto={formatMoney(base.filter((r) => r.acopio.formaPago === "CUENTA_CORRIENTE").reduce((a, r) => a + Math.max(0, (r.acopio.importeConIIBB || r.acopio.importe) - r.pagado), 0), { compact: true }) + " sin cobrar"} onClick={() => setImpagos(true)} />
        <KpiCard label="Por vencer en 30 días" valor={String(vig.filter((r) => r.diasParaVencer <= 30).length)} subtexto={`${base.filter((r) => r.estado === "VENCIDO").length} vencidos con saldo`} onClick={() => setPorVencer(true)} />
      </div>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(r) => r.acopio.id}
        onRowClick={(r) => router.push(`/acopios/${r.acopio.id}`)}
        searchText={(r) => `${r.acopio.numero} ${cli(r.acopio.clienteId)?.razonSocial} ${cli(r.acopio.clienteId)?.nombreFantasia ?? ""} ${obras(r)}`}
        searchPlaceholder="Buscar por número, cliente u obra…"
        initialSort={{ key: "v", dir: "asc" }}
        showFooter
        empty={db.acopios.length === 0 ? <VacioGuiado pagina="acopios" icono={Boxes} puedeAccion={puedeCrear} /> : { icono: Boxes, titulo: "No hay acopios para el filtro" }}
        filters={
          <>
            <div className="w-[140px]"><Select size="sm" aria-label="Estado" value={estado} onValueChange={setEstado} options={[{ value: "", label: "Todos los estados" }, { value: "VIGENTE", label: "Vigentes" }, { value: "VENCIDO", label: "Vencidos" }, { value: "AGOTADO", label: "Agotados" }, { value: "CANCELADO", label: "Cancelados" }]} /></div>
            <div className="w-[130px]"><Select size="sm" aria-label="Circuito" value={circuito} onValueChange={setCircuito} options={[{ value: "", label: "AC1 y AC2" }, { value: "1", label: "AC1 · Fiscal" }, ...(veC2 ? [{ value: "2", label: "AC2 · Interno" }] : [])]} /></div>
            <div className="w-[200px]"><Combobox aria-label="Cliente" value={cliente} onChange={(v) => setCliente(v === cliente ? "" : v)} placeholder="Todos los clientes" className="h-8" opciones={[...new Set(base.map((r) => r.acopio.clienteId))].map((id) => ({ value: id, label: cli(id)?.nombreFantasia ?? cli(id)?.razonSocial ?? id }))} /></div>
            <div className="w-[160px]"><Select size="sm" aria-label="Forma de pago" value={forma} onValueChange={setForma} options={[{ value: "", label: "Toda forma de pago" }, { value: "ANTICIPO", label: "Anticipo" }, { value: "CUENTA_CORRIENTE", label: "Cuenta corriente" }]} /></div>
            {check("Por vencer", porVencer, setPorVencer)}
            {check("Con saldo", conSaldo, setConSaldo)}
            {check("Impagos", impagos, setImpagos)}
          </>
        }
      />
    </>
  );
}
