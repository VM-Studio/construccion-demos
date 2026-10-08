"use client";

/**
 * Store de INTERFAZ (zustand): sesión visible, sucursal y unidad de negocio activas, sidebar,
 * favoritos, tour y modo capacitación. Los datos de negocio NO viven acá: se leen del servidor
 * (src/lib/datos) y toda escritura es una server action (src/server/actions).
 * Las acciones de negocio de este store son proxies asíncronos a esas server actions.
 */
import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ACCIONES_SERVIDOR } from "@/server/actions";
import { salir } from "@/server/actions/sesion";
import { aplicarResultadoPropio } from "@/lib/datos/proveedor";
import { obtenerDb } from "@/lib/datos/almacen";
import type { RespuestaAccion } from "@/server/actions/correr";
import { NOMBRES_EXPUESTOS, type NombreExpuesto } from "@/server/servicios/registro";
import type { AccionesNegocio } from "./negocio";
import type { UIState } from "./types";
import { CAPACITACION_INICIAL, crearSliceCapacitacion, persistirCapacitacion, type EstadoCapacitacion } from "@/capacitacion/slice";

export const STORAGE_KEY = "aceros-rnf-interfaz-v1";

const UI_INICIAL: UIState = {
  usuarioId: null,
  sucursalActivaId: null,
  unidadNegocioId: null,
  moduloActivo: null,
  sidebarColapsado: false,
  tourVisto: {},
  tourAbierto: false,
  favoritosModulos: {},
  favoritosPaginas: {},
  guiaOculta: {},
};

interface EstadoInterfaz {
  ui: UIState;
  hidratado: boolean;
  capacitacion: EstadoCapacitacion;
}

type SetUI = (p: Partial<EstadoInterfaz> | ((s: EstadoInterfaz) => Partial<EstadoInterfaz>)) => void;

/** Resultado de una acción de negocio: el de la regla de dominio, más los efectos medidos en el servidor. */
type ResultadoDe<N extends NombreExpuesto> = ReturnType<AccionesNegocio[N]> extends { ok: true; data: infer D } | { ok: false } ? RespuestaAccion<D> : RespuestaAccion;
export type AccionesCliente = { [N in NombreExpuesto]: (...args: Parameters<AccionesNegocio[N]>) => Promise<ResultadoDe<N>> };

/** Llama a la server action y, si salió bien, refresca lo que cambió antes de devolver. */
async function llamar(nombre: NombreExpuesto, args: unknown[]): Promise<RespuestaAccion> {
  const fn = (ACCIONES_SERVIDOR as unknown as Record<string, (...a: unknown[]) => Promise<RespuestaAccion>>)[nombre];
  try {
    const r = await fn(...args);
    if (r.ok) await aplicarResultadoPropio(r.tipos).catch(() => undefined);
    return r;
  } catch (e) {
    console.error(e);
    return { ok: false, error: "No hay conexión con el servidor. Revisá internet y probá de nuevo.", codigo: "RED" };
  }
}

const accionesNegocio = Object.fromEntries(NOMBRES_EXPUESTOS.map((n) => [n, (...args: unknown[]) => llamar(n, args)])) as unknown as AccionesCliente;

