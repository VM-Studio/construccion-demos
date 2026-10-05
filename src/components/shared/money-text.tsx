import { cn } from "@/lib/utils";
import { formatMoney, formatQty } from "@/lib/format";

/** Importe en pesos con números tabulares. `signo` colorea positivo/negativo. */
export function MoneyText({
  valor,
  className,
  compact,
  signo,
  muted,
}: {
  valor: number;
  className?: string;
  compact?: boolean;
  signo?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "tnum whitespace-nowrap",
        signo && valor > 0.009 && "text-success",
        signo && valor < -0.009 && "text-danger",
        muted && "text-muted",
        className,
      )}
    >
      {signo && valor > 0.009 ? "+" : ""}
      {formatMoney(valor, { compact })}
    </span>
  );
}

export function QtyText({ valor, unidad, className }: { valor: number; unidad: string; className?: string }) {
  return <span className={cn("tnum whitespace-nowrap", className)}>{formatQty(valor, unidad)}</span>;
}
