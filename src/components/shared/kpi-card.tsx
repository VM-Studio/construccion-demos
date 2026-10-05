import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

export function KpiCard({
  label,
  valor,
  variacion,
  acento,
  icono: Icono,
  onClick,
  subtexto,
  invertirColor,
  className,
}: {
  label: string;
  valor: React.ReactNode;
  variacion?: { valor: number | null; periodo: string };
  acento?: boolean;
  icono?: LucideIcon;
  onClick?: () => void;
  subtexto?: React.ReactNode;
  /** true si una suba es mala (p. ej. deuda vencida). */
  invertirColor?: boolean;
  className?: string;
}) {
  const v = variacion?.valor;
  const positivo = v !== null && v !== undefined && v > 0;
  const bueno = invertirColor ? !positivo : positivo;
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 flex-col rounded-card border border-border bg-surface p-4 text-left",
        acento && "border-t-2 border-t-accent",
        onClick && "transition-colors hover:border-border-strong",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12px] font-medium text-muted">{label}</span>
        {Icono && <Icono className={cn("size-4 shrink-0", acento ? "text-accent" : "text-disabled")} />}
      </div>
      <div className={cn("mt-2 truncate text-[22px] font-semibold leading-tight tracking-[-0.02em] tnum sm:text-kpi", acento && "text-ink")}>{valor}</div>
      <div className="mt-1.5 flex min-h-[18px] flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
        {variacion && v !== undefined && (
          v === null ? (
            <span className="text-muted">sin datos de {variacion.periodo}</span>
          ) : (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", v === 0 ? "text-muted" : bueno ? "text-success" : "text-danger")}>
              {v !== 0 && (positivo ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />)}
              {formatPercent(Math.abs(v))}
              <span className="font-normal text-muted">vs {variacion.periodo}</span>
            </span>
          )
        )}
        {subtexto && <span className="text-muted">{subtexto}</span>}
      </div>
    </Comp>
  );
}
