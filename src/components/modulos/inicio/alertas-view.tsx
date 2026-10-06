"use client";
import Link from "next/link";
import { ChevronRight, PackageCheck } from "lucide-react";
import { useAlertas } from "@/store/alertas";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SEVERIDAD = { alta: ["Alta", "danger"], media: ["Media", "warning"], baja: ["Baja", "neutral"] } as const;

/** Todas las alertas activas, priorizadas, con acceso directo a resolverlas. */
export function AlertasView() {
  const alertas = useAlertas();
  return (
    <>
      <PageHeader titulo="Alertas" descripcion="Lo que requiere atención hoy: stock, acopios, entregas, cobranzas, remitos y compras." />
      <div className="rounded-card border border-border bg-surface">
        {alertas.length === 0 ? (
          <EmptyState icono={PackageCheck} titulo="Sin alertas" descripcion="No hay stock crítico, vencimientos ni atrasos." />
        ) : (
          <ul className="divide-y divide-border">
            {alertas.map((a) => (
              <li key={a.id}>
                <Link href={a.href} className="group flex items-center gap-4 px-5 py-4 hover:bg-subtle">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-control border", a.severidad === "alta" ? "border-danger/20 bg-danger-soft text-danger" : a.severidad === "media" ? "border-warning/20 bg-warning-soft text-warning" : "border-border bg-subtle text-muted")}>
                    <a.icono className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-ink">{a.titulo}</span>
                    <span className="block text-[12.5px] text-muted">{a.detalle}</span>
                  </span>
                  <Badge variant={SEVERIDAD[a.severidad][1]}>{SEVERIDAD[a.severidad][0]}</Badge>
                  <span className="w-10 text-right text-[18px] font-semibold tnum">{a.cantidad}</span>
                  <ChevronRight className="size-4 text-disabled group-hover:text-ink" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
