"use client";
import * as React from "react";
import { Lock } from "lucide-react";
import { usePuede } from "@/store/selectors";
import type { Permiso } from "@/domain/permisos";
import { EmptyState } from "./empty-state";

/** Muestra el contenido sólo si el usuario tiene el permiso. */
export function RequierePermiso({ permiso, children }: { permiso: Permiso; children: React.ReactNode }) {
  const ok = usePuede(permiso);
  if (!ok)
    return (
      <div className="rounded-card border border-border bg-surface">
        <EmptyState icono={Lock} titulo="No tenés acceso a esta sección" descripcion="Tu rol no tiene permiso para ver este módulo. Consultá con el administrador." />
      </div>
    );
  return <>{children}</>;
}
