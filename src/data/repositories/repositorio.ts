import type { Entidad, EstadoInicial } from "@/domain/types";
import { useStore } from "@/store";
import { newId } from "@/lib/utils";

/** Filtro simple por igualdad de campos o predicado. */
export type Filtro<T> = Partial<T> | ((item: T) => boolean);

/**
 * Contrato de acceso a datos. Las pantallas y el store dependen de esta interfaz,
 * no del almacenamiento concreto.
 */
export interface Repositorio<T extends Entidad> {
  listar(filtro?: Filtro<T>): T[];
  obtener(id: string): T | undefined;
  crear(data: Omit<T, "id" | "creadoEn" | "actualizadoEn">): T;
  actualizar(id: string, patch: Partial<Omit<T, "id" | "creadoEn">>): T;
  eliminar(id: string): void;
}

type ColeccionDe<T> = {
  [K in keyof EstadoInicial]: EstadoInicial[K] extends T[] ? K : never;
}[keyof EstadoInicial];

// Reemplazar por implementación Prisma en producción.
/**
 * Implementación en memoria sobre el store de Zustand (persistido en localStorage).
 * Para operaciones de negocio (confirmar pedido, recibir mercadería…) usar las
 * acciones del store, que aplican reglas, movimientos de stock y auditoría.
 */
export class RepositorioMemoria<T extends Entidad> implements Repositorio<T> {
  constructor(
    private readonly coleccion: ColeccionDe<T>,
    private readonly prefijo: string,
  ) {}

  private items(): T[] {
    return useStore.getState().db[this.coleccion] as unknown as T[];
  }

  private escribir(items: T[]) {
    useStore.setState((s) => ({ db: { ...s.db, [this.coleccion]: items } }));
  }

  listar(filtro?: Filtro<T>): T[] {
    const items = this.items();
    if (!filtro) return items;
    if (typeof filtro === "function") return items.filter(filtro);
    const entries = Object.entries(filtro) as [keyof T, unknown][];
    return items.filter((i) => entries.every(([k, v]) => i[k] === v));
  }

  obtener(id: string): T | undefined {
    return this.items().find((i) => i.id === id);
  }

  crear(data: Omit<T, "id" | "creadoEn" | "actualizadoEn">): T {
    const ahora = new Date().toISOString();
    const nuevo = { ...data, id: newId(this.prefijo), creadoEn: ahora, actualizadoEn: ahora } as T;
    this.escribir([...this.items(), nuevo]);
    return nuevo;
  }

  actualizar(id: string, patch: Partial<Omit<T, "id" | "creadoEn">>): T {
    const items = this.items();
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) throw new Error(`No existe ${String(this.coleccion)} ${id}`);
    const actualizado = { ...items[i], ...patch, actualizadoEn: new Date().toISOString() } as T;
    const copia = [...items];
    copia[i] = actualizado;
    this.escribir(copia);
    return actualizado;
  }

  eliminar(id: string): void {
    this.escribir(this.items().filter((i) => i.id !== id));
  }
}
