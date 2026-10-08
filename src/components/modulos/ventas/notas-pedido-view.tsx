"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, ShoppingCart } from "lucide-react";
import { useDb, usePendientes, usePuede, useSaldosClientes, useSucursalActiva, useVeCircuito2 } from "@/store/selectors";
import type { NotaPedido } from "@/domain/types";
import { FORMA_PAGO_LABEL } from "@/domain/estados";
import { porcentajeEntregado } from "@/domain/ventas";
import { pendienteLinea } from "@/domain/acopios";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { KpiCard } from "@/components/shared/kpi-card";
import { DateRangePicker } from "@/components/shared/filter-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatMoney } from "@/lib/format";
import { PRESETS_LISTADO, periodoDesdePreset, type Periodo } from "@/lib/periodos";
import { aCSV, descargarArchivo } from "@/lib/utils";

export function NotasPedidoView() {
  const db = useDb();
  const router = useRouter();
  const sucursal = useSucursalActiva();
  const veC2 = useVeCircuito2();
  const puedeCrear = usePuede("ventas.editar");
  const pendientes = usePendientes();
  const saldos = useSaldosClientes();
  const [periodo, setPeriodo] = React.useState<Periodo>(() => periodoDesdePreset("90D"));
  const [origen, setOrigen] = React.useState("");
  const [forma, setForma] = React.useState("");
  const [circuito, setCircuito] = React.useState("");
  const [estado, setEstado] = React.useState("");
  const [vendedor, setVendedor] = React.useState("");

  const cli = React.useMemo(() => new Map(db.clientes.map((c) => [c.id, c])), [db.clientes]);
  const pendPorNP = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const l of pendientes) m.set(l.notaPedidoId, (m.get(l.notaPedidoId) ?? 0) + l.pendiente * l.precio);
    return m;
  }, [pendientes]);
  const filas = db.notasPedido.filter(
    (n) =>
      (veC2 || n.circuito !== 2) &&
      (!sucursal || n.sucursalId === sucursal) &&
      (n.estado === "BORRADOR" || (n.fecha >= periodo.desde && n.fecha <= periodo.hasta)) &&
      (!origen || n.origen === origen) &&
      (!forma || n.formaPago === forma) &&
      (!circuito || String(n.circuito) === circuito) &&
      (!estado || n.estado === estado) &&
      (!vendedor || n.vendedorId === vendedor),
  );
  const mes = new Date();
  mes.setDate(1);
  mes.setHours(0, 0, 0, 0);
  const delMes = db.notasPedido.filter((n) => n.estado !== "BORRADOR" && n.estado !== "ANULADA" && Date.parse(n.fecha) >= mes.getTime() && (!sucursal || n.sucursalId === sucursal) && (veC2 || n.circuito !== 2));
  const tMes = delMes.reduce((a, n) => a + n.total, 0);
  const tAcopio = delMes.filter((n) => n.origen === "ACOPIO").reduce((a, n) => a + n.total, 0);
  const tPend = [...pendPorNP.entries()].filter(([id]) => filas.some((f) => f.id === id)).reduce((a, [, v]) => a + v, 0);
  const porCobrar = [...saldos.values()].reduce((a, s) => a + Math.max(0, s.saldo), 0);
  const obras = (n: NotaPedido) => [...new Set(n.items.map((i) => db.obras.find((o) => o.id === i.obraId)?.nombre).filter(Boolean))].join(", ");
  const factura = (n: NotaPedido) => db.comprobantes.find((c) => n.comprobanteIds.includes(c.id) && c.tipo === "FACTURA");

  const columnas: Column<NotaPedido>[] = [
    { key: "n", header: "Número", sortable: true, sortValue: (n) => n.numero || "~", footer: `${filas.length} NP`, cell: (n) => <span className="whitespace-nowrap font-mono text-[12px]">{n.numero || "Borrador"}</span> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (n) => n.fecha, cell: (n) => <span className="whitespace-nowrap text-muted">{formatDate(n.fecha)}</span> },
    { key: "c", header: "Cliente", sortable: true, sortValue: (n) => cli.get(n.clienteId)?.razonSocial ?? "", cell: (n) => <span className="block min-w-[150px]">{cli.get(n.clienteId)?.nombreFantasia ?? cli.get(n.clienteId)?.razonSocial}</span> },
    { key: "o", header: "Origen", cell: (n) => (n.origen === "ACOPIO" ? <Badge variant="accent" className="whitespace-nowrap">Acopio {db.acopios.find((a) => a.id === n.acopioId)?.numero.replace(/^AC\d /, "")}</Badge> : <Badge>Nueva</Badge>) },
    { key: "ob", header: "Obra", cell: (n) => <span className="block max-w-[180px] truncate text-[12px] text-muted" title={obras(n)}>{obras(n) || "—"}</span>, hideOnMobile: true },
    { key: "fp", header: "Forma de pago", cell: (n) => <span className="whitespace-nowrap text-muted">{FORMA_PAGO_LABEL[n.formaPago]}</span>, hideOnMobile: true },
    { key: "ci", header: "Circuito", cell: (n) => <CircuitoBadge circuito={n.circuito} corto /> },
    { key: "t", header: "Total", align: "right", sortable: true, sortValue: (n) => n.total, footer: <span className="tnum">{formatMoney(filas.reduce((a, n) => a + n.total, 0), { decimals: false })}</span>, cell: (n) => <span className="tnum">{formatMoney(n.total, { decimals: false })}</span> },
    { key: "e", header: "Entregado", cell: (n) => <div className="flex min-w-[96px] items-center gap-2"><Progress value={porcentajeEntregado(n)} className="w-14" tone={porcentajeEntregado(n) >= 1 ? "success" : "ink"} /><span className="text-[11px] text-muted tnum">{Math.round(porcentajeEntregado(n) * 100)} %</span></div> },
    { key: "p", header: "Pend. entrega", align: "right", sortable: true, sortValue: (n) => pendPorNP.get(n.id) ?? 0, cell: (n) => (n.items.some((i) => pendienteLinea(i) > 0) && n.estado !== "BORRADOR" ? <Badge variant="warning">{formatMoney(pendPorNP.get(n.id) ?? 0, { compact: true })}</Badge> : <span className="text-disabled">—</span>) },
    { key: "s", header: "Estado", cell: (n) => <StatusBadge tipo="NP" estado={n.estado} /> },
    { key: "r", header: "Remitos", align: "right", cell: (n) => <span className="text-muted tnum">{n.remitoIds.length || "—"}</span>, hideOnMobile: true },
    { key: "cp", header: "Comprobante", cell: (n) => <span className="whitespace-nowrap font-mono text-[11px] text-muted">{factura(n)?.numero ?? (n.origen === "ACOPIO" ? "En acopio" : "—")}</span>, hideOnMobile: true },
  ];

  const exportar = () =>
    descargarArchivo(
      "notas-de-pedido.csv",
      aCSV(
        ["Número", "Fecha", "Cliente", "Origen", "Acopio", "Obra", "Forma de pago", "Circuito", "Total", "Entregado %", "Pendiente $", "Estado", "Comprobante"],
        filas.map((n) => [n.numero, formatDate(n.fecha), cli.get(n.clienteId)?.razonSocial, n.origen === "ACOPIO" ? "Acopio" : "Nueva", db.acopios.find((a) => a.id === n.acopioId)?.numero, obras(n), FORMA_PAGO_LABEL[n.formaPago], `AC${n.circuito}`, Math.round(n.total), Math.round(porcentajeEntregado(n) * 100), Math.round(pendPorNP.get(n.id) ?? 0), n.estado, factura(n)?.numero]),
      ),
    );

  return (
    <>
      <PageHeader
        titulo="Notas de pedido"
        descripcion="Ventas nuevas y retiros de acopio, con su entrega, comprobantes y remitos."
        acciones={
          <>
            <Button variant="secondary" onClick={exportar}><Download /> Exportar</Button>
            {puedeCrear && <Button onClick={() => router.push("/ventas/notas-pedido/nueva")}><Plus /> Nueva nota de pedido</Button>}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Ventas del mes" valor={formatMoney(tMes, { compact: true })} acento subtexto={`${delMes.length} notas de pedido`} />
        <KpiCard label="Retiros de acopio vs nuevas" valor={formatMoney(tAcopio, { compact: true })} subtexto={`nuevas ${formatMoney(tMes - tAcopio, { compact: true })}`} />
        <KpiCard label="Pendiente de entrega" valor={formatMoney(tPend, { compact: true })} onClick={() => router.push("/pendientes-entrega")} />
        <KpiCard label="Por cobrar" valor={formatMoney(porCobrar, { compact: true })} onClick={() => router.push("/cuentas-corrientes/clientes")} />
      </div>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(n) => n.id}
        onRowClick={(n) => router.push(`/ventas/notas-pedido/${n.id}`)}
        searchText={(n) => `${n.numero} ${cli.get(n.clienteId)?.razonSocial} ${cli.get(n.clienteId)?.nombreFantasia ?? ""} ${obras(n)} ${db.acopios.find((a) => a.id === n.acopioId)?.numero ?? ""}`}
        searchPlaceholder="Buscar por número, cliente, obra o acopio…"
        initialSort={{ key: "f", dir: "desc" }}
        showFooter
        empty={db.notasPedido.length === 0 ? <VacioGuiado pagina="notasPedido" icono={ShoppingCart} puedeAccion={puedeCrear} /> : { icono: ShoppingCart, titulo: "No hay notas de pedido para el filtro" }}
        filters={
          <>
            <DateRangePicker value={periodo} onChange={setPeriodo} presets={PRESETS_LISTADO} />
            <div className="w-[130px]"><Select size="sm" aria-label="Origen" value={origen} onValueChange={setOrigen} options={[{ value: "", label: "Todo origen" }, { value: "NUEVA", label: "Nueva" }, { value: "ACOPIO", label: "Acopio" }]} /></div>
            <div className="w-[160px]"><Select size="sm" aria-label="Forma de pago" value={forma} onValueChange={setForma} options={[{ value: "", label: "Toda forma de pago" }, ...Object.entries({ CONTADO: "Contado", CUENTA_CORRIENTE: "Cuenta corriente", ACOPIO: "Acopio" }).map(([value, label]) => ({ value, label }))]} /></div>
            <div className="w-[130px]"><Select size="sm" aria-label="Circuito" value={circuito} onValueChange={setCircuito} options={[{ value: "", label: "AC1 y AC2" }, { value: "1", label: "AC1 · Fiscal" }, ...(veC2 ? [{ value: "2", label: "AC2 · Interno" }] : [])]} /></div>
            <div className="w-[150px]"><Select size="sm" aria-label="Estado" value={estado} onValueChange={setEstado} options={[{ value: "", label: "Todos los estados" }, { value: "BORRADOR", label: "Borrador" }, { value: "PENDIENTE", label: "Pendiente" }, { value: "ENTREGADA_PARCIAL", label: "Entregada parcial" }, { value: "ENTREGADA", label: "Entregada" }, { value: "ANULADA", label: "Anulada" }]} /></div>
            <div className="w-[150px]"><Select size="sm" aria-label="Vendedor" value={vendedor} onValueChange={setVendedor} options={[{ value: "", label: "Todos los vendedores" }, ...db.usuarios.filter((u) => u.rol === "VENTAS").map((u) => ({ value: u.id, label: u.nombre }))]} /></div>
          </>
        }
      />
    </>
  );
}
