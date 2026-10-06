/**
 * Tiempos de despacho en depósito: espera → preparación → finalizado.
 * Funciones puras; `ahora` se pasa para poder medir despachos en curso.
 */
import type { Despacho } from "./types";

const min = (desde: string, hasta: string | Date) => Math.max(0, Math.round(((typeof hasta === "string" ? Date.parse(hasta) : hasta.getTime()) - Date.parse(desde)) / 60000));

/** Minutos desde que el despacho entró en espera hasta que empezó la preparación (o hasta ahora). */
export function minutosEspera(d: Pick<Despacho, "fechaEspera" | "fechaInicioPreparacion" | "estado">, ahora: Date = new Date()): number | null {
  if (d.estado === "CANCELADO" && !d.fechaInicioPreparacion) return null;
  return min(d.fechaEspera, d.fechaInicioPreparacion ?? ahora);
}

/** Minutos de preparación (inicio de preparación → fin, o hasta ahora si sigue en preparación). */
export function minutosPreparacion(d: Pick<Despacho, "fechaInicioPreparacion" | "fechaFin" | "estado">, ahora: Date = new Date()): number | null {
  if (!d.fechaInicioPreparacion) return null;
  if (!d.fechaFin && d.estado !== "PREPARACION") return null;
  return min(d.fechaInicioPreparacion, d.fechaFin ?? ahora);
}

/** Minutos totales (espera → fin, o hasta ahora si sigue abierto). */
export function minutosTotal(d: Pick<Despacho, "fechaEspera" | "fechaFin" | "estado">, ahora: Date = new Date()): number | null {
  if (d.estado === "CANCELADO") return null;
  return min(d.fechaEspera, d.fechaFin ?? ahora);
}

/** Semáforo del tiempo total: ámbar > 45 min, rojo > 90 min. */
export function nivelTiempo(minutos: number | null): "ok" | "alto" | "critico" {
  if (minutos === null) return "ok";
  if (minutos > 90) return "critico";
  if (minutos > 45) return "alto";
  return "ok";
}

/** El despacho sigue en el depósito (todavía no salió ni se entregó). */
export function despachoAbierto(d: Pick<Despacho, "estado">): boolean {
  return d.estado === "ESPERA" || d.estado === "PREPARACION";
}

export function promedio(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x !== null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}
