/**
 * Estado del modo capacitación dentro del store. Vive en su propia clave (`capacitacion`)
 * para poder quitarlo sin tocar el resto: el historial NO se persiste.
 */
import { puede } from "@/domain/permisos";
import type { Usuario } from "@/domain/types";

export interface CambioCampo {
  campo: string;
  antes: string;
  despues: string;
  /** Delta con signo y formato, ej. "+40", "−$ 39.314,80". */
  delta?: string;
  /** 1 sube, -1 baja, 0 cambia (estado). */
  signo: 1 | -1 | 0;
}

export interface Diferencia {
  /** Módulo: "Stock", "Acopio", "Tablero", "Documentos"… */
  grupo: string;
  /** Qué cambió: "Cemento Holcim x50 › Casa Central", "AC2 0001-00000001". */
  titulo: string;
  cambios: CambioCampo[];
  href?: string;
  /** Para el resumen de la sesión: tipo de entidad creada. */
  creado?: TipoCreado;
  /** Cantidad creada (cuando se agrupan varias altas iguales). */
  cantidad?: number;
}

export type TipoCreado =
  | "articulo"
  | "cliente"
  | "obra"
  | "proveedor"
  | "oc"
  | "ingreso"
  | "acopio"
  | "acopioProveedor"
  | "venta"
  | "cotizacion"
  | "remito"
  | "factura"
  | "cobro"
  | "pago"
  | "devolucion"
  | "despacho"
  | "transferencia"
  | "ajuste"
  | "vehiculo"
  | "chofer";

export interface Medicion {
  id: string;
  fecha: string;
  usuarioId: string;
  accionId: string;
  diferencias: Diferencia[];
}

export interface EstadoCapacitacion {
  /** Interruptor general (persistido). */
  modo: boolean;
  /** Ya se mostró el aviso de activación en esta sesión (no persistido). */
  avisado: boolean;
  /** Bloques <Impacto> colapsados, por acción (persistido). */
  colapsados: Record<string, boolean>;
  /** Banners de página cerrados, por ruta (persistido). */
  bannersCerrados: Record<string, boolean>;
  /** Mediciones de la sesión, más nuevas primero (máx. 50, no persistido). */
  historial: Medicion[];
  /** Panel "¿Qué pasó?" abierto. */
  panelAbierto: boolean;
}

export const CAPACITACION_INICIAL: EstadoCapacitacion = {
  // Activo por defecto (los dueños lo apagan desde Configuración); poner `false` para ocultarlo en todo el sistema.
  modo: true,
  avisado: false,
  colapsados: {},
  bannersCerrados: {},
  historial: [],
  panelAbierto: false,
};

export const MAX_HISTORIAL = 50;

/** Solo el dueño y administración prenden o apagan el modo capacitación. */
export function puedeCambiarModo(u: Usuario | undefined): boolean {
  return !!u && (u.rol === "DUENO" || u.rol === "ADMINISTRACION") && puede(u, "config.ver");
}

/** Lo que se persiste del modo capacitación (sin historial ni panel). */
export function persistirCapacitacion(c: EstadoCapacitacion) {
  return { modo: c.modo, colapsados: c.colapsados, bannersCerrados: c.bannersCerrados };
}

type StoreConCapacitacion = { capacitacion: EstadoCapacitacion; ui: { usuarioId: string | null }; db: { usuarios: Usuario[] } };
type Set = (fn: (s: StoreConCapacitacion) => { capacitacion: EstadoCapacitacion }) => void;
type Get = () => StoreConCapacitacion;

export function crearSliceCapacitacion(set: Set, get: Get) {
  const patch = (p: Partial<EstadoCapacitacion>) => set((s) => ({ capacitacion: { ...s.capacitacion, ...p } }));
  return {
    /** Prende o apaga el modo. Devuelve false si el usuario no tiene permiso. */
    setModoCapacitacion: (modo: boolean): boolean => {
      const { db, ui } = get();
      if (!puedeCambiarModo(db.usuarios.find((u) => u.id === ui.usuarioId))) return false;
      patch({ modo });
      return true;
    },
    marcarAvisoCapacitacion: () => patch({ avisado: true }),
    toggleImpactoColapsado: (accion: string) => set((s) => ({ capacitacion: { ...s.capacitacion, colapsados: { ...s.capacitacion.colapsados, [accion]: !s.capacitacion.colapsados[accion] } } })),
    cerrarBannerPagina: (ruta: string) => set((s) => ({ capacitacion: { ...s.capacitacion, bannersCerrados: { ...s.capacitacion.bannersCerrados, [ruta]: true } } })),
    registrarMedicion: (m: Medicion) => set((s) => ({ capacitacion: { ...s.capacitacion, historial: [m, ...s.capacitacion.historial].slice(0, MAX_HISTORIAL) } })),
    limpiarHistorial: () => patch({ historial: [] }),
    abrirPanelQuePaso: (abierto = true) => patch({ panelAbierto: abierto }),
  };
}
