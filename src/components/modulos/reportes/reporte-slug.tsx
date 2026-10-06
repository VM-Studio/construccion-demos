"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { RequierePermiso } from "@/components/shared/requiere-permiso";
import { REPORTES } from "./catalogo";
import { ReporteRentabilidadClientes, ReporteRentabilidadPedidos, ReporteRentabilidadProductos, ReporteVentas } from "./reportes-ventas";
import { ReporteDeudaMercaderia, ReporteMovimientos, ReporteStockCritico, ReporteValorizacion } from "./reportes-stock";
import { ReporteAcopiosProveedores, ReportePendientes, ReporteRemitosPendientes, ReporteTiemposDespacho } from "./reportes-m7";
import { ReporteAuditoria, ReporteCobranzas, ReporteCompras, ReporteDespachos } from "./reportes-otros";

const COMPONENTES: Record<string, () => React.ReactNode> = {
  ventas: ReporteVentas,
  "rentabilidad-pedidos": ReporteRentabilidadPedidos,
  "rentabilidad-productos": ReporteRentabilidadProductos,
  "rentabilidad-clientes": ReporteRentabilidadClientes,
  valorizacion: ReporteValorizacion,
  "deuda-mercaderia": ReporteDeudaMercaderia,
  "pendientes-entrega": ReportePendientes,
  "acopios-proveedores": ReporteAcopiosProveedores,
  "tiempos-despacho": ReporteTiemposDespacho,
  "remitos-pendientes": ReporteRemitosPendientes,
  compras: ReporteCompras,
  "stock-critico": ReporteStockCritico,
  cobranzas: ReporteCobranzas,
  despachos: ReporteDespachos,
  movimientos: ReporteMovimientos,
  auditoria: ReporteAuditoria,
};

export function ReporteSlug({ slug }: { slug: string }) {
  const meta = REPORTES.find((r) => r.slug === slug);
  const C = COMPONENTES[slug];
  if (!meta || !C) return <div className="rounded-card border border-border bg-surface"><EmptyState titulo="El reporte no existe" /></div>;
  return (
    <RequierePermiso permiso={meta.permiso}>
      <C />
    </RequierePermiso>
  );
}
