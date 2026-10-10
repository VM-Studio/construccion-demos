/**
 * Duplicar artículos y crear series (reglas puras): precios por markup efectivo del origen,
 * detección de la variante (medida) al final del nombre, códigos consecutivos sin colisión y
 * parseo de lo que se pega desde Excel.
 */
import type { ListaPrecios, PrecioProducto, Producto, Rubro } from "./types";
import { redondearPrecio, type Redondeo } from "./precios";
import { numeroAR } from "@/lib/numero";

// ───────────────────────── Precios ─────────────────────────

/**
 * Markup efectivo del origen en cada lista: precio / costo − 1 (en %). Si el origen no tiene
 * costo o no tiene precio en la lista, se usa el markup por defecto de la lista.
 */
export function markupsEfectivos(origen: Pick<Producto, "id" | "costoUltimo">, precios: PrecioProducto[], listas: Pick<ListaPrecios, "id" | "markupPorDefecto">[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of listas) {
    const p = precios.find((x) => x.productoId === origen.id && x.listaPreciosId === l.id);
    out[l.id] = origen.costoUltimo > 0 && p && p.precio > 0 ? Math.round((p.precio / origen.costoUltimo - 1) * 10000) / 100 : l.markupPorDefecto;
  }
  return out;
}

/**
 * Listas en las que el precio del origen es más de 10 veces el costo (markup > 900 %): casi
 * seguro un error de carga (ej. un costo escrito 100 veces más alto). Se avisa antes de duplicar
 * para no copiar el error a los artículos nuevos.
 */
export function markupsSospechosos(markups: Record<string, number>): string[] {
  return Object.entries(markups).filter(([, m]) => m > 900).map(([id]) => id);
}

/**
 * Precios del artículo nuevo. Si el costo no cambió se copian iguales; si cambió, se recalculan
 * con el markup efectivo del origen en cada lista y se redondean.
 */
export function preciosParaCosto(
  origen: Pick<Producto, "id" | "costoUltimo">,
  precios: PrecioProducto[],
  listas: Pick<ListaPrecios, "id" | "markupPorDefecto">[],
  nuevoCosto: number,
  redondeo: Redondeo = 10,
): Record<string, number> {
  const mismoCosto = Math.abs(nuevoCosto - origen.costoUltimo) < 0.0001;
  const out: Record<string, number> = {};
  for (const l of listas) {
    const actual = precios.find((x) => x.productoId === origen.id && x.listaPreciosId === l.id)?.precio;
    if (mismoCosto && actual !== undefined) {
      out[l.id] = actual;
      continue;
    }
    // Proporción exacta precio / costo del origen (sin redondear el markup); se redondea solo el precio.
    const factor = origen.costoUltimo > 0 && actual && actual > 0 ? actual / origen.costoUltimo : 1 + l.markupPorDefecto / 100;
    out[l.id] = nuevoCosto > 0 ? redondearPrecio(nuevoCosto * factor, redondeo) : 0;
  }
  return out;
}

// ───────────────────────── Nombre y variante ─────────────────────────

/** Medida al final del nombre: "6 mm", "4,2 mm", "1/2\"", "12x18x33", "50 kg", "2,40 m". */
const NUM = String.raw`(?:\d+(?:[.,]\d+)?|\d+\/\d+)`;
const UNI = String.raw`(?:mm|cm|mts?|m|kg|kgs|gr|g|lts?|l|"|''|pulg(?:adas?)?|plg|cc|w)\.?`;
const MEDIDA = String.raw`${NUM}(?:\s*${UNI})?(?:\s*[x×]\s*${NUM}(?:\s*${UNI})?)*`;
const VARIANTE = new RegExp(String.raw`^(.*?)[\s-]+(${MEDIDA})$`, "i");

/** Separa el nombre en base y variante (la medida del final). Sin medida, variante vacía. */
export function detectarVariante(nombre: string): { base: string; variante: string } {
  const n = nombre.trim().replace(/\s+/g, " ");
  const m = n.match(VARIANTE);
  if (!m || !m[1].trim() || !/\d/.test(m[2])) return { base: n, variante: "" };
  return { base: m[1].trim(), variante: m[2].trim() };
}

/** Nombre de una variante: base + sufijo ("Hierro ADN" + "8 mm" → "Hierro ADN 8 mm"). */
export function nombreConVariante(base: string, sufijo: string): string {
  return [base.trim(), sufijo.trim()].filter(Boolean).join(" ");
}

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Otro artículo del mismo rubro con el mismo nombre (ignorando mayúsculas y espacios). */
export function nombreRepetidoEnRubro(nombre: string, rubroId: string, productos: Pick<Producto, "id" | "nombre" | "rubroId">[], excluirId?: string) {
  const n = normalizar(nombre);
  return productos.find((p) => p.id !== excluirId && p.rubroId === rubroId && normalizar(p.nombre) === n);
}

// ───────────────────────── Códigos ─────────────────────────

/**
 * Los próximos `n` códigos del rubro (prefijo + correlativo), saltando los que ya existen o están
 * reservados (ej. los de otras filas de la misma serie). Si el rubro no tiene prefijo, sigue la
 * numeración del código de `referencia`.
 */
export function siguientesCodigos(rubroId: string, productos: Pick<Producto, "codigo" | "rubroId">[], rubros: Pick<Rubro, "id" | "prefijo">[], n: number, reservados: Iterable<string> = []): string[] {
  const usados = new Set([...productos.map((p) => p.codigo.toUpperCase()), ...[...reservados].map((c) => c.toUpperCase())]);
  const r = rubros.find((x) => x.id === rubroId);
  const prefijo = r?.prefijo ?? "";
  const max = productos.filter((p) => p.rubroId === rubroId && /^\d+$/.test(p.codigo) && p.codigo.startsWith(prefijo)).reduce((m, p) => Math.max(m, Number(p.codigo)), 0);
  let siguiente = max ? max + 1 : Number(`${prefijo}001`) || 1;
  const out: string[] = [];
  while (out.length < n) {
    const c = String(siguiente++);
    if (!usados.has(c)) {
      out.push(c);
      usados.add(c);
    }
  }
  return out;
}

// ───────────────────────── Pegar desde Excel ─────────────────────────

export { numeroAR };

export interface FilaPegada {
  variante: string;
  peso?: number;
  costo?: number;
}

/**
 * Filas pegadas desde Excel: columnas separadas por tabulación (o por 2+ espacios / punto y coma)
 * en el orden variante, peso, costo. Se ignoran las filas vacías y una cabecera sin números.
 */
export function parsearPegado(texto: string): FilaPegada[] {
  const out: FilaPegada[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    if (!linea.trim()) continue;
    const cols = (linea.includes("\t") ? linea.split("\t") : linea.split(/\s{2,}|;/)).map((c) => c.trim());
    const [variante = "", peso = "", costo = ""] = cols;
    const p = numeroAR(peso);
    const c = numeroAR(costo);
    if (!out.length && Number.isNaN(p) && Number.isNaN(c) && /[a-z]/i.test(peso + costo)) continue; // cabecera
    out.push({ variante, peso: Number.isNaN(p) ? undefined : p, costo: Number.isNaN(c) ? undefined : c });
  }
  return out;
}
