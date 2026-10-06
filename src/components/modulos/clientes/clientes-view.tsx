"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus, Users } from "lucide-react";
import { useDb, usePendientes, usePuede, useSaldosClientes, useAcopiosResumen, useSucursalActiva, useVeCircuito2 } from "@/store/selectors";
import { TIPO_CLIENTE_LABEL, CONDICION_PAGO_LABEL, opciones } from "@/domain/estados";
import type { Cliente } from "@/domain/types";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { aCSV, cn, descargarArchivo } from "@/lib/utils";
import { NuevoClienteDialog } from "@/components/modulos/ventas/cliente-form";

export interface ResumenCliente {
  c: Cliente;
  saldo: number;
  vencido: number;
  acopios: number;
  saldoAcopios: number;
  pendiente: number;
}

/** Resumen comercial por cliente (cuenta corriente, acopios y pendiente de entrega). */
export function useResumenClientes(): Map<string, ResumenCliente> {
  const db = useDb();
  const saldos = useSaldosClientes();
  const acopios = useAcopiosResumen();
  const pendientes = usePendientes();
  const veC2 = useVeCircuito2();
  return React.useMemo(() => {
    const out = new Map<string, ResumenCliente>();
    for (const c of db.clientes) out.set(c.id, { c, saldo: saldos.get(c.id)?.saldo ?? 0, vencido: saldos.get(c.id)?.vencido ?? 0, acopios: 0, saldoAcopios: 0, pendiente: 0 });
    for (const a of acopios) {
      if (a.estado !== "VIGENTE" || (!veC2 && a.acopio.circuito === 2)) continue;
      const r = out.get(a.acopio.clienteId);
      if (r) {
        r.acopios++;
        r.saldoAcopios += a.saldo;
      }
    }
    for (const l of pendientes) {
      const r = out.get(l.clienteId);
      if (r) r.pendiente += l.pendiente * l.precio;
    }
    return out;
  }, [db.clientes, saldos, acopios, pendientes, veC2]);
}

