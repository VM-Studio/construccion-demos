import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { customAlphabet } from "nanoid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

/** Genera un id único con prefijo legible, ej. `prod_k2j3h4g5f6`. */
export function newId(prefix: string): string {
  return `${prefix}_${nano()}`;
}

/**
 * Devuelve el número siguiente de una secuencia tipo `OC-00001`.
 * @param prefix prefijo sin guion (ej. "OC")
 * @param current último número usado (0 si no hay)
 */
export function nextNumber(prefix: string, current: number, padding = 5): string {
  return `${prefix}-${String(current + 1).padStart(padding, "0")}`;
}

/** Redondea a 2 decimales evitando errores de coma flotante. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Suma una lista de números. */
export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Agrupa una lista por clave. */
export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}

/** Indexa una lista por id. */
export function indexBy<T extends { id: string }>(items: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of items) out[item.id] = item;
  return out;
}

/** Normaliza texto para búsquedas (sin tildes, minúsculas). */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Descarga un archivo de texto generado en el cliente. */
export function descargarArchivo(nombre: string, contenido: string, tipo = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Convierte filas a CSV (separador `;` para Excel en es-AR). */
export function aCSV(encabezados: string[], filas: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [encabezados.map(esc).join(";"), ...filas.map((f) => f.map(esc).join(";"))].join("\n");
}
