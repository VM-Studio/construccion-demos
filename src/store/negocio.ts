/**
 * Acciones de negocio (todas las reglas de escritura), sin React ni zustand.
 * En el sistema real corren en el servidor (src/server/motor.ts) sobre el estado leído de la
 * base dentro de una transacción; los scripts de pruebas las corren sobre un estado en memoria.
 */
import { ejecutar } from "./helpers";
import type { GetFn, SetFn } from "./types";
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

export function crearAccionesNegocio(set: SetFn, get: GetFn) {
  return {
    /** Eventos de interfaz que quedan en la auditoría (impresiones, envíos por email demo). */
    registrarEvento: (accion: string, entidad: string, entidadId: string, detalle = "") => ejecutar(get, set, (tx) => tx.auditar(accion, entidad, entidadId, detalle)),
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
  };
}

export type AccionesNegocio = ReturnType<typeof crearAccionesNegocio>;
export type NombreAccion = { [K in keyof AccionesNegocio]: AccionesNegocio[K] extends (...a: never[]) => unknown ? K : never }[keyof AccionesNegocio];
