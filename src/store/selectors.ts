"use client";

import * as React from "react";
import { useStore } from "./index";
import type { Acopio, AcopioProveedor, Comprobante, EstadoInicial, NotaPedido, Producto } from "@/domain/types";
import { calcularRentabilidadPedido, type Rentabilidad } from "@/domain/ventas";
import { diasParaVencer, estadoDerivado, montoPendienteEntrega, pagadoAcopio, retiradoAcopio, saldoDisponible } from "@/domain/acopios";
import { deudaConProveedor, pendienteRetirar, retiradoAcopioProveedor, saldoDisponible as saldoACP } from "@/domain/acopiosProveedor";
import { estaVencido, esComprobanteDeuda } from "@/domain/cuentasCorrientes";
import { estadoStock, lineasPendientes, reservadoPorLinea, type EstadoStock } from "@/domain/stock";
import { puede, type Permiso } from "@/domain/permisos";
import { BRAND } from "@/config/brand";

// ───────────────────────── Memoización ─────────────────────────

/** Memoiza por identidad de argumentos (última llamada). */
export function memo<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let lastArgs: A | null = null;
  let last: R;
  return (...args: A) => {
    if (lastArgs && lastArgs.length === args.length && lastArgs.every((a, i) => Object.is(a, args[i]))) return last;
    lastArgs = args;
    last = fn(...args);
    return last;
  };
}

// ───────────────────────── Sesión ─────────────────────────

export function useDb() {
  return useStore((s) => s.db);
}

export function useUsuario() {
  const usuarioId = useStore((s) => s.ui.usuarioId);
  const usuarios = useStore((s) => s.db.usuarios);
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
  const sucursales = useStore((s) => s.db.sucursales);
  return suc ? (sucursales.find((s) => s.id === suc)?.depositoId ?? null) : null;
}

export function useEmpresa() {
  const e = useStore((s) => s.db.config.empresa);
  return { ...e, empresa: e.empresa || BRAND.empresa };
}

/** Filtra por sucursal activa (si hay). */
export function filtrarSucursal<T extends { sucursalId?: string }>(items: T[], sucursalId: string | null): T[] {
  return sucursalId ? items.filter((i) => i.sucursalId === sucursalId) : items;
}

/** ¿El usuario puede ver documentos de circuito 2? */
export function useVeCircuito2(): boolean {
  return usePuede("circuito2.ver");
}

/** Quita lo de circuito 2 si el usuario no tiene el permiso "ver circuito 2". */
export function filtrarCircuito<T extends { circuito?: 1 | 2 }>(items: T[], veC2: boolean): T[] {
  return veC2 ? items : items.filter((i) => i.circuito !== 2);
}

/** Filtro global para métricas y reportes: sucursal, unidad de negocio y circuito 2. */
export function useFiltroMetricas(): { sucursalId: string | null; unidadNegocioId: string | null; circuito2: boolean } {
  const sucursalId = useSucursalActiva();
  const unidadNegocioId = useUnidadNegocio();
  const circuito2 = useVeCircuito2();
  return React.useMemo(() => ({ sucursalId, unidadNegocioId, circuito2 }), [sucursalId, unidadNegocioId, circuito2]);
}

/** Productos de la unidad de negocio activa. */
export function filtrarUN<T extends { unidadNegocioId?: string }>(items: T[], un: string | null): T[] {
  return un ? items.filter((i) => i.unidadNegocioId === un) : items;
}

// ───────────────────────── Stock ─────────────────────────

export interface PosicionDeposito {
  fisico: number;
  /** Vendido o retirado de acopio y todavía no remitido. */
  pendiente: number;
  /** En remitos en picking. */
  reservado: number;
  /** Físico − pendiente − reservado. */
  disponible: number;
  enTransito: number;
  /** pendiente + reservado (compatibilidad). */
  comprometido: number;
}

export interface PosicionProducto {
  producto: Producto;
  porDeposito: Record<string, PosicionDeposito>;
  fisico: number;
  pendiente: number;
  reservado: number;
  comprometido: number;
  disponible: number;
  enTransito: number;
  /** En viaje entre depósitos (transferencias despachadas sin recibir). */
  enTransferencia: number;
  estado: EstadoStock;
  valorizado: number;
}

