/** Presentación de líneas de venta en la unidad en que se vendieron (ej. hierro por tonelada). */
import type { Producto, Unidad } from "@/domain/types";
import { deBase, esAlternativa, precioEn } from "@/domain/unidades";
import { formatQty } from "./format";

export function presentarLinea(l: { cantidad: number; precioUnitario: number; unidadVenta?: Unidad }, p: Producto | undefined) {
  const alt = esAlternativa(p, l.unidadVenta);
  const unidad = alt ? l.unidadVenta! : (p?.unidad ?? "UN");
  const cantidad = alt ? Math.round(deBase(l.cantidad, p, l.unidadVenta) * 1000) / 1000 : l.cantidad;
  return { cantidad, unidad, texto: formatQty(cantidad, unidad), precio: alt ? precioEn(l.precioUnitario, p, l.unidadVenta) : l.precioUnitario };
}
