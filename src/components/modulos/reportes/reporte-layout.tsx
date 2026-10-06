"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store";
import { useDb, useSucursalActiva, useUsuario } from "@/store/selectors";
import { BRAND } from "@/config/brand";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangePicker, FilterBar } from "@/components/shared/filter-bar";
import { PrintLayout, PrintPreview, PrintTable } from "@/components/shared/print-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { Periodo, PresetPeriodo } from "@/lib/periodos";
import { aCSV, descargarArchivo } from "@/lib/utils";

export type Celda = string | number | null | undefined;
export interface Exportable {
  head: string[];
  rows: Celda[][];
  foot?: Celda[];
}

const PRESETS_REPORTE: { value: PresetPeriodo; label: string }[] = [
  { value: "MES", label: "Este mes" },
  { value: "MES_ANTERIOR", label: "Mes pasado" },
  { value: "30D", label: "30 días" },
  { value: "90D", label: "90 días" },
  { value: "PERSONALIZADO", label: "Personalizado" },
];

function texto(c: Celda) {
  if (c === null || c === undefined) return "";
  return typeof c === "number" ? formatNumber(c, 2) : c;
}

/**
 * Estructura común de un reporte: filtros (período, sucursal y propios), KPIs,
 * gráfico, tabla, exportación CSV real e impresión A4 con filtros aplicados.
 */
export function ReporteLayout({
  slug,
  titulo,
  descripcion,
  periodo,
  onPeriodo,
  filtros,
  filtrosTexto,
  kpis,
  grafico,
  graficoTitulo,
  children,
  exportar,
}: {
  slug: string;
  titulo: string;
  descripcion: string;
  periodo?: Periodo;
  onPeriodo?: (p: Periodo) => void;
  filtros?: React.ReactNode;
  filtrosTexto?: string;
  kpis?: React.ReactNode;
  grafico?: React.ReactNode;
  graficoTitulo?: string;
  children: React.ReactNode;
  exportar: () => Exportable;
}) {
  const db = useDb();
  const usuario = useUsuario();
  const sucursalId = useSucursalActiva();
  const [imprimir, setImprimir] = React.useState(false);
  const sucursal = sucursalId ? db.sucursales.find((s) => s.id === sucursalId)?.nombre : "Todas las sucursales";
  const aplicados = [periodo ? `Período ${formatDate(periodo.desde)} – ${formatDate(periodo.hasta)}` : `Al ${formatDateTime(new Date())}`, sucursal, filtrosTexto].filter(Boolean).join(" · ");
  const pie = `Generado por ${BRAND.sistema} · ${formatDateTime(new Date())} · ${usuario?.nombre ?? ""}`;

  const csv = () => {
    const e = exportar();
    const rows = e.foot ? [...e.rows, e.foot] : e.rows;
    descargarArchivo(`${slug}-${new Date().toISOString().slice(0, 10)}.csv`, aCSV(e.head, rows));
    useStore.getState().registrarEvento("Exportó reporte", "Reporte", slug, `${titulo} · ${e.rows.length} filas`);
    toast.success("CSV descargado", { description: `${e.rows.length} filas · ${titulo}` });
  };

  const datos = imprimir ? exportar() : null;

  return (
    <div>
      <Link href="/reportes" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Reportes
      </Link>
      <PageHeader
        titulo={titulo}
        descripcion={descripcion}
        acciones={
          <>
            <Button variant="secondary" onClick={csv}><Download /> Exportar CSV</Button>
            <Button variant="secondary" onClick={() => setImprimir(true)}><Printer /> Imprimir / PDF</Button>
          </>
        }
      />
      <div className="space-y-4">
        <FilterBar className="rounded-card border border-border bg-surface p-3">
          {periodo && onPeriodo && <DateRangePicker value={periodo} onChange={onPeriodo} presets={PRESETS_REPORTE} />}
          {filtros}
          <span className="ml-auto text-[12px] text-muted">{sucursal} · cambiala desde el selector de arriba</span>
        </FilterBar>
        {kpis && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{kpis}</div>}
        {grafico && (
          <Card>
            {graficoTitulo && <CardHeader><CardTitle>{graficoTitulo}</CardTitle></CardHeader>}
            <CardContent className="pb-2">{grafico}</CardContent>
          </Card>
        )}
        {children}
        <p className="text-center text-[12px] text-muted">{pie}</p>
      </div>
      <PrintPreview open={imprimir} onOpenChange={setImprimir} titulo={titulo} onPrint={() => useStore.getState().registrarEvento("Imprimió reporte", "Reporte", slug, titulo)}>
        {datos && (
          <PrintLayout titulo={titulo} fecha={formatDate(new Date())} subtitulo={<div><b>Filtros:</b> {aplicados}<br /><b>Emitido por:</b> {usuario?.nombre}</div>} pie={pie}>
            <PrintTable head={datos.head} rows={datos.rows.map((r) => r.map(texto))} foot={datos.foot?.map(texto)} />
          </PrintLayout>
        )}
      </PrintPreview>
    </div>
  );
}