const VACIA: PosicionDeposito = { fisico: 0, pendiente: 0, reservado: 0, disponible: 0, enTransito: 0, comprometido: 0 };

/** Posición de stock de todos los productos por depósito. */
export const selectPosiciones = memo(
  (
    productos: EstadoInicial["productos"],
    depositos: EstadoInicial["depositos"],
    stock: EstadoInicial["stock"],
    notasPedido: EstadoInicial["notasPedido"],
    remitos: EstadoInicial["remitos"],
    ordenesCompra: EstadoInicial["ordenesCompra"],
    acopiosProveedor: EstadoInicial["acopiosProveedor"],
    transferencias: EstadoInicial["transferencias"],
  ): Map<string, PosicionProducto> => {
    const k = (p: string, d: string) => `${p}|${d}`;
    const add = (m: Map<string, number>, key: string, q: number) => m.set(key, (m.get(key) ?? 0) + q);
    const fis = new Map<string, number>();
    for (const s of stock) fis.set(k(s.productoId, s.depositoId), s.cantidadFisica);
    const pend = new Map<string, number>();
    for (const l of lineasPendientes(notasPedido, remitos)) add(pend, k(l.productoId, l.depositoId), l.pendiente);
    const res = new Map<string, number>();
    for (const r of remitos) if (r.estado === "PICKING" && (r.tipo === "VENTA" || r.tipo === "DESACOPIO")) for (const it of r.items) add(res, k(it.productoId, r.depositoId), it.cantidad);
    const trans = new Map<string, number>();
    for (const oc of ordenesCompra)
      if (oc.estado === "CONFIRMADA" || oc.estado === "RECIBIDA_PARCIAL")
        for (const it of oc.items) add(trans, k(it.productoId, oc.depositoDestinoId), Math.max(0, it.cantidadPedida - it.cantidadRecibida));
    // Acopios con proveedores por cantidad: lo pactado que todavía no se pidió también "viene en camino".
    for (const a of acopiosProveedor) {
      if (a.modalidad !== "CANTIDAD" || a.estado === "CANCELADO") continue;
      for (const it of a.items ?? []) {
        const pedido = ordenesCompra.filter((o) => o.acopioProveedorId === a.id && o.estado !== "BORRADOR" && o.estado !== "CANCELADA").flatMap((o) => o.items).filter((i) => i.productoId === it.productoId).reduce((s, i) => s + i.cantidadPedida, 0);
        add(trans, k(it.productoId, a.depositoDestinoId), Math.max(0, it.cantidadPactada - pedido));
      }
    }
    const transf = new Map<string, number>();
    for (const t of transferencias) if (t.estado === "EN_TRANSITO") for (const it of t.items) add(transf, it.productoId, it.cantidad);

    const out = new Map<string, PosicionProducto>();
    for (const p of productos) {
      const porDeposito: Record<string, PosicionDeposito> = {};
      const tot = { fisico: 0, pendiente: 0, reservado: 0, enTransito: 0 };
      for (const d of depositos) {
        const key = k(p.id, d.id);
        const f = fis.get(key) ?? 0;
        const pe = pend.get(key) ?? 0;
        const re = res.get(key) ?? 0;
        const tr = trans.get(key) ?? 0;
        porDeposito[d.id] = { fisico: f, pendiente: pe, reservado: re, disponible: f - pe - re, enTransito: tr, comprometido: pe + re };
        tot.fisico += f;
        tot.pendiente += pe;
        tot.reservado += re;
        tot.enTransito += tr;
      }
      out.set(p.id, {
        producto: p,
        porDeposito,
        ...tot,
        comprometido: tot.pendiente + tot.reservado,
        disponible: tot.fisico - tot.pendiente - tot.reservado,
        enTransferencia: transf.get(p.id) ?? 0,
        estado: estadoStock(p, tot.fisico),
        valorizado: tot.fisico * p.costoPromedio,
      });
    }
    return out;
  },
);

