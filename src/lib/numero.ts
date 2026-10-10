/**
 * Número escrito por una persona en Argentina: "5.900" → 5900, "4,74" → 4,74, "1.234,56" →
 * 1234,56, "1757509.28" → 1757509,28 (punto decimal, como sale del teclado numérico o de Excel).
 * Con coma, los puntos son miles. Sin coma, un punto es de miles solo si separa grupos de 3
 * ("5.900", "1.234.567"); si no, es el decimal.
 */
export function numeroAR(texto: string): number {
  const s = (texto ?? "").replace(/[^\d.,-]/g, "");
  if (!s) return Number.NaN;
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return Number(s);
}
