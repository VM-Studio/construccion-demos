"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, PackageSearch, ShoppingCart, Truck } from "lucide-react";
import { useDb, useDepositoActivo, usePendientes, usePosiciones, usePuede, useUnidadNegocio, posicionEn, type PosicionProducto } from "@/store/selectors";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { formatDate, formatMoney, formatNumber, formatQty, unidadCorta } from "@/lib/format";
import { aCSV, cn, descargarArchivo } from "@/lib/utils";
import { PendientesTabla } from "@/components/modulos/ventas/pendientes-tabla";

const n = (v: number) => formatNumber(v, 2);

/** Sheet "Pendiente de entrega · producto · depósito": a quién se le debe y qué despacho tiene. */
export function PendienteProductoSheet({ productoId, depositoId, onClose }: { productoId: string | null; depositoId: string | null; onClose: () => void }) {
  const db = useDb();
  const pendientes = usePendientes();
  const p = db.productos.find((x) => x.id === productoId);
  const lineas = pendientes.filter((l) => l.productoId === productoId && (!depositoId || l.depositoId === depositoId));
  return (
    <Sheet open={!!productoId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" width={960} title={`Pendiente de entrega · ${p?.nombre ?? ""} · ${depositoId ? db.depositos.find((d) => d.id === depositoId)?.nombre : "todos los depósitos"}`}>
        <div className="p-4">
          <p className="mb-3 text-[13px] text-muted">
            {formatQty(lineas.reduce((a, l) => a + l.pendiente, 0), p?.unidad ?? "UN")} vendidas o retiradas de acopio que todavía están en el depósito. Programá la entrega o abrí la nota de pedido.
          </p>
          <PendientesTabla lineas={lineas} mostrarCliente bare vacio="Sin pendientes para este artículo" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Sheet "En tránsito": OC confirmadas sin recibir y acopios con proveedores por retirar. */
function EnTransitoSheet({ productoId, depositoId, onClose }: { productoId: string | null; depositoId: string | null; onClose: () => void }) {
  const db = useDb();
  const p = db.productos.find((x) => x.id === productoId);
  const ocs = db.ordenesCompra.filter((o) => (o.estado === "CONFIRMADA" || o.estado === "RECIBIDA_PARCIAL") && (!depositoId || o.depositoDestinoId === depositoId)).flatMap((o) => o.items.filter((i) => i.productoId === productoId && i.cantidadPedida > i.cantidadRecibida).map((i) => ({ o, q: i.cantidadPedida - i.cantidadRecibida })));
  const acps = db.acopiosProveedor
    .filter((a) => a.modalidad === "CANTIDAD" && a.estado !== "CANCELADO" && (!depositoId || a.depositoDestinoId === depositoId))
    .flatMap((a) => (a.items ?? []).filter((i) => i.productoId === productoId).map((i) => {
      const pedido = db.ordenesCompra.filter((o) => o.acopioProveedorId === a.id && o.estado !== "BORRADOR" && o.estado !== "CANCELADA").flatMap((o) => o.items).filter((x) => x.productoId === productoId).reduce((s, x) => s + x.cantidadPedida, 0);
      return { a, q: i.cantidadPactada - pedido };
    }))
    .filter((x) => x.q > 0);
  return (
    <Sheet open={!!productoId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" width={640} title={`En tránsito · ${p?.nombre ?? ""}`}>
        <div className="space-y-4 p-4 text-[13px]">
          <div>
            <h3 className="mb-2 font-semibold">Órdenes de compra confirmadas</h3>
            {ocs.length ? (
              <ul className="divide-y divide-border rounded-card border border-border">
                {ocs.map(({ o, q }) => (
                  <li key={o.id}>
                    <Link href={`/compras/oc/${o.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-subtle">
                      <span className="font-mono text-[12px]">{o.numero}</span>
                      <span className="flex-1 text-muted">{db.proveedores.find((x) => x.id === o.proveedorId)?.razonSocial} · llega {formatDate(o.fechaEntregaEstimada)}{o.origen === "ACOPIO" ? " · de acopio" : ""}</span>
                      <span className="font-medium tnum">{formatQty(q, p?.unidad ?? "UN")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Ninguna.</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Acopios con proveedores por retirar</h3>
            {acps.length ? (
              <ul className="divide-y divide-border rounded-card border border-border">
                {acps.map(({ a, q }) => (
                  <li key={a.id}>
                    <Link href={`/proveedores/acopios/${a.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-subtle">
                      <span className="font-mono text-[12px]">{a.numero}</span>
                      <span className="flex-1 text-muted">{db.proveedores.find((x) => x.id === a.proveedorId)?.razonSocial} · sin pedir</span>
                      <span className="font-medium tnum">{formatQty(q, p?.unidad ?? "UN")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Ninguno.</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function PosicionTab({ filtroInicial }: { filtroInicial?: string | null }) {
  const db = useDb();
  const router = useRouter();
  const posiciones = usePosiciones();
  const depActivo = useDepositoActivo();
  const un = useUnidadNegocio();
  const verCostos = usePuede("margenes.ver");
  const puedeAjustar = usePuede("stock.ajustar");
  const puedeComprar = usePuede("compras.editar");
  const [rubro, setRubro] = React.useState("");
  const [deposito, setDeposito] = React.useState(depActivo ?? db.depositos[0]?.id ?? "");
  const [soloBajo, setSoloBajo] = React.useState(filtroInicial === "bajo-minimo");
  const [soloPend, setSoloPend] = React.useState(false);
  const [verPend, setVerPend] = React.useState<string | null>(null);
  const [verTrans, setVerTrans] = React.useState<string | null>(null);
  React.useEffect(() => setSoloBajo(filtroInicial === "bajo-minimo"), [filtroInicial]);
  const dep = deposito || null;

  const todas = React.useMemo(() => [...posiciones.values()].filter((p) => p.producto.activo && (!un || p.producto.unidadNegocioId === un)), [posiciones, un]);
  const pos = (p: PosicionProducto) => posicionEn(p, dep);
  const filas = todas.filter((p) => (!rubro || p.producto.rubroId === rubro) && (!soloBajo || p.estado !== "OK") && (!soloPend || pos(p).pendiente > 0));
  const valorTotal = todas.reduce((a, p) => a + Math.max(0, pos(p).fisico) * p.producto.costoPromedio, 0);
  const pendValor = todas.reduce((a, p) => a + pos(p).pendiente * p.producto.costoPromedio, 0);
  const negativos = todas.filter((p) => pos(p).disponible < 0).length;
  const bajo = todas.filter((p) => p.estado !== "OK").length;
  const enTransferencia = db.transferencias.filter((t) => t.estado === "EN_TRANSITO");

  const columnas: Column<PosicionProducto>[] = [
    {
      key: "producto",
      header: "Artículo",
      sortable: true,
      sortValue: (p) => p.producto.codigo,
      cell: (p) => (
        <div className="min-w-[220px]">
          <span className="mr-2 whitespace-nowrap font-mono text-[11px] text-muted">{p.producto.codigo}</span>
          {p.producto.nombre}
          <span className="ml-1 text-[11px] text-muted">({unidadCorta(p.producto.unidad)})</span>
        </div>
      ),
    },
    { key: "f", header: "Físico", align: "right", sortable: true, sortValue: (p) => pos(p).fisico, cell: (p) => <span className="tnum">{n(pos(p).fisico)}</span> },
    {
      key: "pe",
      header: "Pendiente de entrega",
      align: "right",
      sortable: true,
      sortValue: (p) => pos(p).pendiente,
      cell: (p) =>
        pos(p).pendiente ? (
          <button onClick={(e) => { e.stopPropagation(); setVerPend(p.producto.id); }} className="tnum text-ink underline decoration-dotted underline-offset-4 hover:decoration-solid">
            {n(pos(p).pendiente)}
          </button>
        ) : (
          <span className="text-disabled">0</span>
        ),
    },
    { key: "re", header: "Reservado", align: "right", cell: (p) => (pos(p).reservado ? <span className="tnum text-warning">{n(pos(p).reservado)}</span> : <span className="text-disabled">0</span>) },
    { key: "d", header: "Disponible", align: "right", sortable: true, sortValue: (p) => pos(p).disponible, cell: (p) => <span className={cn("font-semibold tnum", pos(p).disponible < 0 && "text-danger")}>{n(pos(p).disponible)}</span> },
    {
      key: "tr",
      header: "En tránsito",
      align: "right",
      cell: (p) =>
        pos(p).enTransito ? (
          <button onClick={(e) => { e.stopPropagation(); setVerTrans(p.producto.id); }} className="tnum text-info underline decoration-dotted underline-offset-4 hover:decoration-solid">
            {n(pos(p).enTransito)}
          </button>
        ) : (
          <span className="text-disabled">—</span>
        ),
    },
    { key: "minimo", header: "Mínimo", align: "right", hideOnMobile: true, cell: (p) => <span className="tnum text-muted">{n(p.producto.stockMinimo)}</span> },
    { key: "estado", header: "Estado", sortable: true, sortValue: (p) => p.estado, cell: (p) => <StatusBadge tipo="STOCK" estado={p.estado} /> },
    ...(verCostos
      ? [{ key: "valor", header: "Valorizado", align: "right" as const, sortable: true, sortValue: (p: PosicionProducto) => pos(p).fisico * p.producto.costoPromedio, footer: <span className="tnum">{formatMoney(filas.reduce((a, p) => a + Math.max(0, pos(p).fisico) * p.producto.costoPromedio, 0), { decimals: false })}</span>, cell: (p: PosicionProducto) => <span className="tnum">{formatMoney(Math.max(0, pos(p).fisico) * p.producto.costoPromedio, { decimals: false })}</span> }]
      : []),
  ];

  const exportar = () => {
    const head = ["Código", "Artículo", "Unidad", ...db.depositos.flatMap((d) => [`${d.nombre} físico`, `${d.nombre} pendiente`, `${d.nombre} reservado`, `${d.nombre} disponible`, `${d.nombre} en tránsito`]), "Mínimo", "Estado", ...(verCostos ? ["Valorizado"] : [])];
    const rows = filas.map((p) => [p.producto.codigo, p.producto.nombre, p.producto.unidad, ...db.depositos.flatMap((d) => [p.porDeposito[d.id].fisico, p.porDeposito[d.id].pendiente, p.porDeposito[d.id].reservado, p.porDeposito[d.id].disponible, p.porDeposito[d.id].enTransito]), p.producto.stockMinimo, p.estado, ...(verCostos ? [Math.round(p.valorizado)] : [])]);
    descargarArchivo(`stock-${new Date().toISOString().slice(0, 10)}.csv`, aCSV(head, rows));
  };

  const hayArticulos = db.productos.some((p) => p.activo);
  // Sin un solo movimiento el stock está vacío aunque la tabla muestre los artículos en 0.
  const vacio = (
    <VacioGuiado
      pagina="stock"
      icono={PackageSearch}
      puedeAccion={puedeAjustar}
      extra={puedeComprar ? <Button size="sm" variant="secondary" onClick={() => router.push("/compras/oc/nueva")}><ShoppingCart /> Nueva orden de compra</Button> : undefined}
      className={hayArticulos ? "py-6" : undefined}
    />
  );
  if (!hayArticulos) return <div className="rounded-card border border-border bg-surface">{vacio}</div>;

  return (
    <div className="space-y-4">
      {!db.movimientos.length && <div className="rounded-card border border-border bg-surface">{vacio}</div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {verCostos ? <KpiCard label="Valor de inventario" valor={formatMoney(valorTotal, { compact: true })} acento subtexto="a costo promedio" /> : <KpiCard label="Artículos activos" valor={String(todas.length)} acento />}
        <KpiCard label="Pendiente de entrega" valor={verCostos ? formatMoney(pendValor, { compact: true }) : String(todas.filter((p) => pos(p).pendiente > 0).length)} subtexto={verCostos ? "vendido sin entregar, a costo" : "artículos con pendiente"} onClick={() => setSoloPend(true)} />
        <KpiCard label="Bajo mínimo" valor={String(bajo)} subtexto={bajo ? <button className="font-medium text-danger underline-offset-2 hover:underline" onClick={() => setSoloBajo(true)}>Ver artículos</button> : "todo en orden"} />
        <KpiCard label="Disponible negativo" valor={<span className={negativos ? "text-danger" : ""}>{negativos}</span>} subtexto={negativos ? "ventas forzadas sin disponible" : "sin sobreventa"} />
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
        searchPlaceholder="Buscar artículo"
        onRowClick={(p) => router.push(`/productos?id=${p.producto.id}`)}
        initialSort={{ key: "producto", dir: "asc" }}
        showFooter={verCostos}
        rowClassName={(p) => (pos(p).disponible < 0 ? "bg-danger-soft/40" : undefined)}
        empty={{ icono: PackageSearch, titulo: "No hay artículos para el filtro" }}
        filters={
          <>
            <Select size="sm" className="w-[190px]" aria-label="Depósito" value={deposito} onValueChange={setDeposito} options={[...db.depositos.map((d) => ({ value: d.id, label: d.nombre })), { value: "", label: "Todos los depósitos (total)" }]} />
            <Select size="sm" className="w-[170px]" aria-label="Rubro" value={rubro} onValueChange={setRubro} options={[{ value: "", label: "Todos los rubros" }, ...db.rubros.filter((r) => !un || r.unidadNegocioId === un).map((r) => ({ value: r.id, label: r.nombre }))]} />
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <Checkbox checked={soloBajo} onCheckedChange={(v) => setSoloBajo(!!v)} /> Solo bajo mínimo
            </label>
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <Checkbox checked={soloPend} onCheckedChange={(v) => setSoloPend(!!v)} /> Solo con pendiente de entrega
            </label>
          </>
        }
        actions={
          <Button size="sm" variant="ghost" onClick={exportar}>
            <Download /> Exportar CSV
          </Button>
        }
      />
      <PendienteProductoSheet productoId={verPend} depositoId={dep} onClose={() => setVerPend(null)} />
      <EnTransitoSheet productoId={verTrans} depositoId={dep} onClose={() => setVerTrans(null)} />
    </div>
  );
}
