import type { Circuito } from "@/domain/types";
import { CIRCUITO_LABEL } from "@/domain/estados";
import { cn } from "@/lib/utils";

/** AC1 · Fiscal (gris oscuro) / AC2 · Interno (gris claro con borde). Nunca colores llamativos. */
export function CircuitoBadge({ circuito, corto, className }: { circuito: Circuito; corto?: boolean; className?: string }) {
  return (
    <span
      title={CIRCUITO_LABEL[circuito]}
      className={cn(
        "inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-[4px] px-1.5 text-[11px] font-medium",
        circuito === 1 ? "bg-[#3A3A38] text-white" : "border border-border-strong bg-subtle text-muted",
        className,
      )}
    >
      {corto ? `AC${circuito}` : CIRCUITO_LABEL[circuito]}
    </span>
  );
}
