"use client";
import { useStore } from "./index";
import { hoyKey } from "./calculos";
import { calcularAlertas, type Alerta } from "./alertas-calc";
import { useDb } from "@/lib/datos/almacen";

export * from "./alertas-calc";

export function useAlertas(): Alerta[] {
  const db = useDb();
  const sucursalId = useStore((s) => s.ui.sucursalActivaId);
  const usuarioId = useStore((s) => s.ui.usuarioId);
  const usuario = db.usuarios.find((u) => u.id === usuarioId);
  return calcularAlertas(db, sucursalId, usuario, hoyKey());
}
