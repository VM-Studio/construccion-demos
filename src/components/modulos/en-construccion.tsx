"use client";
import { Construction } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RequierePermiso } from "@/components/shared/requiere-permiso";
import type { Permiso } from "@/domain/permisos";

export function EnConstruccion({ titulo, descripcion, permiso, actualizacion }: { titulo: string; descripcion: string; permiso: Permiso; actualizacion?: boolean }) {
  return (
    <RequierePermiso permiso={permiso}>
      <PageHeader titulo={titulo} descripcion={descripcion} />
      <div className="rounded-card border border-border bg-surface">
        <EmptyState
          icono={Construction}
          titulo={actualizacion ? "Módulo en actualización" : "Módulo en construcción"}
          descripcion={actualizacion ? "Estamos adaptando esta sección al modelo de Aceros RNF. Vuelve en la próxima etapa." : "Esta sección se habilita en la próxima etapa del demo."}
        />
      </div>
    </RequierePermiso>
  );
}
