"use server";
/**
 * Server actions de autenticación y usuarios. Entradas validadas con zod; el actor sale siempre
 * de la sesión (nunca del cliente). Los mensajes de error nunca revelan si un email existe.
 */
import { AuthError } from "next-auth";
import { z } from "zod";
import { auth, signIn, signOut, unstable_update } from "@/auth";
import { datosRequest, exigirActor, ErrorSesion } from "../auth/actor";
import * as srv from "../auth/servicio";
import { invalidarCache } from "../estado";

type Res<T = void> = { ok: true; data: T } | { ok: false; error: string; codigo?: string };

const email = z.string().trim().email("Ingresá un email válido.").max(200);
const password = z.string().min(1).max(200);

export async function ingresar(datos: { email: string; password: string; recordar: boolean }): Promise<Res> {
  const e = z.object({ email, password, recordar: z.boolean() }).safeParse(datos);
  if (!e.success) return { ok: false, error: "Email o contraseña incorrectos." };
  try {
    await signIn("credentials", { email: e.data.email, password: e.data.password, recordar: e.data.recordar ? "si" : "no", redirect: false });
    return { ok: true, data: undefined };
  } catch (err) {
    if (err instanceof AuthError) {
      const code = (err as AuthError & { code?: string }).code;
      if (code === "bloqueado") return { ok: false, error: "Demasiados intentos, probá en 15 minutos.", codigo: "BLOQUEADO" };
      if (code === "inactivo") return { ok: false, error: "Tu usuario fue desactivado.", codigo: "INACTIVO" };
      return { ok: false, error: "Email o contraseña incorrectos.", codigo: "CREDENCIALES" };
    }
    throw err;
  }
}

export async function salir() {
  await signOut({ redirect: false });
}

const esquemaRegistro = z.object({ nombre: z.string().trim().min(2, "Ingresá tu nombre.").max(80), apellido: z.string().trim().max(80), email, password: z.string().min(10, "La contraseña tiene que tener al menos 10 caracteres.").max(200) });

/** Primer ingreso: crea al primer dueño e inicia su sesión. Rechaza siempre si ya hay usuarios. */
export async function registrarPrimerDueno(datos: { nombre: string; apellido: string; email: string; password: string }): Promise<Res> {
  const e = esquemaRegistro.safeParse(datos);
  if (!e.success) return { ok: false, error: e.error.issues[0]?.message ?? "Revisá los datos." };
  const r = await srv.registrarPrimerDueno(e.data, await datosRequest());
  if (!r.ok) return r;
  invalidarCache();
  return ingresar({ email: e.data.email, password: e.data.password, recordar: false });
}

/** Cambio obligatorio de la contraseña temporal (primer ingreso o restablecida). */
export async function cambiarPasswordTemporal(nueva: string): Promise<Res> {
  const s = await auth();
  if (!s?.user?.id || s.user.invalida) return { ok: false, error: "Tu sesión terminó. Volvé a ingresar.", codigo: "SESION" };
  const p = z.string().min(10, "La contraseña tiene que tener al menos 10 caracteres.").max(200).safeParse(nueva);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const r = await srv.cambiarPassword(s.user.id, { nueva: p.data, forzado: true }, await datosRequest());
  if (!r.ok) return r;
  await unstable_update({ debeCambiarPassword: false } as never);
  return { ok: true, data: undefined };
}

async function conActor<T>(fn: (actor: Awaited<ReturnType<typeof exigirActor>>, req: srv.InfoRequest) => Promise<Res<T>>): Promise<Res<T>> {
  try {
    const actor = await exigirActor();
    const r = await fn(actor, await datosRequest());
    if (r.ok) invalidarCache();
    return r;
  } catch (e) {
    if (e instanceof ErrorSesion) return { ok: false, error: e.message, codigo: e.codigo };
    console.error("[usuarios]", e);
    return { ok: false, error: "Ocurrió un error inesperado. Probá de nuevo." };
  }
}

export async function cambiarMiPassword(datos: { actual: string; nueva: string }): Promise<Res> {
  const e = z.object({ actual: password, nueva: z.string().min(10, "La contraseña tiene que tener al menos 10 caracteres.").max(200) }).safeParse(datos);
  if (!e.success) return { ok: false, error: e.error.issues[0]?.message ?? "Revisá los datos." };
  return conActor((actor, req) => srv.cambiarPassword(actor.id, { actual: e.data.actual, nueva: e.data.nueva, forzado: false }, req));
}

export async function actualizarMiCuenta(datos: { nombre: string; apellido: string }): Promise<Res> {
  const e = z.object({ nombre: z.string().trim().min(2).max(80), apellido: z.string().trim().max(80) }).safeParse(datos);
  if (!e.success) return { ok: false, error: "Ingresá tu nombre." };
  return conActor((actor, req) => srv.actualizarMiCuenta(actor.id, e.data, req));
}

const rol = z.enum(["DUENO", "ADMINISTRACION", "VENTAS", "DEPOSITO"]);
const id = z.string().min(1).max(100);

export async function crearUsuario(datos: { nombre: string; apellido: string; email: string; rol: "DUENO" | "ADMINISTRACION" | "VENTAS" | "DEPOSITO"; sucursalId?: string | null }): Promise<Res<{ id: string; passwordTemporal: string }>> {
  const e = z.object({ nombre: z.string().trim().min(2, "Ingresá el nombre.").max(80), apellido: z.string().trim().max(80), email, rol, sucursalId: z.string().max(100).nullable().optional() }).safeParse(datos);
  if (!e.success) return { ok: false, error: e.error.issues[0]?.message ?? "Revisá los datos." };
  return conActor((actor, req) => srv.crearUsuario(actor, e.data, req));
}

export async function restablecerPassword(usuarioId: string): Promise<Res<{ passwordTemporal: string; email: string }>> {
  const e = id.safeParse(usuarioId);
  if (!e.success) return { ok: false, error: "Usuario inválido." };
  return conActor((actor, req) => srv.restablecerPassword(actor, e.data, req));
}

export async function cerrarSesionesDe(usuarioId: string): Promise<Res> {
  const e = id.safeParse(usuarioId);
  if (!e.success) return { ok: false, error: "Usuario inválido." };
  return conActor((actor, req) => srv.cerrarSesiones(actor, e.data, req));
}

export async function cambiarActivoUsuario(usuarioId: string, activo: boolean): Promise<Res> {
  const e = z.object({ id, activo: z.boolean() }).safeParse({ id: usuarioId, activo });
  if (!e.success) return { ok: false, error: "Datos inválidos." };
  return conActor((actor, req) => srv.cambiarActivo(actor, e.data.id, e.data.activo, req));
}
