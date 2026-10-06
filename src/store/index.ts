"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { EstadoInicial } from "@/domain/types";
import { configInicial, crearSeed } from "@/data/seed";
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

export const STORAGE_KEY = "aceros-rnf-v1";

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
      ...crearAcciones(set, get),
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ db: s.db, ui: { ...s.ui, tourAbierto: false } }),
      merge: (persisted, current) => {
        const p = persisted as Partial<StoreBase> | undefined;
        return { ...current, db: p?.db ?? current.db, ui: { ...current.ui, ...(p?.ui ?? {}) } };
      },
    },
  ),
);

let hidratando = false;

/** Hidrata el store desde localStorage (o crea el seed la primera vez). Llamar una vez en el cliente. */
export async function hidratarStore() {
  if (useStore.getState().hidratado || hidratando) return;
  hidratando = true;
  await useStore.persist.rehydrate();
  const { db } = useStore.getState();
  if (!db.productos.length || !db.unidadesNegocio?.length) useStore.setState({ db: crearSeed(new Date()) });
  useStore.setState({ hidratado: true });
  hidratando = false;
  // Los remitos firmados de ejemplo se generan en runtime (jsPDF) y se guardan en IndexedDB.
  void import("@/lib/adjuntos").then((m) => m.asegurarAdjuntosDemo()).catch(() => undefined);
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
