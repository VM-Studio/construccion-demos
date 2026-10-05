import type { EstadoInicial } from "@/domain/types";

export interface UIState {
  usuarioId: string | null;
  sucursalActivaId: string | null;
  sidebarColapsado: boolean;
  /** Usuarios que ya vieron el tour guiado. */
  tourVisto: Record<string, boolean>;
  tourAbierto: boolean;
}

export type Resultado<T = void> = { ok: true; data: T; mensaje?: string } | { ok: false; error: string; codigo?: string };

export interface StoreBase {
  db: EstadoInicial;
  ui: UIState;
  hidratado: boolean;
}

export type SetFn = (partial: Partial<StoreBase> | ((s: StoreBase) => Partial<StoreBase>)) => void;
export type GetFn = () => StoreBase;
