/**
 * Cambios por fila: en lugar de reenviar colecciones enteras, el servidor manda solo las filas que
 * cambiaron (ya filtradas por rol) y los ids que dejaron de existir o de ser visibles. Lo usan la
 * respuesta de cada acción y la sincronización con los demás usuarios.
 */
export interface Delta {
  version: string;
  /** Filas nuevas o modificadas, por colección. */
  filas: Record<string, { id: string }[]>;
  /** Ids a quitar, por colección (si el navegador no la tiene, se ignora). */
  bajas: Record<string, string[]>;
  /** Colecciones que viajan enteras (config, numeradores o cambios masivos). */
  completas: Record<string, unknown>;
}

/** Colecciones que toca un delta (para refrescar SWR). */
export function coleccionesDelDelta(d: Delta): string[] {
  return [...new Set([...Object.keys(d.filas), ...Object.keys(d.bajas), ...Object.keys(d.completas)])];
}

/** Reemplaza las filas que cambiaron, agrega las nuevas al final y saca las bajas. */
export function fusionar<T extends { id: string }>(actual: T[], filas: T[] = [], bajas: string[] = []): T[] {
  if (!filas.length && !bajas.length) return actual;
  const porId = new Map(filas.map((x) => [x.id, x]));
  const fuera = new Set(bajas);
  let cambio = false;
  const quedan: T[] = [];
  for (const x of actual) {
    if (fuera.has(x.id) && !porId.has(x.id)) {
      cambio = true;
      continue;
    }
    const nueva = porId.get(x.id);
    if (nueva) {
      porId.delete(x.id);
      cambio = true;
      quedan.push(nueva);
    } else quedan.push(x);
  }
  for (const x of porId.values()) {
    quedan.push(x);
    cambio = true;
  }
  return cambio ? quedan : actual;
}
