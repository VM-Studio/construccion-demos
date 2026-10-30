/**
 * Unidad alternativa de un artículo (ej. hierro: el stock se lleva en barras y también se ingresa
 * y se vende por tonelada). La cantidad de los documentos y del stock SIEMPRE está en la unidad
 * base; la alternativa es solo la forma de cargarla y mostrarla.
 */
import type { Producto, Rubro, Unidad } from "./types";

type ConAlternativa = Pick<Producto, "unidad" | "unidadAlternativa" | "factorAlternativa">;

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** El artículo tiene unidad alternativa configurada. */
export function tieneAlternativa(p: ConAlternativa | undefined): p is ConAlternativa & { unidadAlternativa: Unidad; factorAlternativa: number } {
  return !!p?.unidadAlternativa && !!p.factorAlternativa && p.factorAlternativa > 0 && p.unidadAlternativa !== p.unidad;
}

/** ¿`unidad` es la alternativa del artículo? */
export function esAlternativa(p: ConAlternativa | undefined, unidad?: Unidad): boolean {
  return !!unidad && tieneAlternativa(p) && unidad === p.unidadAlternativa;
}

/** Cantidad en la unidad base a partir de lo cargado en `unidad`. */
export function aBase(cantidad: number, p: ConAlternativa | undefined, unidad?: Unidad): number {
  return esAlternativa(p, unidad) ? r3(cantidad * p!.factorAlternativa!) : cantidad;
}

/** Cantidad base expresada en `unidad` (sin redondear: se redondea al mostrar). */
export function deBase(cantidadBase: number, p: ConAlternativa | undefined, unidad?: Unidad): number {
  return esAlternativa(p, unidad) ? cantidadBase / p!.factorAlternativa! : cantidadBase;
}

/** Precio por unidad base → precio por `unidad`. */
export function precioEn(precioBase: number, p: ConAlternativa | undefined, unidad?: Unidad): number {
  return esAlternativa(p, unidad) ? r2(precioBase * p!.factorAlternativa!) : precioBase;
}

/** Precio por `unidad` → precio por unidad base (lo que se guarda). */
export function precioABase(precio: number, p: ConAlternativa | undefined, unidad?: Unidad): number {
  return esAlternativa(p, unidad) ? Math.round((precio / p!.factorAlternativa!) * 10000) / 10000 : precio;
}

/** Equivalente en la unidad alternativa (para reportes y stock), ej. 750 barras → 2 TN. */
export function equivalenteAlternativa(cantidadBase: number, p: ConAlternativa | undefined): number | null {
  return tieneAlternativa(p) ? cantidadBase / p.factorAlternativa : null;
}

// ───────────────────────── Hierros (calculadora) ─────────────────────────

/** Barras de 12 m por tonelada según el diámetro (calculadora de hierros de Aceros RNF). */
export const BARRAS_POR_TONELADA: { diametro: number; barras: number }[] = [
  { diametro: 4.2, barras: 1176 },
  { diametro: 6, barras: 375 },
  { diametro: 8, barras: 211 },
  { diametro: 10, barras: 135 },
  { diametro: 12, barras: 94 },
  { diametro: 16, barras: 53 },
  { diametro: 20, barras: 34 },
  { diametro: 25, barras: 22 },
];

/** Diámetro en mm leído del nombre ("HIERRO 8 MM", "HIERRO DULCE DE 4.2 MM"). */
export function diametroDe(nombre: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*MM\b/i.exec(nombre);
  return m ? Number(m[1].replace(",", ".")) : null;
}

/** Barras por tonelada sugeridas para un diámetro (4 mm se toma como 4,2). */
export function barrasPorToneladaDe(diametro: number | null): number | null {
  if (diametro == null) return null;
  const d = diametro === 4 ? 4.2 : diametro;
  return BARRAS_POR_TONELADA.find((x) => Math.abs(x.diametro - d) < 0.05)?.barras ?? null;
}

/** ¿Es una barra de hierro (rubro de hierros, se vende por unidad y el nombre tiene diámetro)? */
export function esBarraDeHierro(p: Pick<Producto, "nombre" | "unidad" | "rubroId" | "unidadAlternativa">, rubros: Pick<Rubro, "id" | "nombre">[]): boolean {
  const rubro = rubros.find((r) => r.id === p.rubroId);
  if (!rubro || !/hierro/i.test(rubro.nombre)) return false;
  if (p.unidadAlternativa === "TN") return true;
  return p.unidad === "UN" && /HIERRO/i.test(p.nombre) && !/MALLA|ALAMBRE|CLAVO/i.test(p.nombre) && diametroDe(p.nombre) != null;
}

/** Barras por tonelada del artículo: lo configurado o lo sugerido por su diámetro. */
export function barrasPorTonelada(p: ConAlternativa & Pick<Producto, "nombre">): number | null {
  if (tieneAlternativa(p) && p.unidadAlternativa === "TN" && p.unidad === "UN") return p.factorAlternativa;
  return barrasPorToneladaDe(diametroDe(p.nombre));
}