function crearAcciones(set: SetUI, get: () => EstadoInterfaz) {
  return {
    // ── sesión visible en la interfaz (la sesión real es la cookie del servidor) ──
    login: (usuarioId: string) => {
      const u = obtenerDb().usuarios.find((x) => x.id === usuarioId);
      set((s) => ({ ui: { ...s.ui, usuarioId, sucursalActivaId: u?.sucursalId ?? s.ui.sucursalActivaId } }));
    },
    logout: async () => {
      await salir();
      set((s) => ({ ui: { ...s.ui, usuarioId: null, tourAbierto: false } }));
    },
    setSucursalActiva: (sucursalActivaId: string | null) => set((s) => ({ ui: { ...s.ui, sucursalActivaId } })),
    setUnidadNegocio: (unidadNegocioId: string | null) => set((s) => ({ ui: { ...s.ui, unidadNegocioId } })),
    setModuloActivo: (moduloActivo: string | null) => set((s) => (s.ui.moduloActivo === moduloActivo ? {} : { ui: { ...s.ui, moduloActivo } })),
    toggleFavoritoModulo: (moduloId: string) =>
      set((s) => {
        const u = s.ui.usuarioId ?? "";
        const actual = s.ui.favoritosModulos[u] ?? [];
        const nuevo = actual.includes(moduloId) ? actual.filter((x) => x !== moduloId) : [...actual, moduloId];
        return { ui: { ...s.ui, favoritosModulos: { ...s.ui.favoritosModulos, [u]: nuevo } } };
      }),
    toggleFavoritoPagina: (href: string) =>
      set((s) => {
        const u = s.ui.usuarioId ?? "";
        const actual = s.ui.favoritosPaginas[u] ?? [];
        const nuevo = actual.includes(href) ? actual.filter((x) => x !== href) : [...actual, href];
        return { ui: { ...s.ui, favoritosPaginas: { ...s.ui.favoritosPaginas, [u]: nuevo } } };
      }),
    /** Oculta o vuelve a mostrar la guía de carga inicial para el usuario actual. */
    setGuiaOculta: (oculta: boolean) => set((s) => ({ ui: { ...s.ui, guiaOculta: { ...s.ui.guiaOculta, [s.ui.usuarioId ?? ""]: oculta } } })),
    toggleSidebar: () => set((s) => ({ ui: { ...s.ui, sidebarColapsado: !s.ui.sidebarColapsado } })),
    abrirTour: () => set((s) => ({ ui: { ...s.ui, tourAbierto: true } })),
    cerrarTour: () => set((s) => ({ ui: { ...s.ui, tourAbierto: false, tourVisto: { ...s.ui.tourVisto, [s.ui.usuarioId ?? ""]: true } } })),
    ...crearSliceCapacitacion(
      set as never,
      () => ({ ...get(), db: { usuarios: obtenerDb().usuarios } }) as never,
    ),
  };
}

export type Acciones = ReturnType<typeof crearAcciones> & AccionesCliente;
export type Store = EstadoInterfaz & Acciones;

export const useStore = create<Store>()(
  persist(
    (set, get) =>
      ({
        ui: UI_INICIAL,
        hidratado: false,
        capacitacion: CAPACITACION_INICIAL,
        ...accionesNegocio,
        ...crearAcciones(set as SetUI, get as () => EstadoInterfaz),
      }) as Store,
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Solo preferencias de interfaz: ningún dato de negocio se guarda en el navegador.
      partialize: (s) => ({ ui: { ...s.ui, tourAbierto: false, usuarioId: null }, capacitacion: persistirCapacitacion(s.capacitacion) }),
      merge: (persisted, current) => {
        const p = persisted as { ui?: Partial<UIState>; capacitacion?: Partial<EstadoCapacitacion> } | undefined;
        return { ...current, ui: { ...current.ui, ...(p?.ui ?? {}), usuarioId: current.ui.usuarioId }, capacitacion: { ...current.capacitacion, ...(p?.capacitacion ?? {}) } } as Store;
      },
    },
  ),
);

let hidratando = false;

/** Restaura las preferencias de interfaz (localStorage). Los datos llegan del servidor. */
export async function hidratarStore() {
  if (useStore.getState().hidratado || hidratando) return;
  hidratando = true;
  try {
    // Limpieza de la versión demo: los datos de negocio ya no se guardan en el navegador.
    localStorage.removeItem("cd-demo-v2");
    localStorage.removeItem("aceros-rnf-v1");
  } catch {}
  await useStore.persist.rehydrate();
  useStore.setState({ hidratado: true });
  hidratando = false;
}

/** true cuando las preferencias de interfaz ya se restauraron. */
export function useHydrated(): boolean {
  const hidratado = useSyncExternalStore(
    (cb) => useStore.subscribe(cb),
    () => useStore.getState().hidratado,
    () => false,
  );
  useEffect(() => {
    void hidratarStore();
  }, []);
  return hidratado;
}

/** Acceso a acciones sin suscribirse a cambios. */
export const acciones = () => useStore.getState();
