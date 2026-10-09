/**
 * Estado de negocio leído de la base, con caché en memoria de la instancia invalidada por la
 * versión global (máximo id de la tabla Cambio: toda escritura inserta una fila).
 * Si nadie escribió desde la última lectura, la instancia no vuelve a leer la base.
 * Movimientos de stock y auditoría NO se cargan acá (son insert-only y se leen paginados).
 */
import type { EstadoInicial } from "@/domain/types";
import { prisma } from "./db-base";
import { leerColeccion, leerConfig, leerEstado, leerNumeradores, MODELOS, type Cliente, type Coleccion } from "./datos/mapeo";

type Estado = { version: bigint; db: EstadoInicial };
const g = globalThis as unknown as { __estadoAceros?: Estado };

export async function versionActual(db: Cliente = prisma): Promise<bigint> {
  const r = await db.$queryRaw<{ v: bigint | null }[]>`SELECT MAX("id") AS v FROM "Cambio"`;
  return BigInt(r[0]?.v ?? 0);
}

const COLECCION_DE_MODELO = new Map(Object.entries(MODELOS).map(([c, m]) => [m as string, c as Coleccion]));

/**
 * Actualización incremental: solo se releen las tablas que tocaron los cambios publicados
 * desde la versión en caché (en vez de toda la base).
 */
async function refrescarIncremental(previo: Estado, v: bigint): Promise<Estado | null> {
  const filas = await prisma.$queryRaw<{ tipos: string[] }[]>`SELECT "tipos" FROM "Cambio" WHERE "id" > ${previo.version} AND "id" <= ${v} ORDER BY "id" LIMIT 1000`;
  if (filas.length >= 1000) return null;
  const tipos = new Set(filas.flatMap((f) => f.tipos));
  const cols = [...new Set([...tipos].map((t) => COLECCION_DE_MODELO.get(t)).filter((c): c is Coleccion => !!c && c !== "movimientos" && c !== "auditoria"))];
  const [valores, config, numeradores] = await Promise.all([
    Promise.all(cols.map((c) => leerColeccion(prisma, c))),
    tipos.has("Configuracion") ? leerConfig(prisma) : Promise.resolve(previo.db.config),
    tipos.has("Contador") ? leerNumeradores(prisma) : Promise.resolve(previo.db.numeradores),
  ]);
  const db = { ...previo.db, config, numeradores } as EstadoInicial;
  cols.forEach((c, i) => ((db as unknown as Record<string, unknown>)[c] = valores[i]));
  if ((await versionActual()) !== v) return null;
  return { version: v, db };
}

/** Estado vigente (desde la caché si la versión no cambió). Lectura consistente: versión antes = después. */
export async function obtenerEstado(): Promise<Estado> {
  let v = await versionActual();
  if (g.__estadoAceros && g.__estadoAceros.version === v) return g.__estadoAceros;
  if (g.__estadoAceros && g.__estadoAceros.version < v) {
    const inc = await refrescarIncremental(g.__estadoAceros, v).catch(() => null);
    if (inc) return (g.__estadoAceros = inc);
    v = await versionActual();
  }
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

/** Estado en caché de esta instancia, sin verificar versión (solo para lecturas livianas). */
export function estadoEnCache(): Estado | undefined {
  return g.__estadoAceros;
}

export function invalidarCache() {
  g.__estadoAceros = undefined;
}
