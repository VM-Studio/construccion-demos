import type { Producto, StockDeposito } from "./types";
import { round2 } from "@/lib/utils";

/**
 * Costo promedio ponderado luego de un ingreso.
 * Si no había stock (o era negativo) el promedio pasa a ser el costo del ingreso.
 */
export function recalcularCostoPromedio(
  stockActual: number,
  costoActual: number,
  cantidadIngresada: number,
  costoIngreso: number,
): number {
  if (cantidadIngresada <= 0) return costoActual;
  if (stockActual <= 0) return round2(costoIngreso);
  return round2((stockActual * costoActual + cantidadIngresada * costoIngreso) / (stockActual + cantidadIngresada));
}

export type MetodoValorizacion = "ULTIMO" | "PROMEDIO";

export interface LineaValorizacion {
  productoId: string;
  depositoId: string;
  cantidad: number;
  costoUnitario: number;
  valor: number;
}

/**
 * Valoriza el inventario físico con el método indicado.
 * Devuelve el total y el detalle por producto y depósito (sólo cantidades > 0).
 */
export function valorizarInventario(
  stock: StockDeposito[],
  productos: Producto[],
  metodo: MetodoValorizacion,
): { total: number; lineas: LineaValorizacion[] } {
  const prod = new Map(productos.map((p) => [p.id, p]));
  const lineas: LineaValorizacion[] = [];
  let total = 0;
  for (const s of stock) {
    const p = prod.get(s.productoId);
    if (!p || s.cantidadFisica <= 0) continue;
    const costo = metodo === "ULTIMO" ? p.costoUltimo : p.costoPromedio;
    const valor = s.cantidadFisica * costo;
    total += valor;
    lineas.push({ productoId: p.id, depositoId: s.depositoId, cantidad: s.cantidadFisica, costoUnitario: costo, valor });
  }
  return { total: round2(total), lineas };
}

/** Variación porcentual entre dos costos (0.05 = +5 %). */
export function variacionCosto(anterior: number, nuevo: number): number {
  if (!anterior) return 0;
  return (nuevo - anterior) / anterior;
}