export function posicionesDe(db: EstadoInicial) {
  return selectPosiciones(db.productos, db.depositos, db.stock, db.notasPedido, db.remitos, db.ordenesCompra, db.acopiosProveedor, db.transferencias);
}

export function usePosiciones() {
  return posicionesDe(useDb());
}

/** Posición de un producto según el depósito activo (o total). */
export function posicionEn(pos: PosicionProducto | undefined, depositoId: string | null): PosicionDeposito {
  if (!pos) return VACIA;
  if (depositoId) return pos.porDeposito[depositoId] ?? VACIA;
  return { fisico: pos.fisico, pendiente: pos.pendiente, reservado: pos.reservado, disponible: pos.disponible, enTransito: pos.enTransito, comprometido: pos.comprometido };
}

// ───────────────────────── Cuentas corrientes ─────────────────────────

export interface SaldoCuenta {
  saldo: number;
  vencido: number;
  aVencer: number;
  comprobantesPendientes: number;
}

export const selectSaldosClientes = memo((comprobantes: Comprobante[], hoyK: string): Map<string, SaldoCuenta> => {
  const hoy = new Date(hoyK);
  const out = new Map<string, SaldoCuenta>();
  for (const c of comprobantes) {
    if (!c.clienteId || c.estado === "ANULADO") continue;
    const s = out.get(c.clienteId) ?? { saldo: 0, vencido: 0, aVencer: 0, comprobantesPendientes: 0 };
    s.saldo += c.saldoPendiente;
    if (esComprobanteDeuda(c) && c.saldoPendiente > 0.009) {
      s.comprobantesPendientes++;
      if (estaVencido(c, hoy)) s.vencido += c.saldoPendiente;
      else s.aVencer += c.saldoPendiente;
    }
    out.set(c.clienteId, s);
  }
  return out;
});

export const selectSaldosProveedores = memo((comprobantes: Comprobante[], hoyK: string): Map<string, SaldoCuenta> => {
  const hoy = new Date(hoyK);
  const out = new Map<string, SaldoCuenta>();
  for (const c of comprobantes) {
    if (!c.proveedorId || c.estado === "ANULADO") continue;
    const s = out.get(c.proveedorId) ?? { saldo: 0, vencido: 0, aVencer: 0, comprobantesPendientes: 0 };
    s.saldo += c.saldoPendiente;
    if (c.saldoPendiente > 0.009) {
      s.comprobantesPendientes++;
      if (estaVencido(c, hoy)) s.vencido += c.saldoPendiente;
      else s.aVencer += c.saldoPendiente;
    }
    out.set(c.proveedorId, s);
  }
  return out;
});

