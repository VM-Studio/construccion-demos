import { cn } from "@/lib/utils";

/** Barra de progreso fina (0..1). */
export function Progress({
  value,
  className,
  tone = "ink",
}: {
  value: number;
  className?: string;
  tone?: "ink" | "accent" | "danger" | "success";
}) {
  const pct = Math.max(0, Math.min(1, value || 0)) * 100;
  const color = { ink: "bg-ink", accent: "bg-accent", danger: "bg-danger", success: "bg-success" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-subtle", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
