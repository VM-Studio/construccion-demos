import type { EstadoInicial, Usuario } from "@/domain/types";
import { puede, type Permiso } from "@/domain/permisos";
import { Tx } from "./tx";
import type { GetFn, Resultado, SetFn } from "./types";

/** Error de regla de negocio: se muestra al usuario tal cual. */
export class ErrorNegocio extends Error {
  constructor(
    mensaje: string,
    readonly codigo?: string,
  ) {
    super(mensaje);
  }
}

export function usuarioActual(get: GetFn): Usuario | undefined {
  const { db, ui } = get();
  return db.usuarios.find((u) => u.id === ui.usuarioId);
}

/** Lanza si el usuario actual no tiene el permiso. */
export function exigir(tx: Tx, permiso: Permiso) {
  const u = tx.find("usuarios", tx.usuarioId);
  if (!puede(u, permiso)) throw new ErrorNegocio("No tenés permiso para realizar esta acción.", "PERMISO");
}

/**
 * Ejecuta una acción de negocio dentro de una transacción.
 * Si la función lanza, no se aplica ningún cambio y se devuelve el error.
 */
export function ejecutar<T>(get: GetFn, set: SetFn, fn: (tx: Tx) => T): Resultado<T> {
  const { db, ui } = get();
  const tx = new Tx(db, ui.usuarioId ?? "sistema");
  try {
    const data = fn(tx);
    set({ db: tx.commit() });
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ErrorNegocio) return { ok: false, error: e.message, ...(e.codigo ? { codigo: e.codigo } : {}) } as Resultado<T>;
    console.warn(e);
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

export type DB = EstadoInicial;

export function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
