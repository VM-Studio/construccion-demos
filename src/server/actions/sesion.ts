"use server";
/**
 * Sesión — STUB hasta R2 (Auth.js con email y contraseña).
 * El "ingreso" elige un usuario existente y guarda su id en la cookie httpOnly `actor-demo`;
 * el servidor siempre resuelve el actor desde esa cookie (nunca desde datos del cliente).
 */
import { cookies } from "next/headers";
import { z } from "zod";
import { COOKIE_ACTOR } from "../auth/actor";
import { obtenerEstado } from "../estado";
import { registrarPrimerDueno } from "../servicios/configuracion";

const opcionesCookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 12 };

export async function ingresar(usuarioId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = z.string().min(1).max(100).safeParse(usuarioId);
  if (!id.success) return { ok: false, error: "Usuario inválido." };
  const { db } = await obtenerEstado();
  const u = db.usuarios.find((x) => x.id === id.data && x.activo);
  if (!u) return { ok: false, error: "El usuario no existe o está desactivado." };
  (await cookies()).set(COOKIE_ACTOR, u.id, opcionesCookie);
  return { ok: true };
}

export async function salir() {
  (await cookies()).delete(COOKIE_ACTOR);
}

const esquemaPrimerDueno = z.object({ nombre: z.string().trim().min(2).max(80), email: z.string().trim().email().max(120) });

/** Primer ingreso con la base sin usuarios: crea al primer DUEÑO e inicia su sesión. */
export async function crearPrimerDueno(datos: { nombre: string; email: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = esquemaPrimerDueno.safeParse(datos);
  if (!e.success) return { ok: false, error: "Completá nombre y un email válido." };
  const r = await registrarPrimerDueno(e.data);
  if (!r.ok) return r;
  (await cookies()).set(COOKIE_ACTOR, r.id, opcionesCookie);
  return { ok: true };
}
