"use client";

import { useStore } from "./index";
import type { Acopio, Comprobante, EstadoInicial, Pedido, Producto } from "@/domain/types";
import { calcularRentabilidadPedido, type Rentabilidad } from "@/domain/ventas";
import { valorDeudaMercaderia, estadoDerivado, type DeudaMercaderia, proporcionRetirada, diasParaVencer } from "@/domain/acopios";
import { estaVencido, esComprobanteDeuda } from "@/domain/cuentasCorrientes";
import { estadoStock, type EstadoStock } from "@/domain/stock";
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

// ───────────────────────── Stock ─────────────────────────

export interface PosicionDeposito {
  fisico: number;
  comprometido: number;
  disponible: number;
  enTransito: number;
}

export interface PosicionProducto {
  producto: Producto;
  porDeposito: Record<string, PosicionDeposito>;
  fisico: number;
  comprometido: number;
  disponible: number;
  enTransito: number;
  /** En viaje entre depósitos (transferencias despachadas sin recibir). */
  enTransferencia: number;
  estado: EstadoStock;
  valorizado: number;
}

const ESTADOS_PED = new Set(["CONFIRMADO", "EN_PREPARACION", "DESPACHADO_PARCIAL", "DESPACHADO", "FACTURADO"]);
const ESTADOS_ACO = new Set(["VIGENTE", "RETIRADO_PARCIAL", "VENCIDO"]);

/** Posición de stock de todos los productos: físico, comprometido, disponible y en tránsito por depósito. */
export const selectPosiciones = memo(
  (
    productos: EstadoInicial["productos"],
    depositos: EstadoInicial["depositos"],
    stock: EstadoInicial["stock"],
    pedidos: EstadoInicial["pedidos"],
    acopios: EstadoInicial["acopios"],
    despachos: EstadoInicial["despachos"],
    ordenesCompra: EstadoInicial["ordenesCompra"],
    transferencias: EstadoInicial["transferencias"],
  ): Map<string, PosicionProducto> => {
    const k = (p: string, d: string) => `${p}|${d}`;
    const fis = new Map<string, number>();
    for (const s of stock) fis.set(k(s.productoId, s.depositoId), s.cantidadFisica);
    const comp = new Map<string, number>();
    const add = (m: Map<string, number>, key: string, q: number) => m.set(key, (m.get(key) ?? 0) + q);
    for (const p of pedidos)
      if (ESTADOS_PED.has(p.estado)) for (const it of p.items) add(comp, k(it.productoId, p.depositoId), Math.max(0, it.cantidad - (it.cantidadDespachada ?? 0)));
    for (const a of acopios)
      if (ESTADOS_ACO.has(a.estado)) for (const it of a.items) add(comp, k(it.productoId, a.depositoId), Math.max(0, it.cantidadAcopiada - it.cantidadRetirada));
    for (const d of despachos)
      if (d.origenTipo === "RETIRO_ACOPIO" && !d.egresoGenerado && d.estado !== "CANCELADO") for (const it of d.items) add(comp, k(it.productoId, d.depositoId), it.cantidad);
    const trans = new Map<string, number>();
    for (const oc of ordenesCompra)
      if (oc.estado === "CONFIRMADA" || oc.estado === "RECIBIDA_PARCIAL")
        for (const it of oc.items) add(trans, k(it.productoId, oc.depositoDestinoId), Math.max(0, it.cantidadPedida - it.cantidadRecibida));
    const transf = new Map<string, number>();
    for (const t of transferencias) if (t.estado === "EN_TRANSITO") for (const it of t.items) add(transf, it.productoId, it.cantidad);

    const out = new Map<string, PosicionProducto>();
    for (const p of productos) {
      const porDeposito: Record<string, PosicionDeposito> = {};
      let f = 0, c = 0, t = 0;
      for (const d of depositos) {
        const key = k(p.id, d.id);
        const pf = fis.get(key) ?? 0;
        const pc = comp.get(key) ?? 0;
        const pt = trans.get(key) ?? 0;
        porDeposito[d.id] = { fisico: pf, comprometido: pc, disponible: pf - pc, enTransito: pt };
        f += pf;
        c += pc;
        t += pt;
      }
      out.set(p.id, {
        producto: p,
        porDeposito,
        fisico: f,
        comprometido: c,
        disponible: f - c,
        enTransito: t,
        enTransferencia: transf.get(p.id) ?? 0,
        estado: estadoStock(p, f),
        valorizado: f * p.costoPromedio,
      });
    }
    return out;
  },
);

