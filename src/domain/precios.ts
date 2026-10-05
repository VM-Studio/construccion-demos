import type { PrecioProducto, Producto } from "./types";

export type Redondeo = 1 | 10 | 100;

/** Redondea un precio al múltiplo indicado ($1, $10, $100). */
export function redondearPrecio(precio: number, redondeo: Redondeo = 10): number {
  return Math.round(precio / redondeo) * redondeo;
}

/** Precio de venta = costo × (1 + markup). `markupPct` en base 100 (ej. 28). */
export function calcularPrecioDesdeMarkup(costo: number, markupPct: number, redondeo: Redondeo = 10): number {
  return redondearPrecio(costo * (1 + markupPct / 100), redondeo);
}

/** Markup efectivo de un precio sobre un costo (base 100). */
export function markupEfectivo(precio: number, costo: number): number {
  if (!costo) return 0;
  return ((precio - costo) / costo) * 100;
}

/** Busca el precio de un producto en una lista. */
export function obtenerPrecio(productoId: string, listaId: string, precios: PrecioProducto[]): number {
  return precios.find((p) => p.productoId === productoId && p.listaPreciosId === listaId)?.precio ?? 0;
}

export interface FiltroActualizacion {
  productoIds: string[];
  listaIds: string[];
}

export type ModoActualizacion =
  | { tipo: "AUMENTAR"; pct: number }
  | { tipo: "DISMINUIR"; pct: number }
  | { tipo: "MARKUP"; markups: Record<string, number> };

export interface CambioPrecio {
  productoId: string;
  listaPreciosId: string;
  anterior: number;
  nuevo: number;
}

/**
 * Calcula los cambios de una actualización masiva de precios.
 * - AUMENTAR / DISMINUIR aplican el % sobre el precio actual.
 * - MARKUP recalcula desde el costo promedio + markup por lista.
 * Devuelve sólo los cambios (no muta).
 */
export function calcularActualizacionMasiva(
  precios: PrecioProducto[],
  productos: Producto[],
  filtro: FiltroActualizacion,
  modo: ModoActualizacion,
  redondeo: Redondeo = 10,
): CambioPrecio[] {
  const prods = new Map(productos.map((p) => [p.id, p]));
  const listas = new Set(filtro.listaIds);
  const cambios: CambioPrecio[] = [];
  for (const productoId of filtro.productoIds) {
    const p = prods.get(productoId);
    if (!p) continue;
    for (const listaId of listas) {
      const anterior = obtenerPrecio(productoId, listaId, precios);
      let nuevo = anterior;
      if (modo.tipo === "AUMENTAR") nuevo = redondearPrecio(anterior * (1 + modo.pct / 100), redondeo);
      else if (modo.tipo === "DISMINUIR") nuevo = redondearPrecio(anterior * (1 - modo.pct / 100), redondeo);
      else nuevo = calcularPrecioDesdeMarkup(p.costoPromedio, modo.markups[listaId] ?? 0, redondeo);
      cambios.push({ productoId, listaPreciosId: listaId, anterior, nuevo });
    }
  }
  return cambios;
}

/**
 * Aplica una actualización masiva y devuelve la nueva lista de precios.
 * `pct` positivo aumenta, negativo disminuye.
 */
export function aplicarActualizacionMasiva(
  precios: PrecioProducto[],
  filtro: FiltroActualizacion,
  pct: number,
  redondeo: Redondeo = 10,
  ahora = new Date().toISOString(),
): PrecioProducto[] {
  const prods = new Set(filtro.productoIds);
  const listas = new Set(filtro.listaIds);
  return precios.map((p) =>
    prods.has(p.productoId) && listas.has(p.listaPreciosId)
      ? { ...p, precio: redondearPrecio(p.precio * (1 + pct / 100), redondeo), actualizadoEn: ahora }
      : p,
  );
}

/** Aplica una lista de cambios ya calculados. */
export function aplicarCambiosPrecio(precios: PrecioProducto[], cambios: CambioPrecio[], ahora: string): PrecioProducto[] {
  const key = (a: string, b: string) => `${a}|${b}`;
  const map = new Map(cambios.map((c) => [key(c.productoId, c.listaPreciosId), c.nuevo]));
  return precios.map((p) => {
    const n = map.get(key(p.productoId, p.listaPreciosId));
    return n !== undefined ? { ...p, precio: n, actualizadoEn: ahora } : p;
  });
}
