"use client";
import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Heart } from "lucide-react";
import { useStore } from "@/store";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Corazón para marcar la página actual como favorita (persistido por usuario). */
function FavoritoPagina() {
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params?.toString();
  const href = q ? `${pathname}?${q}` : pathname;
  const usuarioId = useStore((s) => s.ui.usuarioId) ?? "";
  const activo = useStore((s) => (s.ui.favoritosPaginas[usuarioId] ?? []).includes(href));
  const toggle = useStore((s) => s.toggleFavoritoPagina);
  return (
    <Tooltip content={activo ? "Quitar de favoritos" : "Agregar a favoritos"}>
      <button onClick={() => toggle(href)} aria-pressed={activo} aria-label={activo ? "Quitar de favoritos" : "Agregar a favoritos"} className="no-print mt-1 rounded-control p-1 text-disabled transition-colors hover:text-ink">
        <Heart className={cn("size-4", activo && "fill-ink text-ink")} />
      </button>
    </Tooltip>
  );
}

export function PageHeader({
  titulo,
  descripcion,
  acciones,
  className,
  children,
  favorito = true,
}: {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  acciones?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  favorito?: boolean;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0 flex-1 basis-[320px]">
        <div className="flex items-start gap-1.5">
          <h1 className="text-title font-semibold tracking-tight text-ink">{titulo}</h1>
          {favorito && (
            <React.Suspense>
              <FavoritoPagina />
            </React.Suspense>
          )}
        </div>
        {descripcion && <p className="mt-0.5 text-[13px] text-muted">{descripcion}</p>}
        {children}
      </div>
      {acciones && <div className="flex max-w-full flex-wrap items-center gap-2" data-tour="acciones">{acciones}</div>}
    </div>
  );
}
