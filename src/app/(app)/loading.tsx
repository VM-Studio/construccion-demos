import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mientras llega la página nueva: el menú lateral queda fijo y el contenido cambia al instante
 * (Next lo precarga con los links visibles), sin esperar la respuesta del servidor.
 */
export default function Cargando() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="space-y-2 rounded-card border border-border bg-surface p-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
