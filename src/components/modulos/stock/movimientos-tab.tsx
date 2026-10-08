"use client";

import { useMovimientos } from "@/lib/datos/hooks";
import * as React from "react";
import Link from "next/link";
import { Download, History } from "lucide-react";
import { useDb, usePuede } from "@/store/selectors";
import type { MovimientoStock, TipoMovimientoStock } from "@/domain/types";
import { ESTADOS } from "@/domain/estados";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DateRangePicker } from "@/components/shared/filter-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatMoney, formatNumber, unidadCorta } from "@/lib/format";
import { periodoDesdePreset, enPeriodo, type Periodo } from "@/lib/periodos";
import { referenciaMovimiento, nombreUsuario } from "@/lib/referencias";
import { aCSV, cn, descargarArchivo } from "@/lib/utils";

const TIPOS = Object.keys(ESTADOS)
  .filter((k) => k.startsWith("MOVIMIENTO."))
  .map((k) => ({ value: k.split(".")[1], label: ESTADOS[k].label }));

/** Kardex global filtrable, con exportación y totales por tipo. */
export function MovimientosTab({ conTotalesPorTipo }: { conTotalesPorTipo?: boolean }) {
  const db = useDb();
  const verCostos = usePuede("margenes.ver");
  const puedeAjustar = usePuede("stock.ajustar");
  const [periodo, setPeriodo] = React.useState<Periodo>(() => periodoDesdePreset("30D"));
  const [dep, setDep] = React.useState("");
  const [tipo, setTipo] = React.useState("");
  const [producto, setProducto] = React.useState("");

  const prod = React.useMemo(() => new Map(db.productos.map((p) => [p.id, p])), [db.productos]);
  // Filtrado y orden en el servidor (kardex paginado).
  const { movimientos: filas } = useMovimientos({ desde: periodo.desde, hasta: periodo.hasta, depositoId: dep || null, tipo: tipo || null, productoId: producto || null });
  const { total: totalKardex } = useMovimientos({ tamano: 1 });

  const columnas: Column<MovimientoStock>[] = [
    { key: "fecha", header: "Fecha y hora", sortable: true, sortValue: (m) => m.fecha, cell: (m) => <span className="whitespace-nowrap text-muted">{formatDateTime(m.fecha)}</span> },
    { key: "producto", header: "Producto", sortable: true, sortValue: (m) => prod.get(m.productoId)?.codigo ?? "", cell: (m) => <span className="block min-w-[180px]"><span className="mr-1.5 font-mono text-[11px] text-muted">{prod.get(m.productoId)?.codigo}</span>{prod.get(m.productoId)?.nombre}</span> },
    { key: "deposito", header: "Depósito", hideOnMobile: true, cell: (m) => <span className="whitespace-nowrap text-muted">{db.depositos.find((d) => d.id === m.depositoId)?.nombre}</span> },
    { key: "tipo", header: "Tipo", cell: (m) => <StatusBadge tipo="MOVIMIENTO" estado={m.tipo} /> },
    {
      key: "cantidad",
      header: "Cantidad",
      align: "right",
      sortable: true,
      sortValue: (m) => m.signo * m.cantidad,
      cell: (m) => (
        <span className={cn("whitespace-nowrap font-medium tnum", m.signo > 0 ? "text-success" : "text-danger")}>
          {m.signo > 0 ? "+" : "−"}
          {formatNumber(m.cantidad)} <span className="font-normal text-muted">{unidadCorta(prod.get(m.productoId)?.unidad ?? "UN")}</span>
        </span>
      ),
    },
    ...(verCostos ? [{ key: "costo", header: "Costo unit.", align: "right" as const, hideOnMobile: true, cell: (m: MovimientoStock) => <span className="tnum text-muted">{formatMoney(m.costoUnitario)}</span> }] : []),
    {
      key: "ref",
      header: "Referencia",
      cell: (m) => {
        const r = referenciaMovimiento(db, m);
        return (
          <Link href={r.href} onClick={(e) => e.stopPropagation()} className="font-mono text-[12px] underline-offset-2 hover:underline">
            {r.label}
          </Link>
        );
      },
    },
    { key: "usuario", header: "Usuario", hideOnMobile: true, cell: (m) => <span className="whitespace-nowrap text-muted">{nombreUsuario(db, m.usuarioId)}</span> },
    { key: "obs", header: "Observación", hideOnMobile: true, cell: (m) => <span className="block max-w-[200px] truncate text-muted">{m.observacion}</span> },
  ];

  const porTipo = React.useMemo(() => {
    const out = new Map<TipoMovimientoStock, { n: number; valor: number }>();
    for (const m of filas) {
      const x = out.get(m.tipo) ?? { n: 0, valor: 0 };
      x.n++;
      x.valor += m.signo * m.cantidad * m.costoUnitario;
      out.set(m.tipo, x);
    }
    return [...out.entries()];
  }, [filas]);

  const exportar = () => {
    const head = ["Fecha", "Código", "Producto", "Depósito", "Tipo", "Cantidad", "Unidad", ...(verCostos ? ["Costo unitario", "Valor"] : []), "Referencia", "Usuario", "Observación"];
    const rows = filas.map((m) => {
      const p = prod.get(m.productoId);
      return [
        formatDateTime(m.fecha),
        p?.codigo,
        p?.nombre,
        db.depositos.find((d) => d.id === m.depositoId)?.nombre,
        ESTADOS[`MOVIMIENTO.${m.tipo}`]?.label,
        m.signo * m.cantidad,
        p?.unidad,
        ...(verCostos ? [m.costoUnitario, Math.round(m.signo * m.cantidad * m.costoUnitario)] : []),
        referenciaMovimiento(db, m).label,
        nombreUsuario(db, m.usuarioId),
        m.observacion ?? "",
      ];
    });
    descargarArchivo(`movimientos-stock-${new Date().toISOString().slice(0, 10)}.csv`, aCSV(head, rows));
  };

  return (
    <div className="space-y-4">
      {conTotalesPorTipo && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          {porTipo.map(([t, x]) => (
            <div key={t} className="rounded-card border border-border bg-surface p-3">
              <StatusBadge tipo="MOVIMIENTO" estado={t} />
              <div className="mt-2 text-[18px] font-semibold tnum">{x.n}</div>
              {verCostos && <div className={cn("text-[12px] tnum", x.valor >= 0 ? "text-success" : "text-danger")}>{formatMoney(x.valor, { compact: true })}</div>}
            </div>
          ))}
        </div>
      )}
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(m) => m.id}
        searchText={(m) => `${prod.get(m.productoId)?.codigo} ${prod.get(m.productoId)?.nombre} ${referenciaMovimiento(db, m).label} ${m.observacion ?? ""}`}
        searchPlaceholder="Producto o referencia"
        initialSort={{ key: "fecha", dir: "desc" }}
        pageSize={50}
        empty={totalKardex ? { icono: History, titulo: "Sin movimientos para el período o el filtro" } : <VacioGuiado pagina="movimientos" icono={History} puedeAccion={puedeAjustar} />}
        filters={
          <>
            <DateRangePicker value={periodo} onChange={setPeriodo} presets={[{ value: "HOY", label: "Hoy" }, { value: "7D", label: "7 días" }, { value: "30D", label: "30 días" }, { value: "90D", label: "90 días" }]} />
            <Select size="sm" className="w-[160px]" aria-label="Depósito" value={dep} onValueChange={setDep} options={[{ value: "", label: "Todos los depósitos" }, ...db.depositos.map((d) => ({ value: d.id, label: d.nombre }))]} />
            <Select size="sm" className="w-[190px]" aria-label="Tipo" value={tipo} onValueChange={setTipo} options={[{ value: "", label: "Todos los tipos" }, ...TIPOS]} />
            <Select size="sm" className="w-[220px]" aria-label="Producto" value={producto} onValueChange={setProducto} options={[{ value: "", label: "Todos los productos" }, ...db.productos.map((p) => ({ value: p.id, label: `${p.codigo} ${p.nombre}` }))]} />
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
