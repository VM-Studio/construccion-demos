"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { EstadoInicial } from "@/domain/types";
import { crearSeed } from "@/data/seed";
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

export const STORAGE_KEY = "cd-demo-v1";

/** Estado vacío para el primer render (antes de hidratar desde localStorage). */
function estadoVacio(): EstadoInicial {
  return {
    sucursales: [], depositos: [], usuarios: [], rubros: [], proveedores: [], productos: [], listasPrecios: [], precios: [],
    stock: [], movimientos: [], transferencias: [], ajustes: [], ordenesCompra: [], recepciones: [], clientes: [], presupuestos: [],
    pedidos: [], comprobantes: [], acopios: [], retiros: [], vehiculos: [], choferes: [], despachos: [], hojasRuta: [], cobranzas: [],
    pagosProveedores: [], cheques: [], auditoria: [],
    config: { ivaPct: 21, validezPresupuestoDias: 7, diasVencimientoAcopio: 180, alertaStockMinimo: true, umbralSubaCostoPct: 3, motivosAjuste: [], empresa: { empresa: "", razonSocial: "", cuit: "", direccion: "", telefono: "", email: "" } },
    numeradores: { OC: 0, PRE: 0, PED: 0, ACO: 0, RET: 0, REM: 0, REC: 0, OP: 0, TRF: 0, AJU: 0, RCP: 0, fiscal: {} },
  };
}

const UI_INICIAL: UIState = { usuarioId: null, sucursalActivaId: null, sidebarColapsado: false, tourVisto: {}, tourAbierto: false };

function crearAcciones(set: (p: Partial<StoreBase> | ((s: StoreBase) => Partial<StoreBase>)) => void, get: () => StoreBase) {
  return {
    // ── auth ──
    login: (usuarioId: string) => {
      const u = get().db.usuarios.find((x) => x.id === usuarioId);
      set((s) => ({ ui: { ...s.ui, usuarioId, sucursalActivaId: u?.sucursalId ?? null } }));
    },
    logout: () => set((s) => ({ ui: { ...s.ui, usuarioId: null, tourAbierto: false } })),
    setSucursalActiva: (sucursalActivaId: string | null) => set((s) => ({ ui: { ...s.ui, sucursalActivaId } })),
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
      version: 1,
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
  if (!db.productos.length) useStore.setState({ db: crearSeed(new Date()) });
  useStore.setState({ hidratado: true });
  hidratando = false;
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
