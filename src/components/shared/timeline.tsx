import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface EventoTimeline {
  id: string;
  fecha: string;
  usuario?: string;
  accion: string;
  detalle?: string;
  destacado?: boolean;
}

/** Historial cronológico de una entidad (más reciente arriba). */
export function Timeline({ eventos, className }: { eventos: EventoTimeline[]; className?: string }) {
  const orden = [...eventos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (!orden.length) return <p className="py-6 text-center text-[13px] text-muted">Sin eventos registrados.</p>;
  return (
    <ol className={cn("relative ml-1.5 border-l border-border", className)}>
      {orden.map((e) => (
        <li key={e.id} className="relative pb-4 pl-5 last:pb-0">
          <span className={cn("absolute -left-[5px] top-1 size-[9px] rounded-full border-2 border-surface", e.destacado ? "bg-accent" : "bg-border-strong")} />
          <p className="text-[13px] font-medium text-ink">{e.accion}</p>
          {e.detalle && <p className="text-[12px] text-muted">{e.detalle}</p>}
          <p className="mt-0.5 text-[11px] text-disabled">
            {formatDateTime(e.fecha)}
            {e.usuario && ` · ${e.usuario}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
