"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { EstadoInicial } from "@/domain/types";
import { configInicial, seedBase } from "@/data/seed";
import { ejecutar } from "./helpers";
import type { StoreBase, UIState } from "./types";
import { crearSliceCatalogo } from "./slices/catalogo";
import { crearSliceStock } from "./slices/stock";
import { crearSliceCompras } from "./slices/compras";
import { crearSliceVentas } from "./slices/ventas";
import { crearSliceAcopios } from "./slices/acopios";
import { crearSliceDespachos } from "./slices/despachos";
import { crearSliceFinanzas } from "./slices/finanzas";
import { crearSliceConfig } from "./slices/config";
import { crearSliceRemitos } from "./slices/remitos";
import { crearSliceImportacion } from "./slices/importacion";
import { CAPACITACION_INICIAL, crearSliceCapacitacion, persistirCapacitacion, type EstadoCapacitacion } from "@/capacitacion/slice";

export const STORAGE_KEY = "cd-demo-v2";

/** Estado vacío para el primer render (antes de hidratar desde localStorage). */
function estadoVacio(): EstadoInicial {
  return {
    sucursales: [], depositos: [], usuarios: [], unidadesNegocio: [], rubros: [], proveedores: [], productos: [], listasPrecios: [], precios: [],
    stock: [], movimientos: [], transferencias: [], ajustes: [], ordenesCompra: [], recepciones: [], acopiosProveedor: [], clientes: [], obras: [],
    cotizaciones: [], notasPedido: [], devoluciones: [], ajustesAcopio: [], acopios: [], remitos: [], adjuntos: [], comprobantes: [], vehiculos: [],
    choferes: [], despachos: [], hojasRuta: [], cobranzas: [], pagosProveedores: [], cheques: [], auditoria: [],
    config: configInicial(),
    numeradores: {},
  };
}

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

function crearAcciones(set: (p: Partial<StoreBase> | ((s: StoreBase) => Partial<StoreBase>)) => void, get: () => StoreBase) {
  return {
    // ── auth ──
    login: (usuarioId: string) => {
      const u = get().db.usuarios.find((x) => x.id === usuarioId);
      set((s) => ({ ui: { ...s.ui, usuarioId, sucursalActivaId: u?.sucursalId ?? null } }));
    },
    logout: () => set((s) => ({ ui: { ...s.ui, usuarioId: null, tourAbierto: false } })),
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

    // ── auditoría (eventos sólo de UI: impresiones, envíos por email demo) ──
    registrarEvento: (accion: string, entidad: string, entidadId: string, detalle = "") =>
      ejecutar(get, set, (tx) => tx.auditar(accion, entidad, entidadId, detalle)),

    ...crearSliceCatalogo(set, get),
    ...crearSliceStock(set, get),
    ...crearSliceCompras(set, get),
    ...crearSliceVentas(set, get),
    ...crearSliceAcopios(set, get),
    ...crearSliceDespachos(set, get),
    ...crearSliceFinanzas(set, get),
    ...crearSliceConfig(set, get),
    ...crearSliceRemitos(set, get),
    ...crearSliceImportacion(set, get),
    ...crearSliceCapacitacion(set, get),
  };
}

export type Acciones = ReturnType<typeof crearAcciones>;
export type Store = StoreBase & Acciones;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      db: estadoVacio(),
      ui: UI_INICIAL,
      hidratado: false,
      capacitacion: CAPACITACION_INICIAL,
      ...crearAcciones(set, get),
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ db: s.db, ui: { ...s.ui, tourAbierto: false }, capacitacion: persistirCapacitacion(s.capacitacion) }),
      merge: (persisted, current) => {
        const p = persisted as (Omit<Partial<StoreBase>, "capacitacion"> & { capacitacion?: Partial<EstadoCapacitacion> }) | undefined;
        // Un db guardado sin estructura (versión vieja o reseteo) se descarta y se regenera la base.
        const valido = !!p?.db?.unidadesNegocio?.length && !!p.db.usuarios?.length && !!p.db.sucursales?.length && !!p.db.config;
        return { ...current, db: valido ? p!.db! : current.db, ui: { ...current.ui, ...(p?.ui ?? {}) }, capacitacion: { ...current.capacitacion, ...(p?.capacitacion ?? {}) } };
      },
    },
  ),
);

let hidratando = false;

/** Hidrata el store desde localStorage (o crea la estructura base la primera vez). Llamar una vez en el cliente. */
export async function hidratarStore() {
  if (useStore.getState().hidratado || hidratando) return;
  hidratando = true;
  await useStore.persist.rehydrate();
  const { db } = useStore.getState();
  if (!db.unidadesNegocio?.length || !db.usuarios?.length) useStore.setState({ db: seedBase(new Date()) });
  useStore.setState({ hidratado: true });
  hidratando = false;
  // Los remitos firmados de los datos de ejemplo se generan en runtime (jsPDF) y se guardan en IndexedDB.
  if (useStore.getState().db.adjuntos.length) void import("@/lib/adjuntos").then((m) => m.asegurarAdjuntosDemo()).catch(() => undefined);
}

/** true cuando el store ya se hidrató (evita mismatch SSR / flash de login). */
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
