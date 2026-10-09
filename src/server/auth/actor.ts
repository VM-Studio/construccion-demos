import "server-only";
/**
 * Actor de la sesión (Auth.js). Ninguna acción acepta rol ni usuarioId del cliente: siempre se
 * resuelve acá desde la cookie de sesión firmada y se busca el usuario en la base.
 */
import { headers } from "next/headers";
import { auth } from "@/auth";
import type { Usuario } from "@/domain/types";
import { estadoEnCache, obtenerEstado } from "../estado";

export async function obtenerActor(): Promise<Usuario | null> {
  const s = await auth();
  const id = s?.user?.id;
  if (!id || s.user.invalida || s.user.debeCambiarPassword) return null;
  const { db } = await obtenerEstado();
  return db.usuarios.find((u) => u.id === id && u.activo) ?? null;
}

/**
 * Variante liviana para rutas de polling (/api/cambios): la sesión ya viene verificada por
 * Auth.js (versión y activo, caché 60 s); usa los usuarios de la caché de la instancia.
 */
export async function obtenerActorLigero(): Promise<Pick<Usuario, "id" | "rol" | "activo"> | null> {
  const s = await auth();
  const id = s?.user?.id;
  if (!id || s.user.invalida) return null;
  const enCache = estadoEnCache()?.db.usuarios.find((u) => u.id === id);
  if (enCache) return enCache.activo ? enCache : null;
  return obtenerActor();
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
