"use client";

import * as React from "react";
import { useStore } from "./index";
import { useDb } from "@/lib/datos/almacen";
import type { Acopio, AcopioProveedor, Comprobante, EstadoInicial, NotaPedido, Producto } from "@/domain/types";
import { calcularRentabilidadPedido, type Rentabilidad } from "@/domain/ventas";
import { diasParaVencer, estadoDerivado, montoPendienteEntrega, pagadoAcopio, retiradoAcopio, saldoDisponible } from "@/domain/acopios";
import { deudaConProveedor, pendienteRetirar, retiradoAcopioProveedor, saldoDisponible as saldoACP } from "@/domain/acopiosProveedor";
import { estaVencido, esComprobanteDeuda } from "@/domain/cuentasCorrientes";
import { estadoStock, lineasPendientes, reservadoPorLinea, type EstadoStock } from "@/domain/stock";
import { puede, type Permiso } from "@/domain/permisos";
import { BRAND } from "@/config/brand";
import { acopiosProveedorResumenDe, acopiosResumenDe, hoyKey, indice, posicionesDe, selectPendientes, selectRentabilidadNP, selectSaldosClientes, selectSaldosProveedores } from "./calculos";

export * from "./calculos";

/** Datos de negocio vigentes (servidor, sincronizados en vivo). */
export { useDb } from "@/lib/datos/almacen";

export function useUsuario() {
  const usuarioId = useStore((s) => s.ui.usuarioId);
  const usuarios = useDb().usuarios;
  return usuarios.find((u) => u.id === usuarioId);
}

export function usePuede(permiso: Permiso): boolean {
  return puede(useUsuario(), permiso);
}

export function useSucursalActiva(): string | null {
  return useStore((s) => s.ui.sucursalActivaId);
}

export function useUnidadNegocio(): string | null {
  return useStore((s) => s.ui.unidadNegocioId);
}

/** Depósito correspondiente a la sucursal activa (o null = todos). */
export function useDepositoActivo(): string | null {
  const suc = useSucursalActiva();
  const sucursales = useDb().sucursales;
  return suc ? (sucursales.find((s) => s.id === suc)?.depositoId ?? null) : null;
}

export function useEmpresa() {
  const e = useDb().config.empresa;
  return { ...e, empresa: e.empresa || BRAND.empresa };
}

/** ¿El usuario puede ver documentos de circuito 2? */
export function useVeCircuito2(): boolean {
  return usePuede("circuito2.ver");
}

/** Filtro global para métricas y reportes: sucursal, unidad de negocio y circuito 2. */
export function useFiltroMetricas(): { sucursalId: string | null; unidadNegocioId: string | null; circuito2: boolean } {
  const sucursalId = useSucursalActiva();
  const unidadNegocioId = useUnidadNegocio();
  const circuito2 = useVeCircuito2();
  return React.useMemo(() => ({ sucursalId, unidadNegocioId, circuito2 }), [sucursalId, unidadNegocioId, circuito2]);
}

export function usePosiciones() {
  return posicionesDe(useDb());
}

export function useSaldosClientes() {
  const comprobantes = useDb().comprobantes;
  return selectSaldosClientes(comprobantes, hoyKey());
}

export function useSaldosProveedores() {
  const comprobantes = useDb().comprobantes;
  return selectSaldosProveedores(comprobantes, hoyKey());
}

export function useRentabilidadNP() {
  return selectRentabilidadNP(useDb().notasPedido);
}

export function usePendientes() {
  const notas = useDb().notasPedido;
  const remitos = useDb().remitos;
  return selectPendientes(notas, remitos);
}

export function useAcopiosResumen() {
  return acopiosResumenDe(useDb());
}

export function useAcopiosProveedorResumen() {
  return acopiosProveedorResumenDe(useDb());
}

export function useIndice<K extends keyof EstadoInicial>(k: K) {
  const items = useDb()[k] as unknown as { id: string }[];
  return indice(items) as Map<string, EstadoInicial[K] extends Array<infer U> ? U : never>;
}
