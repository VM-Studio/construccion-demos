/**
 * Decimal en la base, number solo en presentación. Prisma devuelve `Prisma.Decimal`
 * (decimal.js); la capa de datos lo convierte con estas funciones al pasar al dominio.
 */
export interface DecimalLike {
  toNumber(): number;
  toString(): string;
}

export function esDecimal(v: unknown): v is DecimalLike {
  return !!v && typeof v === "object" && typeof (v as DecimalLike).toNumber === "function" && "d" in (v as object) && "e" in (v as object);
}

/** Decimal | number | string → number (para cálculos de presentación y el dominio). */
export function aNumero(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (esDecimal(v)) return v.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