export function ClientesView() {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const sucursal = useSucursalActiva();
  const puedeCrear = usePuede("clientes.editar");
  const resumen = useResumenClientes();
  const [nuevo, setNuevo] = React.useState(params.get("nuevo") === "1");
  const [tipo, setTipo] = React.useState("");
  const [circuito, setCircuito] = React.useState("");
  const [vendedor, setVendedor] = React.useState("");
  const [conAcopio, setConAcopio] = React.useState(false);
  const [conPendiente, setConPendiente] = React.useState(false);
  const [conVencido, setConVencido] = React.useState(params.get("filtro") === "vencidos");
  const [excedidos] = React.useState(params.get("filtro") === "excedidos");

  const filas = [...resumen.values()].filter(
    (r) =>
      (!sucursal || r.c.sucursalPreferidaId === sucursal) &&
      (!tipo || r.c.tipo === tipo) &&
      (!circuito || String(r.c.circuitoHabitual) === circuito) &&
      (!vendedor || r.c.vendedorId === vendedor) &&
      (!conAcopio || r.acopios > 0) &&
      (!conPendiente || r.pendiente > 0.5) &&
      (!conVencido || r.vencido > 0.5) &&
      (!excedidos || (r.c.limiteCredito > 0 && r.saldo > r.c.limiteCredito)),
  );
  const t = filas.reduce((a, f) => ({ s: a.s + f.saldo, v: a.v + f.vencido, ac: a.ac + f.saldoAcopios, p: a.p + f.pendiente }), { s: 0, v: 0, ac: 0, p: 0 });
  const usr = (id?: string) => db.usuarios.find((u) => u.id === id)?.nombre;
  const lista = (id: string) => db.listasPrecios.find((l) => l.id === id)?.nombre;

  const columnas: Column<ResumenCliente>[] = [
    { key: "cod", header: "Código", sortable: true, sortValue: (f) => f.c.codigo, cell: (f) => <span className="font-mono text-[12px]">{f.c.codigo}</span> },
    { key: "rs", header: "Cliente", footer: `${filas.length} clientes`, sortable: true, sortValue: (f) => f.c.razonSocial, cell: (f) => <span className="block min-w-[180px]"><span className="block font-medium text-ink">{f.c.nombreFantasia ?? f.c.razonSocial}</span>{f.c.nombreFantasia && <span className="block text-[11px] text-muted">{f.c.razonSocial}</span>}</span> },
    { key: "t", header: "Tipo", cell: (f) => <span className="text-muted">{TIPO_CLIENTE_LABEL[f.c.tipo]}</span>, hideOnMobile: true },
    { key: "cuit", header: "CUIT", cell: (f) => <span className="whitespace-nowrap font-mono text-[12px] text-muted">{f.c.cuit || "—"}</span>, hideOnMobile: true },
    { key: "ci", header: "Circuito", cell: (f) => <CircuitoBadge circuito={f.c.circuitoHabitual} corto /> },
    { key: "loc", header: "Localidad", cell: (f) => <span className="text-muted">{f.c.localidad}</span>, hideOnMobile: true },
    { key: "lp", header: "Lista", cell: (f) => <span className="text-muted">{lista(f.c.listaPreciosId)}</span>, hideOnMobile: true },
    { key: "cp", header: "Condición", cell: (f) => <span className="whitespace-nowrap text-muted">{CONDICION_PAGO_LABEL[f.c.condicionPago]}</span>, hideOnMobile: true },
    { key: "sa", header: "Saldo cta. cte.", align: "right", sortable: true, sortValue: (f) => f.saldo, footer: <span className="tnum">{formatMoney(t.s, { decimals: false })}</span>, cell: (f) => <span className={cn("tnum", f.vencido > 0.5 && "font-medium text-danger")} title={f.vencido > 0.5 ? `${formatMoney(f.vencido)} vencido` : undefined}>{formatMoney(f.saldo, { decimals: false })}</span> },
    { key: "ac", header: "Acopios vigentes", align: "right", sortable: true, sortValue: (f) => f.saldoAcopios, footer: <span className="tnum">{formatMoney(t.ac, { decimals: false })}</span>, cell: (f) => (f.acopios ? <span className="whitespace-nowrap tnum">{f.acopios} · {formatMoney(f.saldoAcopios, { decimals: false })}</span> : <span className="text-disabled">—</span>) },
    { key: "pe", header: "Pendiente entrega", align: "right", sortable: true, sortValue: (f) => f.pendiente, footer: <span className="tnum">{formatMoney(t.p, { decimals: false })}</span>, cell: (f) => (f.pendiente > 0.5 ? <span className="tnum">{formatMoney(f.pendiente, { decimals: false })}</span> : <span className="text-disabled">—</span>) },
    { key: "ve", header: "Vendedor", cell: (f) => <span className="whitespace-nowrap text-muted">{usr(f.c.vendedorId) ?? "—"}</span>, hideOnMobile: true },
    { key: "act", header: "Activo", cell: (f) => (f.c.activo ? <Badge variant="success">Activo</Badge> : <Badge>Inactivo</Badge>), hideOnMobile: true },
  ];

  const exportar = () =>
    descargarArchivo(
      "clientes.csv",
      aCSV(
        ["Código", "Razón social", "Fantasía", "Tipo", "CUIT", "Circuito", "Localidad", "Lista", "Condición", "Saldo cta. cte.", "Vencido", "Acopios vigentes", "Saldo acopios", "Pendiente de entrega", "Vendedor"],
        filas.map((f) => [f.c.codigo, f.c.razonSocial, f.c.nombreFantasia, TIPO_CLIENTE_LABEL[f.c.tipo], f.c.cuit, `AC${f.c.circuitoHabitual}`, f.c.localidad, lista(f.c.listaPreciosId), CONDICION_PAGO_LABEL[f.c.condicionPago], Math.round(f.saldo), Math.round(f.vencido), f.acopios, Math.round(f.saldoAcopios), Math.round(f.pendiente), usr(f.c.vendedorId)]),
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
        titulo="Clientes"
        descripcion="Centro de operación comercial: desde el cliente se acopia, se vende, se cobra y se entrega."
        acciones={
          <>
            <Button variant="secondary" onClick={exportar}><Download /> Exportar</Button>
            {puedeCrear && <Button onClick={() => setNuevo(true)}><Plus /> Nuevo cliente</Button>}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Saldo en cuentas corrientes" valor={formatMoney(t.s, { compact: true })} subtexto={t.v > 0 ? <span className="text-danger">{formatMoney(t.v, { compact: true })} vencido</span> : "sin deuda vencida"} />
        <KpiCard label="Saldo disponible en acopios" valor={formatMoney(t.ac, { compact: true })} acento />
        <KpiCard label="Pendiente de entrega" valor={formatMoney(t.p, { compact: true })} />
        <KpiCard label="Clientes" valor={String(filas.length)} subtexto={`${filas.filter((f) => f.acopios).length} con acopio vigente`} />
      </div>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(f) => f.c.id}
        onRowClick={(f) => router.push(`/clientes/${f.c.id}`)}
        searchText={(f) => `${f.c.codigo} ${f.c.razonSocial} ${f.c.nombreFantasia ?? ""} ${f.c.cuit} ${f.c.localidad}`}
        searchPlaceholder="Buscar por código, nombre, CUIT o localidad…"
        initialSort={{ key: "rs", dir: "asc" }}
        showFooter
        empty={{ icono: Users, titulo: "No hay clientes para el filtro" }}
        filters={
          <>
            <div className="w-[150px]"><Select size="sm" aria-label="Tipo" value={tipo} onValueChange={setTipo} options={[{ value: "", label: "Todos los tipos" }, ...opciones(TIPO_CLIENTE_LABEL)]} /></div>
            <div className="w-[150px]"><Select size="sm" aria-label="Circuito" value={circuito} onValueChange={setCircuito} options={[{ value: "", label: "Ambos circuitos" }, { value: "1", label: "AC1 · Fiscal" }, { value: "2", label: "AC2 · Interno" }]} /></div>
            <div className="w-[160px]"><Select size="sm" aria-label="Vendedor" value={vendedor} onValueChange={setVendedor} options={[{ value: "", label: "Todos los vendedores" }, ...db.usuarios.filter((u) => u.rol === "VENTAS").map((u) => ({ value: u.id, label: u.nombre }))]} /></div>
            {check("Con acopio vigente", conAcopio, setConAcopio)}
            {check("Con pendiente de entrega", conPendiente, setConPendiente)}
            {check("Con deuda vencida", conVencido, setConVencido)}
          </>
        }
      />
      <NuevoClienteDialog open={nuevo} onOpenChange={setNuevo} onCreado={(id) => router.push(`/clientes/${id}`)} />
    </>
  );
}
