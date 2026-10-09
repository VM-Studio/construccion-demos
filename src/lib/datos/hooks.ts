"use client";
/**
 * Lecturas paginadas en el servidor de las tablas insert-only (kardex y auditoría).
 * Se revalidan solas cuando la sincronización recibe un cambio de stock o de auditoría.
 */
import useSWR from "swr";
import type { Auditoria, MovimientoStock } from "@/domain/types";

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Error ${r.status}`);
  return r.json();
};

const qs = (p: Record<string, string | number | undefined | null>) =>
  Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

export interface FiltroMovimientos {
  productoId?: string | null;
  depositoId?: string | null;
  tipo?: string | null;
  desde?: string | null;
  hasta?: string | null;
  tamano?: number;
}

/** Kardex filtrado en el servidor (por defecto, hasta 5.000 movimientos más recientes). */
export function useMovimientos(f: FiltroMovimientos = {}, activo = true): { movimientos: MovimientoStock[]; total: number; cargando: boolean } {
  const url = `/api/movimientos?${qs({ productoId: f.productoId, depositoId: f.depositoId, tipo: f.tipo, desde: f.desde, hasta: f.hasta, tamano: f.tamano })}`;
  const { data, isLoading } = useSWR(activo ? ["movimientos", url] : null, ([, u]) => fetcher(u), { keepPreviousData: true, dedupingInterval: 1000, revalidateOnFocus: false });
  return { movimientos: (data?.filas ?? []) as MovimientoStock[], total: data?.total ?? 0, cargando: isLoading };
}

export interface FiltroAuditoria {
  entidadId?: string | null;
  usuarioId?: string | null;
  desde?: string | null;
  conEfectos?: boolean;
  tamano?: number;
}

export function useAuditoria(f: FiltroAuditoria = {}, activo = true): { auditoria: Auditoria[]; total: number; cargando: boolean } {
  const url = `/api/auditoria?${qs({ entidadId: f.entidadId, usuarioId: f.usuarioId, desde: f.desde, conEfectos: f.conEfectos ? 1 : undefined, tamano: f.tamano })}`;
  const { data, isLoading } = useSWR(activo ? ["auditoria", url] : null, ([, u]) => fetcher(u), { keepPreviousData: true, dedupingInterval: 1000, revalidateOnFocus: false });
  return { auditoria: (data?.filas ?? []) as Auditoria[], total: data?.total ?? 0, cargando: isLoading };
}
