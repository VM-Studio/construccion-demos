import type { Despacho, Producto } from "@/domain/types";

/** Peso total de un despacho en kg. */
export function pesoDespacho(d: Pick<Despacho, "items">, productos: Producto[]): number {
  const peso = new Map(productos.map((p) => [p.id, p.pesoKg ?? 0]));
  return d.items.reduce((a, i) => a + i.cantidad * (peso.get(i.productoId) ?? 0), 0);
}
