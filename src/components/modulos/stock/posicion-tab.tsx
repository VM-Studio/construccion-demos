"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, PackageSearch, Truck } from "lucide-react";
import { useDb, usePendientes, usePosiciones, usePuede, type PosicionProducto } from "@/store/selectors";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMoney, formatNumber, formatQty, unidadCorta } from "@/lib/format";
import { aCSV, cn, descargarArchivo } from "@/lib/utils";

const n = (v: number) => formatNumber(v, 2);

/** Celda de comprometido con popover de trazabilidad (qué pedidos/acopios lo componen). */
function CeldaComprometido({ pos, depositoId }: { pos: PosicionProducto; depositoId: string }) {
  const db = useDb();
  const pendientes = usePendientes();
  const q = pos.porDeposito[depositoId]?.comprometido ?? 0;
  if (!q) return <span className="text-disabled">0</span>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button onClick={(e) => e.stopPropagation()} className="tnum text-ink underline decoration-dotted underline-offset-4 hover:decoration-solid">
          {n(q)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-border px-3 py-2 text-[12px] font-semibold">
          Pendiente de entrega en {db.depositos.find((d) => d.id === depositoId)?.nombre} · {formatQty(q, pos.producto.unidad)}
        </div>
        <ul className="max-h-[260px] divide-y divide-border overflow-y-auto">
          {pendientes
            .filter((l) => l.productoId === pos.producto.id && l.depositoId === depositoId)
            .map((l) => (
              <li key={l.itemId}>
                <Link href={`/ventas/notas-pedido/${l.notaPedidoId}`} className="flex items-center gap-3 px-3 py-2 text-[12px] hover:bg-subtle">
                  <span className="w-[120px] shrink-0 font-mono">{db.notasPedido.find((x) => x.id === l.notaPedidoId)?.numero}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{db.clientes.find((c) => c.id === l.clienteId)?.razonSocial}</span>
                  <span className="font-medium tnum">{n(l.pendiente)}</span>
                </Link>
              </li>
            ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function PosicionTab({ filtroInicial }: { filtroInicial?: string | null }) {
  const db = useDb();
  const router = useRouter();
  const posiciones = usePosiciones();
  const verCostos = usePuede("margenes.ver");
  const [rubro, setRubro] = React.useState("");
  const [deposito, setDeposito] = React.useState("");
  const [soloBajo, setSoloBajo] = React.useState(filtroInicial === "bajo-minimo");
  const [soloComp, setSoloComp] = React.useState(false);
  React.useEffect(() => setSoloBajo(filtroInicial === "bajo-minimo"), [filtroInicial]);

  const todas = React.useMemo(() => [...posiciones.values()].filter((p) => p.producto.activo), [posiciones]);
  const filas = todas.filter(
    (p) => (!rubro || p.producto.rubroId === rubro) && (!soloBajo || p.estado !== "OK") && (!soloComp || p.comprometido > 0) && (!deposito || (p.porDeposito[deposito]?.fisico ?? 0) !== 0 || (p.porDeposito[deposito]?.comprometido ?? 0) > 0),
  );
  const deps = deposito ? db.depositos.filter((d) => d.id === deposito) : db.depositos;

  const valorTotal = todas.reduce((a, p) => a + Math.max(0, p.fisico) * p.producto.costoPromedio, 0);
  const compValor = todas.reduce((a, p) => a + p.comprometido * p.producto.costoPromedio, 0);
  const bajo = todas.filter((p) => p.estado !== "OK").length;
  const enTransferencia = db.transferencias.filter((t) => t.estado === "EN_TRANSITO");

  const columnas: Column<PosicionProducto>[] = [
    {
      key: "producto",
      header: "Producto",
      sortable: true,
      sortValue: (p) => p.producto.codigo,
      cell: (p) => (
        <div className="min-w-[200px]">
          <span className="mr-2 whitespace-nowrap font-mono text-[11px] text-muted">{p.producto.codigo}</span>
          {p.producto.nombre}
          <span className="ml-1 text-[11px] text-muted">({unidadCorta(p.producto.unidad)})</span>
        </div>
      ),
    },
    ...deps.flatMap((d) => {
      const corto = d.nombre.replace("Depósito ", "");
      return [
        { key: `${d.id}-f`, header: `${corto} · físico`, align: "right" as const, sortable: true, sortValue: (p: PosicionProducto) => p.porDeposito[d.id]?.fisico ?? 0, cell: (p: PosicionProducto) => <span className="tnum">{n(p.porDeposito[d.id]?.fisico ?? 0)}</span> },
        { key: `${d.id}-c`, header: "compr.", align: "right" as const, hideOnMobile: true, cell: (p: PosicionProducto) => <CeldaComprometido pos={p} depositoId={d.id} /> },
        {
          key: `${d.id}-d`,
          header: "disp.",
          align: "right" as const,
          sortable: true,
          sortValue: (p: PosicionProducto) => p.porDeposito[d.id]?.disponible ?? 0,
          cell: (p: PosicionProducto) => {
            const v = p.porDeposito[d.id]?.disponible ?? 0;
            return <span className={cn("font-medium tnum", v < 0 && "text-danger")}>{n(v)}</span>;
          },
        },
      ];
    }),
    ...(!deposito ? [{ key: "total", header: "Total disp.", align: "right" as const, sortable: true, sortValue: (p: PosicionProducto) => p.disponible, cell: (p: PosicionProducto) => <span className={cn("font-semibold tnum", p.disponible < 0 && "text-danger")}>{n(p.disponible)}</span> }] : []),
    { key: "transito", header: "En tránsito", align: "right", hideOnMobile: true, cell: (p) => (p.enTransito || p.enTransferencia ? <span className="tnum text-info">{n(p.enTransito + p.enTransferencia)}</span> : <span className="text-disabled">—</span>) },
    { key: "minimo", header: "Mínimo", align: "right", hideOnMobile: true, cell: (p) => <span className="tnum text-muted">{n(p.producto.stockMinimo)}</span> },
    { key: "estado", header: "Estado", sortable: true, sortValue: (p) => p.estado, cell: (p) => <StatusBadge tipo="STOCK" estado={p.estado} /> },
    ...(verCostos
      ? [{ key: "valor", header: "Valorizado", align: "right" as const, sortable: true, sortValue: (p: PosicionProducto) => p.valorizado, footer: <span className="tnum">{formatMoney(filas.reduce((a, p) => a + Math.max(0, p.fisico) * p.producto.costoPromedio, 0), { decimals: false })}</span>, cell: (p: PosicionProducto) => <span className="tnum">{formatMoney(Math.max(0, p.fisico) * p.producto.costoPromedio, { decimals: false })}</span> }]
      : []),
  ];

  const exportar = () => {
    const head = ["Código", "Producto", "Unidad", ...db.depositos.flatMap((d) => [`${d.nombre} físico`, `${d.nombre} comprometido`, `${d.nombre} disponible`]), "En tránsito", "Mínimo", "Estado", ...(verCostos ? ["Valorizado"] : [])];
    const rows = filas.map((p) => [p.producto.codigo, p.producto.nombre, p.producto.unidad, ...db.depositos.flatMap((d) => [p.porDeposito[d.id].fisico, p.porDeposito[d.id].comprometido, p.porDeposito[d.id].disponible]), p.enTransito, p.producto.stockMinimo, p.estado, ...(verCostos ? [Math.round(p.valorizado)] : [])]);
    descargarArchivo(`posicion-stock-${new Date().toISOString().slice(0, 10)}.csv`, aCSV(head, rows));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {verCostos && <KpiCard label="Valor total de inventario" valor={formatMoney(valorTotal, { compact: true })} acento subtexto="a costo promedio" />}
        <KpiCard label="SKUs activos" valor={String(todas.length)} subtexto={`${todas.filter((p) => p.fisico > 0).length} con stock`} />
        <KpiCard label="Bajo mínimo" valor={String(bajo)} subtexto={bajo ? <button className="font-medium text-danger underline-offset-2 hover:underline" onClick={() => setSoloBajo(true)}>Ver productos</button> : "todo en orden"} />
        {verCostos ? <KpiCard label="Comprometido total" valor={formatMoney(compValor, { compact: true })} subtexto="pedidos sin despachar + acopios" /> : <KpiCard label="Con comprometido" valor={String(todas.filter((p) => p.comprometido > 0).length)} subtexto="productos" />}
      </div>

      {enTransferencia.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-card border border-warning/30 bg-warning-soft px-4 py-2.5 text-[13px]">
          <span className="flex items-center gap-2 font-medium text-warning">
            <Truck className="size-4" /> En tránsito entre depósitos
          </span>
          {enTransferencia.map((t) => (
            <button key={t.id} onClick={() => router.push(`/stock/transferencias?id=${t.id}`)} className="text-ink underline-offset-2 hover:underline">
              {t.numero}: {t.items.map((i) => `${formatQty(i.cantidad, db.productos.find((p) => p.id === i.productoId)?.unidad ?? "UN")} ${db.productos.find((p) => p.id === i.productoId)?.nombre}`).join(", ")}
            </button>
          ))}
        </div>
      )}

      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(p) => p.producto.id}
        searchText={(p) => `${p.producto.codigo} ${p.producto.nombre} ${p.producto.marca ?? ""}`}
        searchPlaceholder="Buscar producto"
        onRowClick={(p) => router.push(`/productos?id=${p.producto.id}`)}
        initialSort={{ key: "producto", dir: "asc" }}
        showFooter={verCostos}
        rowClassName={(p) => (p.estado !== "OK" ? "bg-danger-soft/40" : undefined)}
        empty={{ icono: PackageSearch, titulo: "No hay productos con stock" }}
        filters={
          <>
            <Select size="sm" className="w-[170px]" aria-label="Rubro" value={rubro} onValueChange={setRubro} options={[{ value: "", label: "Todos los rubros" }, ...db.rubros.map((r) => ({ value: r.id, label: r.nombre }))]} />
            <Select size="sm" className="w-[170px]" aria-label="Depósito" value={deposito} onValueChange={setDeposito} options={[{ value: "", label: "Todos los depósitos" }, ...db.depositos.map((d) => ({ value: d.id, label: d.nombre }))]} />
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <Checkbox checked={soloBajo} onCheckedChange={(v) => setSoloBajo(!!v)} /> Solo bajo mínimo
            </label>
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <Checkbox checked={soloComp} onCheckedChange={(v) => setSoloComp(!!v)} /> Solo con comprometido
            </label>
          </>
        }
        actions={
          <Button size="sm" variant="ghost" onClick={exportar}>
            <Download /> Exportar CSV
          </Button>
        }
      />
    </div>
  );
}
