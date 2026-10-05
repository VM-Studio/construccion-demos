import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  titulo,
  descripcion,
  acciones,
  className,
  children,
}: {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  acciones?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-title font-semibold tracking-tight text-ink">{titulo}</h1>
        {descripcion && <p className="mt-0.5 text-[13px] text-muted">{descripcion}</p>}
        {children}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}
