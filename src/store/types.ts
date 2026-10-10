import type { EstadoInicial } from "@/domain/types";
import type { EstadoCapacitacion } from "@/capacitacion/slice";

export interface UIState {
  usuarioId: string | null;
  sucursalActivaId: string | null;
  /** Unidad de negocio activa (null = todas). */
  unidadNegocioId: string | null;
  /** Último módulo elegido (desambigua páginas compartidas entre módulos). */
  moduloActivo: string | null;
  /** Módulos favoritos por usuario (se muestran primero en /inicio). */
  favoritosModulos: Record<string, string[]>;
  /** Páginas favoritas (href) por usuario. */
  favoritosPaginas: Record<string, string[]>;
  sidebarColapsado: boolean;
  /** Usuarios que ya vieron el tour guiado. */
  tourVisto: Record<string, boolean>;
  tourAbierto: boolean;
  /** Usuarios que ocultaron la guía de carga inicial ("No mostrar más"). */
  guiaOculta: Record<string, boolean>;
  /** Carga de artículos: último rubro/proveedor usados y "campos a cambiar siempre" al duplicar (por usuario). */
  cargaArticulos?: { ultimoRubroId?: string; ultimoProveedorId?: string; camposSiempre?: Record<string, CampoDuplicar[]> };
}

/** Campos que quedan vacíos y resaltados al abrir un artículo duplicado. */
export type CampoDuplicar = "nombre" | "pesoKg" | "costoUltimo" | "precios";

export type Resultado<T = void> = { ok: true; data: T; mensaje?: string } | { ok: false; error: string; codigo?: string };

export interface StoreBase {
  db: EstadoInicial;
  ui: UIState;
  hidratado: boolean;
  /** Modo capacitación (aislado en src/capacitacion). */
  capacitacion: EstadoCapacitacion;
}

export type SetFn = (partial: Partial<StoreBase> | ((s: StoreBase) => Partial<StoreBase>)) => void;
export type GetFn = () => StoreBase;
