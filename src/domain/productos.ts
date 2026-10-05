import type { Producto, Rubro } from "./types";

/** Próximo código de producto para un rubro: `GRU-0018`. */
export function siguienteCodigoProducto(rubroId: string, productos: Producto[], rubros: Rubro[]): string {
  const r = rubros.find((x) => x.id === rubroId);
  if (!r) return "";
  const max = productos
    .filter((p) => p.codigo.startsWith(r.prefijo + "-"))
    .reduce((m, p) => Math.max(m, Number(p.codigo.split("-")[1]) || 0), 0);
  return `${r.prefijo}-${String(max + 1).padStart(4, "0")}`;
}

/** Cantidad sugerida de reposición: mínimo × 2 − disponible, redondeado a pallet si corresponde. */
export function cantidadReposicion(p: Pick<Producto, "stockMinimo" | "unidadesPorPallet">, disponible: number, enTransito = 0): number {
  const base = p.stockMinimo * 2 - disponible - enTransito;
  if (base <= 0) return 0;
  if (p.unidadesPorPallet) return Math.ceil(base / p.unidadesPorPallet) * p.unidadesPorPallet;
  return Math.ceil(base);
}
