"use client";
import * as React from "react";
import { CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { PRESETS, periodoDesdePreset, type Periodo, type PresetPeriodo } from "@/lib/periodos";

/** Contenedor horizontal de filtros. */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

function toInput(iso: string) {
  return iso.slice(0, 10);
}
function fromInput(v: string, fin = false) {
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(y, m - 1, d, fin ? 23 : 0, fin ? 59 : 0, fin ? 59 : 0);
  return date.toISOString();
}
function localInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Selector de período con presets (Hoy / 7 días / Este mes / Mes pasado / Personalizado). */
export function DateRangePicker({
  value,
  onChange,
  presets = PRESETS,
  className,
}: {
  value: Periodo;
  onChange: (p: Periodo) => void;
  presets?: { value: PresetPeriodo; label: string }[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [desde, setDesde] = React.useState(localInput(value.desde));
  const [hasta, setHasta] = React.useState(localInput(value.hasta));
  React.useEffect(() => {
    setDesde(localInput(value.desde));
    setHasta(localInput(value.hasta));
  }, [value.desde, value.hasta]);
  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      <div className="inline-flex rounded-control border border-border bg-subtle p-0.5" role="tablist" aria-label="Período">
        {presets
          .filter((p) => p.value !== "PERSONALIZADO")
          .map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={value.preset === p.value}
              onClick={() => onChange(periodoDesdePreset(p.value))}
              className={cn(
                "h-7 whitespace-nowrap rounded-[4px] px-2.5 text-[12px] font-medium transition-colors",
                value.preset === p.value ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-border)]" : "text-muted hover:text-ink",
              )}
            >
              {p.label}
            </button>
          ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant={value.preset === "PERSONALIZADO" ? "primary" : "secondary"} size="sm" className="h-8">
            <CalendarDays />
            {value.preset === "PERSONALIZADO" ? `${formatDate(value.desde)} – ${formatDate(value.hasta)}` : "Personalizado"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="rango-desde">Desde</Label>
              <input id="rango-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9 rounded-control border border-border-strong px-2 text-[13px]" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rango-hasta">Hasta</Label>
              <input id="rango-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9 rounded-control border border-border-strong px-2 text-[13px]" />
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (!desde || !hasta) return;
                const [a, b] = desde <= hasta ? [desde, hasta] : [hasta, desde];
                onChange({ preset: "PERSONALIZADO", desde: fromInput(a), hasta: fromInput(b, true) });
                setOpen(false);
              }}
            >
              Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { toInput };
