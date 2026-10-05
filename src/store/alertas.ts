"use client";
import type { LucideIcon } from "lucide-react";

export interface Alerta {
  id: string;
  titulo: string;
  detalle: string;
  cantidad: number;
  href: string;
  severidad: "alta" | "media" | "baja";
  icono: LucideIcon;
}

/** Alertas del sistema (se calculan en el Tablero). */
export function useAlertas(): Alerta[] {
  return [];
}
