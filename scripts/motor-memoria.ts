/**
 * Motor en memoria para los chequeos de flujos: las MISMAS acciones de negocio que corre el
 * servidor (src/store/negocio.ts), aplicadas sobre un estado en memoria, con un usuario actual.
 */
import type { EstadoInicial } from "../src/domain/types";
import { crearAccionesNegocio, type AccionesNegocio } from "../src/store/negocio";
import { CAPACITACION_INICIAL } from "../src/capacitacion/slice";
import type { StoreBase } from "../src/store/types";

export function crearMotorMemoria(inicial: EstadoInicial) {
  const st: StoreBase = {
    db: inicial,
    ui: { usuarioId: null, sucursalActivaId: null, unidadNegocioId: null, moduloActivo: null, favoritosModulos: {}, favoritosPaginas: {}, sidebarColapsado: false, tourVisto: {}, tourAbierto: false, guiaOculta: {} },
    hidratado: true,
    capacitacion: CAPACITACION_INICIAL,
  };
  const acciones = crearAccionesNegocio(
    (p) => Object.assign(st, typeof p === "function" ? p(st) : p),
    () => st,
  );
  const api = {
    ...acciones,
    get db() {
      return st.db;
    },
    get ui() {
      return st.ui;
    },
    login(usuarioId: string) {
      st.ui = { ...st.ui, usuarioId };
    },
    setDb(db: EstadoInicial) {
      st.db = db;
    },
  };
  return api as typeof api & AccionesNegocio;
}
