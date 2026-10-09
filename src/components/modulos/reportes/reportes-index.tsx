"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useUsuario } from "@/store/selectors";
import { puede } from "@/domain/permisos";
import { PageHeader } from "@/components/shared/page-header";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { useDb } from "@/store/selectors";
import { estaVacio } from "@/domain/prerequisitos";
import { cn } from "@/lib/utils";
import { REPORTES } from "./catalogo";

export function ReportesIndex() {
  const usuario = useUsuario();
  const db = useDb();
  const visibles = REPORTES.filter((r) => puede(usuario, r.permiso) && puede(usuario, "reportes.ver"));
  return (
    <>
      <PageHeader titulo="Reportes" descripcion="Todos calculados en vivo con los datos del sistema. Cada uno se exporta a CSV y se imprime o guarda como PDF." />
      {estaVacio(db) && (
        <div className="mb-4 rounded-card border border-border bg-surface">
          <VacioGuiado pagina="reportes" className="py-6" />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-tour="reportes">
        {visibles.map((r) => (
          <Link key={r.slug} href={`/reportes/${r.slug}`} className={cn("group flex gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong", r.destacado && "border-t-2 border-t-accent")}>
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-control border border-border", r.destacado ? "bg-accent-soft text-accent" : "bg-subtle text-muted")}>
              <r.icono className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 text-[14px] font-semibold text-ink">
                {r.titulo}
                <ArrowRight className="size-4 text-disabled transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
              </span>
              <span className="mt-0.5 block text-[13px] text-muted">{r.descripcion}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
