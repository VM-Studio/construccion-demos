import { addDays, differenceInCalendarDays, endOfDay, endOfMonth, startOfDay, startOfMonth, subMonths } from "date-fns";

export type PresetPeriodo = "HOY" | "7D" | "MES" | "MES_ANTERIOR" | "30D" | "90D" | "PERSONALIZADO";

export interface Periodo {
  preset: PresetPeriodo;
  desde: string;
  hasta: string;
}

export const PRESETS: { value: PresetPeriodo; label: string }[] = [
  { value: "HOY", label: "Hoy" },
  { value: "7D", label: "7 días" },
  { value: "MES", label: "Este mes" },
  { value: "MES_ANTERIOR", label: "Mes pasado" },
  { value: "PERSONALIZADO", label: "Personalizado" },
];

/** Rango de fechas de un preset. */
export function periodoDesdePreset(preset: PresetPeriodo, hoy = new Date(), custom?: { desde: string; hasta: string }): Periodo {
  const h = startOfDay(hoy);
  switch (preset) {
    case "HOY":
      return { preset, desde: h.toISOString(), hasta: endOfDay(h).toISOString() };
    case "7D":
      return { preset, desde: addDays(h, -6).toISOString(), hasta: endOfDay(h).toISOString() };
    case "30D":
      return { preset, desde: addDays(h, -29).toISOString(), hasta: endOfDay(h).toISOString() };
    case "90D":
      return { preset, desde: addDays(h, -89).toISOString(), hasta: endOfDay(h).toISOString() };
    case "MES":
      return { preset, desde: startOfMonth(h).toISOString(), hasta: endOfDay(h).toISOString() };
    case "MES_ANTERIOR": {
      const m = subMonths(h, 1);
      return { preset, desde: startOfMonth(m).toISOString(), hasta: endOfMonth(m).toISOString() };
    }
    default:
      return { preset, desde: custom?.desde ?? addDays(h, -29).toISOString(), hasta: custom?.hasta ?? endOfDay(h).toISOString() };
  }
}

/** Período anterior de igual duración (para comparar variaciones). */
export function periodoAnterior(p: Periodo): Periodo {
  const desde = new Date(p.desde);
  const hasta = new Date(p.hasta);
  if (p.preset === "MES") {
    // Mes anterior hasta el mismo día del mes
    const d = subMonths(desde, 1);
    const dias = differenceInCalendarDays(hasta, desde);
    return { preset: "PERSONALIZADO", desde: d.toISOString(), hasta: endOfDay(addDays(d, dias)).toISOString() };
  }
  const dias = differenceInCalendarDays(hasta, desde) + 1;
  return { preset: "PERSONALIZADO", desde: addDays(desde, -dias).toISOString(), hasta: endOfDay(addDays(desde, -1)).toISOString() };
}

export function enPeriodo(fecha: string | undefined, p: { desde: string; hasta: string }): boolean {
  if (!fecha) return false;
  return fecha >= p.desde && fecha <= p.hasta;
}

export function diasDelPeriodo(p: { desde: string; hasta: string }): number {
  return differenceInCalendarDays(new Date(p.hasta), new Date(p.desde)) + 1;
}

/** Variación relativa (0.12 = +12 %). null si no hay base. */
export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return actual ? null : 0;
  return (actual - anterior) / Math.abs(anterior);
}

/** Día local `yyyy-MM-dd` de una fecha ISO (para comparar por día calendario). */
export function diaLocal(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function esHoy(iso: string): boolean {
  return diaLocal(iso) === diaLocal(new Date());
}

/** Diferencia en días calendario entre una fecha y hoy (negativo = pasado). */
export function diasDesdeHoy(iso: string): number {
  return differenceInCalendarDays(new Date(iso), new Date());
}