export function usePosiciones() {
  const db = useDb();
  return selectPosiciones(db.productos, db.depositos, db.stock, db.pedidos, db.acopios, db.despachos, db.ordenesCompra, db.transferencias);
}

export function posicionesDe(db: EstadoInicial) {
  return selectPosiciones(db.productos, db.depositos, db.stock, db.pedidos, db.acopios, db.despachos, db.ordenesCompra, db.transferencias);
}

/** Física/comprometida/disponible de un producto según el depósito activo (o total). */
export function posicionEn(pos: PosicionProducto | undefined, depositoId: string | null): PosicionDeposito {
  if (!pos) return { fisico: 0, comprometido: 0, disponible: 0, enTransito: 0 };
  if (depositoId) return pos.porDeposito[depositoId] ?? { fisico: 0, comprometido: 0, disponible: 0, enTransito: 0 };
  return { fisico: pos.fisico, comprometido: pos.comprometido, disponible: pos.disponible, enTransito: pos.enTransito };
}

// ───────────────────────── Cuentas corrientes ─────────────────────────

export interface SaldoCuenta {
  saldo: number;
  vencido: number;
  aVencer: number;
  comprobantesPendientes: number;
}

export const selectSaldosClientes = memo((comprobantes: Comprobante[], hoyKey: string): Map<string, SaldoCuenta> => {
  const hoy = new Date(hoyKey);
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

export const selectSaldosProveedores = memo((comprobantes: Comprobante[], hoyKey: string): Map<string, SaldoCuenta> => {
  const hoy = new Date(hoyKey);
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

export const selectRentabilidadPedidos = memo((pedidos: Pedido[]): Map<string, Rentabilidad> => {
  const out = new Map<string, Rentabilidad>();
  for (const p of pedidos) out.set(p.id, calcularRentabilidadPedido(p));
  return out;
});

export function useRentabilidadPedidos() {
  return selectRentabilidadPedidos(useStore((s) => s.db.pedidos));
}

// ───────────────────────── Acopios ─────────────────────────

export interface AcopioConSaldo {
  acopio: Acopio;
  estado: Acopio["estado"];
  deuda: DeudaMercaderia;
  retiradoPct: number;
  pagadoPct: number;
  diasParaVencer: number;
}

export const selectAcopiosConSaldo = memo((acopios: Acopio[], productos: Producto[], hoyK: string): AcopioConSaldo[] => {
  const hoy = new Date(hoyK);
  const costo = new Map(productos.map((p) => [p.id, p.costoUltimo]));
  return acopios.map((a) => {
    const estado = estadoDerivado(a, hoy);
    const activo = estado !== "CANCELADO";
    return {
      acopio: a,
      estado,
      deuda: activo ? valorDeudaMercaderia(a, (id) => costo.get(id) ?? 0) : { aPrecioPactado: 0, aCostoActual: 0, aCostoSnapshot: 0, exposicion: 0, margenActualPct: 0 },
      retiradoPct: proporcionRetirada(a),
      pagadoPct: a.total ? Math.min(1, a.montoPagado / a.total) : 0,
      diasParaVencer: diasParaVencer(a, hoy),
    };
  });
});

export function useAcopiosConSaldo() {
  const acopios = useStore((s) => s.db.acopios);
  const productos = useStore((s) => s.db.productos);
  return selectAcopiosConSaldo(acopios, productos, hoyKey());
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
