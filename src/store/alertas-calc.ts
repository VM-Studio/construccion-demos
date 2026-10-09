/** Cálculo puro de alertas operativas (cliente y servidor). */
import { differenceInCalendarDays, parseISO } from "date-fns";
import { AlertTriangle, Boxes, CalendarClock, CreditCard, FileWarning, PackageX, Truck, Clock, type LucideIcon } from "lucide-react";
import type { EstadoInicial, Usuario } from "@/domain/types";
import { estaBajoMinimo, lineasPendientes } from "@/domain/stock";
import { estaVencido, saldoCliente } from "@/domain/cuentasCorrientes";
import { puede } from "@/domain/permisos";
import { memo, acopiosResumenDe } from "./calculos";

export interface Alerta {
  id: string;
  titulo: string;
  detalle: string;
  cantidad: number;
  href: string;
  severidad: "alta" | "media" | "baja";
  icono: LucideIcon;
}

const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Calcula las alertas operativas, priorizadas, filtradas por sucursal y permisos. */
export const calcularAlertas = memo((db: EstadoInicial, sucursalId: string | null, usuario: Usuario | undefined, hoyK: string): Alerta[] => {
  const hoy = new Date(hoyK);
  const out: Alerta[] = [];
  const veC2 = puede(usuario, "circuito2.ver");
  const enSuc = (s?: string) => !sucursalId || s === sucursalId;
  const visible = (c?: 1 | 2) => veC2 || c !== 2;

  if (db.config.arcaCertVence && puede(usuario, "config.ver")) {
    const dias = differenceInCalendarDays(parseISO(db.config.arcaCertVence), hoy);
    if (dias <= 30)
      out.push({ id: "arca-certificado", titulo: dias < 0 ? "El certificado de ARCA está vencido" : "El certificado de ARCA está por vencer", detalle: dias < 0 ? "La consulta del padrón usa la fuente pública hasta renovarlo" : `Vence en ${dias} días: renovalo para seguir consultando el padrón oficial`, cantidad: 1, href: "/configuracion?tab=parametros", severidad: dias < 0 ? "alta" : "media", icono: FileWarning });
  }

  if ((puede(usuario, "stock.ver") || puede(usuario, "productos.ver")) && db.config.alertaStockMinimo) {
    const fis = new Map<string, number>();
    for (const s of db.stock) fis.set(s.productoId, (fis.get(s.productoId) ?? 0) + s.cantidadFisica);
    const bajo = db.productos.filter((p) => p.activo && estaBajoMinimo(p, fis.get(p.id) ?? 0)).length;
    if (bajo) out.push({ id: "bajo-minimo", titulo: "Artículos bajo stock mínimo", detalle: "Reponer antes de quedar sin stock", cantidad: bajo, href: puede(usuario, "stock.ver") ? "/stock?filtro=bajo-minimo" : "/productos?filtro=bajo-minimo", severidad: "alta", icono: PackageX });
  }

  if (puede(usuario, "acopios.ver")) {
    const res = acopiosResumenDe(db).filter((r) => enSuc(r.acopio.sucursalId) && visible(r.acopio.circuito));
    const porVencer = res.filter((r) => (r.estado === "VIGENTE" && r.diasParaVencer <= 30) || r.estado === "VENCIDO").length;
    if (porVencer) out.push({ id: "acopios-vencer", titulo: "Acopios por vencer o vencidos con saldo", detalle: "Vencen en 30 días o ya vencieron con saldo disponible", cantidad: porVencer, href: "/acopios?filtro=por-vencer", severidad: "alta", icono: Boxes });
    const atrasados = res.filter((r) => r.acopio.formaPago === "CUENTA_CORRIENTE" && r.estado !== "CANCELADO" && db.comprobantes.some((c) => r.acopio.comprobanteIds.includes(c.id) && estaVencido(c, hoy))).length;
    if (atrasados) out.push({ id: "acopios-impagos", titulo: "Acopios en cuenta corriente con pago atrasado", detalle: "Cuotas vencidas sin cobrar", cantidad: atrasados, href: "/acopios?filtro=impagos", severidad: "alta", icono: CreditCard });
  }

  if (puede(usuario, "ventas.ver")) {
    const programados = new Set(db.despachos.filter((d) => d.estado !== "CANCELADO").map((d) => d.notaPedidoId));
    const np = new Map(db.notasPedido.map((n) => [n.id, n]));
    const sinProgramar = lineasPendientes(db.notasPedido, db.remitos).filter((l) => {
      const n = np.get(l.notaPedidoId)!;
      return enSuc(n.sucursalId) && visible(n.circuito) && !programados.has(n.id) && differenceInCalendarDays(hoy, parseISO(n.fecha)) > 15;
    });
    const nps = new Set(sinProgramar.map((l) => l.notaPedidoId)).size;
    if (nps) out.push({ id: "pendientes-viejos", titulo: "Entregas pendientes sin programar", detalle: `${sinProgramar.length} líneas vendidas hace más de 15 días sin despacho`, cantidad: nps, href: "/pendientes-entrega?filtro=atrasados", severidad: "media", icono: Clock });
  }

  if (puede(usuario, "ctacte.ver")) {
    const vencidos = db.comprobantes.filter((c) => c.clienteId && enSuc(c.sucursalId) && visible(c.circuito) && estaVencido(c, hoy));
    if (vencidos.length) out.push({ id: "vencidos", titulo: "Comprobantes vencidos sin cobrar", detalle: `${new Set(vencidos.map((c) => c.clienteId)).size} clientes con deuda vencida`, cantidad: vencidos.length, href: "/cuentas-corrientes/clientes?filtro=vencidos", severidad: "alta", icono: CreditCard });
    const excedidos = db.clientes.filter((c) => c.limiteCredito > 0 && enSuc(c.sucursalPreferidaId) && saldoCliente(c.id, db.comprobantes) > c.limiteCredito).length;
    if (excedidos) out.push({ id: "excedidos", titulo: "Clientes sobre su límite de crédito", detalle: "Revisar antes de confirmar ventas en cuenta corriente", cantidad: excedidos, href: "/clientes?filtro=excedidos", severidad: "media", icono: AlertTriangle });
  }

  if (puede(usuario, "remitos.ver")) {
    const sinFirma = db.remitos.filter((r) => r.estado === "HECHO" && r.tipo !== "TRANSFERENCIA" && !r.firmadoAdjuntoId && enSuc(r.sucursalId) && visible(r.circuito) && differenceInCalendarDays(hoy, parseISO(r.fechaEntrega ?? r.fecha)) <= 15).length;
    if (sinFirma) out.push({ id: "remitos-sin-firma", titulo: "Remitos hechos sin remito firmado", detalle: "Entregas de los últimos 15 días sin el papel firmado", cantidad: sinFirma, href: "/remitos?firmados=0", severidad: "baja", icono: FileWarning });
  }

  if (puede(usuario, "compras.ver")) {
    const atrasadas = db.ordenesCompra.filter((o) => (o.estado === "CONFIRMADA" || o.estado === "RECIBIDA_PARCIAL") && enSuc(o.sucursalId) && differenceInCalendarDays(hoy, parseISO(o.fechaEntregaEstimada)) > 0).length;
    if (atrasadas) out.push({ id: "oc-atrasadas", titulo: "Órdenes de compra atrasadas", detalle: "Entrega estimada vencida sin recibir", cantidad: atrasadas, href: "/compras/ordenes?filtro=atrasadas", severidad: "media", icono: CalendarClock });
  }

  if (puede(usuario, "despachos.ver")) {
    const hoyStr = dia(hoy);
    const pend = db.despachos.filter((d) => (d.estado === "ESPERA" || d.estado === "PREPARACION") && enSuc(d.sucursalId) && dia(parseISO(d.fechaProgramada)) <= hoyStr).length;
    if (pend) out.push({ id: "despachos-hoy", titulo: "Despachos de hoy en espera o preparación", detalle: "Clientes esperando en el depósito o cargas en curso", cantidad: pend, href: "/despachos", severidad: "baja", icono: Truck });
  }

  return out;
});

/** Alertas del sistema para la campana del header, el inicio y el tablero. */
