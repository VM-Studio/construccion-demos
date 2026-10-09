"use client";
import { useDb } from "@/store/selectors";
import { useAuditoria } from "@/lib/datos/hooks";
import { Timeline } from "./timeline";

/** Historial (auditoría) de una o varias entidades. */
export function HistorialEntidad({ ids, className }: { ids: string[]; className?: string }) {
  const db = useDb();
  // La auditoría vive en el servidor: se piden juntas todas las entidades.
  const { auditoria } = useAuditoria({ entidadId: ids.filter(Boolean).join(",") }, ids.some(Boolean));
  const eventos = [...auditoria]
    .sort((x, y) => x.fecha.localeCompare(y.fecha))
    .map((a) => ({ id: a.id, fecha: a.fecha, accion: a.accion, detalle: a.detalle, usuario: db.usuarios.find((u) => u.id === a.usuarioId)?.nombre }));
  return <Timeline eventos={eventos} className={className} />;
}
