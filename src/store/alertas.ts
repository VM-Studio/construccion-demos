"use client";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { AlertTriangle, Boxes, CalendarClock, CreditCard, PackageX, Truck, type LucideIcon } from "lucide-react";
import type { EstadoInicial, Usuario } from "@/domain/types";
import { estaBajoMinimo } from "@/domain/stock";
import { estadoDerivado, pendienteItem } from "@/domain/acopios";
import { estaVencido, saldoCliente } from "@/domain/cuentasCorrientes";
import { puede } from "@/domain/permisos";
import { useStore } from "./index";
import { memo, hoyKey } from "./selectors";

export interface Alerta {
  id: string;
  titulo: string;
  detalle: string;
  cantidad: number;
  href: string;
  severidad: "alta" | "media" | "baja";
  icono: LucideIcon;
}

/** Calcula las alertas operativas, priorizadas, filtradas por sucursal y permisos. */
export const calcularAlertas = memo((db: EstadoInicial, sucursalId: string | null, usuario: Usuario | undefined, hoyK: string): Alerta[] => {
  const hoy = new Date(hoyK);
  const out: Alerta[] = [];

  if (puede(usuario, "stock.ver") || puede(usuario, "productos.ver")) {
    if (db.config.alertaStockMinimo) {
      // El mínimo es por empresa (suma de depósitos): se compara contra el físico total.
      const fis = new Map<string, number>();
      for (const s of db.stock) fis.set(s.productoId, (fis.get(s.productoId) ?? 0) + s.cantidadFisica);
      const bajo = db.productos.filter((p) => p.activo && estaBajoMinimo(p, fis.get(p.id) ?? 0)).length;
      const href = puede(usuario, "stock.ver") ? "/stock?filtro=bajo-minimo" : "/productos?filtro=bajo-minimo";
      if (bajo) out.push({ id: "bajo-minimo", titulo: "Productos bajo stock mínimo", detalle: "Reponer antes de quedar sin stock", cantidad: bajo, href, severidad: "alta", icono: PackageX });
    }
  }

  if (puede(usuario, "acopios.ver")) {
    const n = db.acopios.filter((a) => {
      if (sucursalId && a.sucursalId !== sucursalId) return false;
      const e = estadoDerivado(a, hoy);
      if (e === "CANCELADO" || e === "COMPLETADO") return false;
      const conSaldo = a.items.some((i) => pendienteItem(i) > 0);
      return conSaldo && (e === "VENCIDO" || differenceInCalendarDays(parseISO(a.fechaVencimiento), hoy) <= 15);
    }).length;
    if (n) out.push({ id: "acopios", titulo: "Acopios vencidos o por vencer", detalle: "Vencen en 15 días o ya vencieron con saldo", cantidad: n, href: "/acopios?filtro=por-vencer", severidad: "alta", icono: Boxes });
  }

  if (puede(usuario, "ctacte.ver")) {
    const vencidos = db.comprobantes.filter((c) => c.clienteId && (!sucursalId || c.sucursalId === sucursalId) && estaVencido(c, hoy));
    if (vencidos.length) out.push({ id: "vencidos", titulo: "Comprobantes vencidos sin cobrar", detalle: `${new Set(vencidos.map((c) => c.clienteId)).size} clientes con deuda vencida`, cantidad: vencidos.length, href: "/cuentas-corrientes?filtro=vencidos", severidad: "alta", icono: CreditCard });
    const excedidos = db.clientes.filter((c) => c.limiteCredito > 0 && (!sucursalId || c.sucursalPreferidaId === sucursalId) && saldoCliente(c.id, db.comprobantes) > c.limiteCredito).length;
    if (excedidos) out.push({ id: "excedidos", titulo: "Clientes sobre su límite de crédito", detalle: "Revisar antes de confirmar pedidos", cantidad: excedidos, href: "/cuentas-corrientes?filtro=excedidos", severidad: "media", icono: AlertTriangle });
  }

  if (puede(usuario, "compras.ver")) {
    const atrasadas = db.ordenesCompra.filter(
      (o) => (o.estado === "CONFIRMADA" || o.estado === "RECIBIDA_PARCIAL") && (!sucursalId || o.sucursalId === sucursalId) && differenceInCalendarDays(hoy, parseISO(o.fechaEntregaEstimada)) > 0,
    ).length;
    if (atrasadas) out.push({ id: "oc-atrasadas", titulo: "Órdenes de compra atrasadas", detalle: "Entrega estimada vencida sin recibir", cantidad: atrasadas, href: "/compras?filtro=atrasadas", severidad: "media", icono: CalendarClock });
  }

  if (puede(usuario, "despachos.ver")) {
    const hoyStr = toLocalDay(hoy);
    const pend = db.despachos.filter(
      (d) => (d.estado === "PENDIENTE" || d.estado === "EN_PREPARACION") && (!sucursalId || d.sucursalId === sucursalId) && toLocalDay(parseISO(d.fechaProgramada)) <= hoyStr,
    ).length;
    if (pend) out.push({ id: "despachos-hoy", titulo: "Despachos para hoy pendientes", detalle: "Programados para hoy o atrasados, sin salir", cantidad: pend, href: "/despachos?fecha=hoy", severidad: "baja", icono: Truck });
  }

  return out;
});

function toLocalDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Alertas del sistema para la campana del header y el tablero. */
export function useAlertas(): Alerta[] {
  const db = useStore((s) => s.db);
  const sucursalId = useStore((s) => s.ui.sucursalActivaId);
  const usuarioId = useStore((s) => s.ui.usuarioId);
  const usuario = db.usuarios.find((u) => u.id === usuarioId);
  return calcularAlertas(db, sucursalId, usuario, hoyKey());
}
