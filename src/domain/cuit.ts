const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Calcula el dígito verificador de un CUIT a partir de sus primeros 10 dígitos. */
export function digitoVerificadorCUIT(base10: string): number {
  const digits = base10.replace(/\D/g, "").slice(0, 10).split("").map(Number);
  const suma = digits.reduce((a, d, i) => a + d * PESOS[i], 0);
  const resto = 11 - (suma % 11);
  if (resto === 11) return 0;
  if (resto === 10) return 9;
  return resto;
}

/** Formatea 11 dígitos como `30-12345678-9`. */
export function formatearCUIT(cuit: string): string {
  const d = cuit.replace(/\D/g, "");
  if (d.length !== 11) return cuit;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/**
 * Valida formato (XX-XXXXXXXX-X) y dígito verificador de un CUIT/CUIL.
 * Devuelve un mensaje de error o null si es válido.
 */
export function validarCUIT(cuit: string): string | null {
  const d = (cuit ?? "").replace(/\D/g, "");
  if (d.length !== 11) return "El CUIT debe tener 11 dígitos (XX-XXXXXXXX-X).";
  if (!["20", "23", "24", "27", "30", "33", "34"].includes(d.slice(0, 2))) return "El prefijo del CUIT no es válido.";
  if (digitoVerificadorCUIT(d.slice(0, 10)) !== Number(d[10])) return "El dígito verificador no coincide.";
  return null;
}

/** Genera un CUIT válido a partir de prefijo y DNI/número de 8 dígitos. */
export function generarCUIT(prefijo: string, numero: number): string {
  const base = `${prefijo}${String(numero).padStart(8, "0")}`;
  return formatearCUIT(`${base}${digitoVerificadorCUIT(base)}`);
}
