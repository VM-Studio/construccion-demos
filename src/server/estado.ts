/**
 * Estado de negocio leído de la base, con caché en memoria de la instancia invalidada por la
 * versión global (máximo id de la tabla Cambio: toda escritura inserta una fila).
 * Si nadie escribió desde la última lectura, la instancia no vuelve a leer la base.
 * Movimientos de stock y auditoría NO se cargan acá (son insert-only y se leen paginados).
 */
import type { EstadoInicial } from "@/domain/types";
import { prisma } from "./db-base";
import { leerEstado, type Cliente } from "./datos/mapeo";

type Estado = { version: bigint; db: EstadoInicial };
const g = globalThis as unknown as { __estadoAceros?: Estado };

export async function versionActual(db: Cliente = prisma): Promise<bigint> {
  const r = await db.$queryRaw<{ v: bigint | null }[]>`SELECT MAX("id") AS v FROM "Cambio"`;
  return BigInt(r[0]?.v ?? 0);
}

/** Estado vigente (desde la caché si la versión no cambió). Lectura consistente: versión antes = después. */
export async function obtenerEstado(): Promise<Estado> {
  let v = await versionActual();
  if (g.__estadoAceros && g.__estadoAceros.version === v) return g.__estadoAceros;
  for (let i = 0; i < 4; i++) {
    const db = await leerEstado(prisma, { excluir: ["movimientos", "auditoria"], paralelo: true });
    const v2 = await versionActual();
    if (v2 === v) {
      g.__estadoAceros = { version: v, db };
      return g.__estadoAceros;
    }
    v = v2;
  }
  // Mucha escritura concurrente: lectura dentro de una transacción (instantánea consistente).
  return prisma.$transaction(async (tx) => {
    const version = await versionActual(tx);
    const db = await leerEstado(tx, { excluir: ["movimientos", "auditoria"] });
    g.__estadoAceros = { version, db };
    return g.__estadoAceros;
  }, { isolationLevel: "RepeatableRead", timeout: 60_000 });
}

/** Después de un commit propio: la caché pasa a la versión nueva sin releer la base. */
export function actualizarCache(version: bigint, db: EstadoInicial) {
  g.__estadoAceros = { version, db: { ...db, movimientos: [], auditoria: [] } };
}

export function invalidarCache() {
  g.__estadoAceros = undefined;
}
