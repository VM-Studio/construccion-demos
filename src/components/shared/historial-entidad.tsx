"use client";
import { useDb } from "@/store/selectors";
import { Timeline } from "./timeline";

/** Historial (auditoría) de una o varias entidades. */
export function HistorialEntidad({ ids, className }: { ids: string[]; className?: string }) {
  const db = useDb();
  const set = new Set(ids);
  const eventos = db.auditoria
    .filter((a) => set.has(a.entidadId))
    .map((a) => ({ id: a.id, fecha: a.fecha, accion: a.accion, detalle: a.detalle, usuario: db.usuarios.find((u) => u.id === a.usuarioId)?.nombre }));
  return <Timeline eventos={eventos} className={className} />;
}
