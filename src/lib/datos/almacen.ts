"use client";
/**
 * Datos de negocio en el navegador: un espejo de SOLO LECTURA de lo que devuelve el servidor
 * (ya filtrado por rol). No es el store de zustand: cada colección llega por /api/datos y se
 * reemplaza entera cuando el servidor avisa que cambió. Nunca se escribe acá desde la interfaz.
 */
import { useSyncExternalStore } from "react";
import type { EstadoInicial } from "@/domain/types";
import { configInicial } from "@/data/seed/config";

export function estadoVacio(): EstadoInicial {
  return {
    sucursales: [], depositos: [], usuarios: [], unidadesNegocio: [], rubros: [], proveedores: [], productos: [], listasPrecios: [], precios: [],
    stock: [], movimientos: [], transferencias: [], ajustes: [], ordenesCompra: [], recepciones: [], acopiosProveedor: [], clientes: [], obras: [],
    cotizaciones: [], notasPedido: [], devoluciones: [], ajustesAcopio: [], acopios: [], remitos: [], adjuntos: [], comprobantes: [], vehiculos: [],
    choferes: [], despachos: [], hojasRuta: [], cobranzas: [], pagosProveedores: [], cheques: [], auditoria: [],
    config: configInicial(),
    numeradores: {},
  };
}

let estado: EstadoInicial = estadoVacio();
let cargado = false;
const oyentes = new Set<() => void>();

export function establecerDatos(parcial: Partial<EstadoInicial>) {
  let cambio = false;
  const nuevo = { ...estado } as Record<string, unknown>;
  for (const [k, v] of Object.entries(parcial)) {
    if (v === undefined || (estado as unknown as Record<string, unknown>)[k] === v) continue;
    nuevo[k] = v;
    cambio = true;
  }
  if (!cambio && cargado) return;
  estado = nuevo as unknown as EstadoInicial;
  cargado = true;
  for (const o of oyentes) o();
}

const suscribir = (cb: () => void) => {
  oyentes.add(cb);
  return () => void oyentes.delete(cb);
};

/** Datos de negocio vigentes (se actualizan solos con los cambios de todos los usuarios). */
export function useDb(): EstadoInicial {
  return useSyncExternalStore(suscribir, () => estado, () => estado);
}

/** Lectura fuera de React (después de una acción, para leer lo recién creado). */
export function obtenerDb(): EstadoInicial {
  return estado;
}

export function datosCargados(): boolean {
  return cargado;
}
