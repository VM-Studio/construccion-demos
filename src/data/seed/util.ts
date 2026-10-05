import { addDays, setHours, setMinutes, startOfDay } from "date-fns";

/** PRNG determinístico (mulberry32) para que el seed sea siempre el mismo. */
export function crearRandom(seed = 20261005) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Entero entre min y max inclusive. */
    int(min: number, max: number) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    /** Real entre min y max. */
    float(min: number, max: number) {
      return next() * (max - min) + min;
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(next() * arr.length)];
    },
    /** Elige n elementos distintos. */
    sample<T>(arr: readonly T[], n: number): T[] {
      const copy = [...arr];
      const out: T[] = [];
      while (out.length < n && copy.length) out.push(copy.splice(Math.floor(next() * copy.length), 1)[0]);
      return out;
    },
    chance(p: number) {
      return next() < p;
    },
  };
}
export type Random = ReturnType<typeof crearRandom>;

/** Crea un helper de fechas relativas a hoy. */
export function crearCalendario(hoy: Date) {
  const base = startOfDay(hoy);
  return {
    hoy: base,
    /** Fecha ISO a `offset` días de hoy (negativo = pasado) a la hora indicada. */
    dia(offset: number, hora = 10, minuto = 0): string {
      return setMinutes(setHours(addDays(base, offset), hora), minuto).toISOString();
    },
    /** Solo fecha (medianoche local) en ISO. */
    fecha(offset: number): string {
      return addDays(base, offset).toISOString();
    },
  };
}
export type Calendario = ReturnType<typeof crearCalendario>;

/** Redondea al múltiplo indicado. */
export function redondear(n: number, m = 10) {
  return Math.round(n / m) * m;
}
