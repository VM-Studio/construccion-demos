import type { Producto, Rubro } from "./types";

/** Próximo código numérico de artículo para un rubro (prefijo del rubro + correlativo): `50319`. */
export function siguienteCodigoProducto(rubroId: string, productos: Producto[], rubros: Rubro[]): string {
  const r = rubros.find((x) => x.id === rubroId);
  if (!r) return "";
  const max = productos
    .filter((p) => p.rubroId === rubroId && /^\d+$/.test(p.codigo) && p.codigo.startsWith(r.prefijo))
    .reduce((m, p) => Math.max(m, Number(p.codigo)), 0);
  return max ? String(max + 1) : `${r.prefijo}001`;
}

/** Cantidad sugerida de reposición: mínimo × 2 − disponible, redondeado a pallet si corresponde. */
export function cantidadReposicion(p: Pick<Producto, "stockMinimo" | "unidadesPorPallet">, disponible: number, enTransito = 0): number {
  const base = p.stockMinimo * 2 - disponible - enTransito;
  if (base <= 0) return 0;
  if (p.unidadesPorPallet) return Math.ceil(base / p.unidadesPorPallet) * p.unidadesPorPallet;
  return Math.ceil(base);
}
