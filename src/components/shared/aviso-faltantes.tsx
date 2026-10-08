"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useDb } from "@/store/selectors";
import { enumerarFaltantes, faltantes, type ClavePrerequisito, type Prerequisito } from "@/domain/prerequisitos";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Aviso arriba de un formulario cuando falta algo para poder operar:
 * dice qué falta y lleva a donde se carga.
 */
export function AvisoFaltantes({
  faltan: faltanProp,
  claves,
  titulo,
  texto,
  acciones,
  className,
}: {
  /** Lo que falta (ya calculado) o, en su lugar, las claves a verificar. */
  faltan?: Prerequisito[];
  claves?: ClavePrerequisito[];
  titulo?: string;
  /** Texto propio; si no, "Para operar necesitás …". */
  texto?: React.ReactNode;
  /** Botones extra (p. ej. resolverlo sin salir de la pantalla). */
  acciones?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const db = useDb();
  const faltan = faltanProp ?? faltantes(claves ?? [], db);
  if (claves && !faltanProp && !faltan.length) return null;
  if (!faltan.length && !texto) return null;
  return (
    <div role="status" className={cn("flex flex-col gap-3 rounded-card border border-warning/30 bg-warning-soft p-3 text-[13px] sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="font-medium text-ink">{titulo ?? "Todavía falta cargar algo"}</p>
          <p className="text-muted">{texto ?? `Para operar acá necesitás ${enumerarFaltantes(faltan)}.`}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {faltan.map((f) => (
          <Button key={f.clave} size="sm" variant="secondary" onClick={() => router.push(f.href)}>
            {f.accion} <ArrowRight />
          </Button>
        ))}
        {acciones}
      </div>
    </div>
  );
}