/** Clave de "hoy" estable durante el día para memoizar. */
export function hoyKey(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useSaldosClientes() {
  const comprobantes = useStore((s) => s.db.comprobantes);
  return selectSaldosClientes(comprobantes, hoyKey());
}

export function useSaldosProveedores() {
  const comprobantes = useStore((s) => s.db.comprobantes);
  return selectSaldosProveedores(comprobantes, hoyKey());
}

// ───────────────────────── Ventas ─────────────────────────

export const selectRentabilidadNP = memo((notas: NotaPedido[]): Map<string, Rentabilidad> => {
  const out = new Map<string, Rentabilidad>();
  for (const p of notas) out.set(p.id, calcularRentabilidadPedido(p));
  return out;
});

export function useRentabilidadNP() {
  return selectRentabilidadNP(useStore((s) => s.db.notasPedido));
}

/** Líneas pendientes de entrega (memo por notas y remitos). */
export const selectPendientes = memo((notas: NotaPedido[], remitos: EstadoInicial["remitos"]) => lineasPendientes(notas, remitos));

export function usePendientes() {
  const notas = useStore((s) => s.db.notasPedido);
  const remitos = useStore((s) => s.db.remitos);
  return selectPendientes(notas, remitos);
}

export const selectReservadoPorLinea = memo((remitos: EstadoInicial["remitos"]) => reservadoPorLinea(remitos));

// ───────────────────────── Acopios de clientes ─────────────────────────

export interface AcopioResumen {
  acopio: Acopio;
  estado: Acopio["estado"];
  saldo: number;
  retirado: number;
  pendienteEntrega: number;
  pagado: number;
  retiradoPct: number;
  pagadoPct: number;
  diasParaVencer: number;
}

export const selectAcopiosResumen = memo(
  (acopios: Acopio[], notas: NotaPedido[], devoluciones: EstadoInicial["devoluciones"], ajustes: EstadoInicial["ajustesAcopio"], comprobantes: Comprobante[], hoyK: string): AcopioResumen[] => {
    const hoy = new Date(hoyK);
    return acopios.map((a) => {
      const saldo = saldoDisponible(a, notas, devoluciones, ajustes);
      const retirado = retiradoAcopio(a.id, notas, devoluciones);
      const pagado = pagadoAcopio(a, comprobantes);
      const total = a.importeConIIBB || a.importe;
      return {
        acopio: a,
        estado: estadoDerivado(a, hoy, saldo),
        saldo,
        retirado,
        pendienteEntrega: montoPendienteEntrega(a.id, notas),
        pagado,
        retiradoPct: a.importe ? Math.min(1, Math.max(0, retirado / a.importe)) : 0,
        pagadoPct: total ? Math.min(1, pagado / total) : 0,
        diasParaVencer: diasParaVencer(a, hoy),
      };
    });
  },
);

export function acopiosResumenDe(db: EstadoInicial) {
  return selectAcopiosResumen(db.acopios, db.notasPedido, db.devoluciones, db.ajustesAcopio, db.comprobantes, hoyKey());
}

export function useAcopiosResumen() {
  return acopiosResumenDe(useDb());
}

// ───────────────────────── Acopios con proveedores ─────────────────────────

export interface AcopioProveedorResumen {
  acopio: AcopioProveedor;
  saldo: number;
  retirado: number;
  pendientePesos: number;
  pendienteUnidades: number;
  deuda: number;
  pagadoPct: number;
  diasParaVencer: number;
  estado: AcopioProveedor["estado"];
}

export const selectAcopiosProveedorResumen = memo((acps: AcopioProveedor[], ocs: EstadoInicial["ordenesCompra"], hoyK: string): AcopioProveedorResumen[] => {
  const hoy = new Date(hoyK);
  return acps.map((a) => {
    const pend = pendienteRetirar(a, ocs);
    const dias = diasParaVencer(a, hoy);
    const saldo = saldoACP(a, ocs);
    const estado: AcopioProveedor["estado"] = a.estado === "CANCELADO" ? "CANCELADO" : pend.pesos <= 0.5 && saldo <= 0.5 ? "AGOTADO" : dias < 0 ? "VENCIDO" : "VIGENTE";
    return {
      acopio: a,
      saldo,
      retirado: retiradoAcopioProveedor(a, ocs),
      pendientePesos: pend.pesos,
      pendienteUnidades: pend.porProducto.reduce((s, p) => s + p.pendiente, 0),
      deuda: deudaConProveedor(a),
      pagadoPct: a.importe ? Math.min(1, a.pagado / a.importe) : 0,
      diasParaVencer: dias,
      estado,
    };
  });
});

export function acopiosProveedorResumenDe(db: EstadoInicial) {
  return selectAcopiosProveedorResumen(db.acopiosProveedor, db.ordenesCompra, hoyKey());
}

export function useAcopiosProveedorResumen() {
  return acopiosProveedorResumenDe(useDb());
}

// ───────────────────────── Índices ─────────────────────────

const indices = new WeakMap<object, Map<string, unknown>>();
/** Índice id → entidad memoizado por array. */
export function indice<T extends { id: string }>(items: T[]): Map<string, T> {
  let m = indices.get(items) as Map<string, T> | undefined;
  if (!m) {
    m = new Map(items.map((i) => [i.id, i]));
    indices.set(items, m as Map<string, unknown>);
  }
  return m;
}

export function useIndice<K extends keyof EstadoInicial>(k: K) {
  const items = useStore((s) => s.db[k]) as unknown as { id: string }[];
  return indice(items) as Map<string, EstadoInicial[K] extends Array<infer U> ? U : never>;
}
