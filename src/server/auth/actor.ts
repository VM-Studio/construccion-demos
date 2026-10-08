import "server-only";
/**
 * Actor de la sesión. STUB hasta R2 (Auth.js): lee la cookie `actor-demo` con el id del usuario
 * y lo busca en la base. Ninguna acción acepta rol ni usuarioId del cliente: siempre sale de acá.
 */
import { cookies, headers } from "next/headers";
import type { Usuario } from "@/domain/types";
import { obtenerEstado } from "../estado";

export const COOKIE_ACTOR = "actor-demo";

export async function obtenerActor(): Promise<Usuario | null> {
  const id = (await cookies()).get(COOKIE_ACTOR)?.value;
  if (!id) return null;
  const { db } = await obtenerEstado();
  return db.usuarios.find((u) => u.id === id && u.activo) ?? null;
}

export class ErrorSesion extends Error {
  readonly codigo = "SESION";
  constructor() {
    super("Tu sesión terminó. Volvé a ingresar.");
  }
}

export async function exigirActor(): Promise<Usuario> {
  const a = await obtenerActor();
  if (!a) throw new ErrorSesion();
  return a;
}

/** IP y navegador para la auditoría. */
export async function datosRequest(): Promise<{ ip?: string; userAgent?: string }> {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined, userAgent: h.get("user-agent") ?? undefined };
}
