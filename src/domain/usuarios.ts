import type { Rol, Usuario } from "./types";

/**
 * Reglas de administración de usuarios (puras): protegen que siempre quede al menos un dueño
 * activo y que nadie se cambie a sí mismo el rol ni se desactive.
 * Devuelve el mensaje de error o null si el cambio es válido.
 */
export function validarCambioUsuario(usuarios: Pick<Usuario, "id" | "rol" | "activo">[], actorId: string, id: string, cambio: { rol?: Rol; activo?: boolean }): string | null {
  const actual = usuarios.find((u) => u.id === id);
  if (!actual) return "El usuario no existe.";
  const rol = cambio.rol ?? actual.rol;
  const activo = cambio.activo ?? actual.activo;
  if (id === actorId && rol !== actual.rol) return "No podés cambiar tu propio rol.";
  if (id === actorId && !activo) return "No podés desactivar tu propio usuario.";
  const duenosActivos = usuarios.filter((u) => u.rol === "DUENO" && u.activo);
  const dejaDeSerDuenoActivo = actual.rol === "DUENO" && actual.activo && (rol !== "DUENO" || !activo);
  if (dejaDeSerDuenoActivo && duenosActivos.length <= 1) return "Tiene que quedar al menos un dueño activo.";
  return null;
}

/** Contraseña aceptable: mínimo 10 caracteres y que no contenga el email ni su parte local. */
export function validarPassword(password: string, email: string, anterior?: string): string | null {
  if (password.length < 10) return "La contraseña tiene que tener al menos 10 caracteres.";
  const e = email.toLowerCase();
  const local = e.split("@")[0];
  const p = password.toLowerCase();
  if (p.includes(e) || (local.length >= 3 && p.includes(local))) return "La contraseña no puede contener tu email.";
  if (anterior !== undefined && password === anterior) return "La contraseña nueva tiene que ser distinta de la anterior.";
  return null;
}

/** Fortaleza 0–4 para el indicador (largo, mayúsculas/minúsculas, números, símbolos). */
export function fortalezaPassword(p: string): number {
  let n = 0;
  if (p.length >= 10) n++;
  if (p.length >= 14) n++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) n++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) n++;
  return Math.min(4, n);
}

const SIN_AMBIGUOS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Contraseña temporal de 12 caracteres (letras y números, sin 0/O, 1/l/I) con un generador seguro. */
export function generarPasswordTemporal(aleatorio: (n: number) => Uint8Array): string {
  const bytes = aleatorio(12);
  let out = "";
  for (const b of bytes) out += SIN_AMBIGUOS[b % SIN_AMBIGUOS.length];
  // Garantiza al menos un número y una mayúscula.
  if (!/\d/.test(out)) out = out.slice(0, 11) + "7";
  if (!/[A-Z]/.test(out)) out = "K" + out.slice(1);
  return out;
}

export function inicialesDe(nombre: string, apellido?: string): string {
  const partes = [nombre, apellido ?? ""].join(" ").split(/\s+/).filter(Boolean);
  return (partes.slice(0, 2).map((w) => w[0]).join("") || "U").toUpperCase();
}
