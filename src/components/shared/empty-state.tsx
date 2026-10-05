import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icono: Icono,
  titulo,
  descripcion,
  accion,
  className,
}: {
  icono?: LucideIcon;
  titulo: string;
  descripcion?: React.ReactNode;
  accion?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {Icono && (
        <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-border bg-subtle">
          <Icono className="size-5 text-muted" />
        </div>
      )}
      <p className="text-[14px] font-medium text-ink">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-sm text-[13px] text-muted">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
