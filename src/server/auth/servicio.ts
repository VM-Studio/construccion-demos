/**
 * Servicio de autenticación y administración de usuarios (servidor).
 * Es el ÚNICO lugar que lee o escribe passwordHash, intentosFallidos, bloqueadoHasta y
 * sesionVersion (el mapeo genérico los excluye). Toda operación queda en Auditoria con IP y
 * navegador, y publica un Cambio de tipo Usuario para que las pantallas se actualicen.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { puede } from "@/domain/permisos";
import type { Rol, Usuario } from "@/domain/types";
import { generarPasswordTemporal, inicialesDe, validarCambioUsuario, validarPassword } from "@/domain/usuarios";
import { prisma } from "../db-base";

const COSTO = 12;
/** Hash de una contraseña aleatoria: se compara contra él cuando el email no existe (tiempos parejos). */
const HASH_DUMMY = bcrypt.hashSync(randomBytes(24).toString("hex"), COSTO);
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

export interface InfoRequest {
  ip?: string;
  userAgent?: string;
}

export type ResultadoAuth<T = void> = { ok: true; data: T } | { ok: false; error: string; codigo?: string };

async function auditar(db: Prisma.TransactionClient | typeof prisma, usuarioId: string, accion: string, entidadId: string, detalle: string, req: InfoRequest = {}) {
  await db.auditoria.create({ data: { fecha: new Date(), usuarioId, accion, entidad: "Usuario", entidadId, detalle, ip: req.ip ?? null, userAgent: req.userAgent?.slice(0, 300) ?? null } });
}

async function publicar(db: Prisma.TransactionClient | typeof prisma, usuarioId: string | null, ids: string[], resumen?: string) {
  await db.cambio.create({ data: { tipos: ["Usuario"], entidadIds: ids, usuarioId, resumen: resumen ?? null } });
}

const normalizarEmail = (e: string) => e.trim().toLowerCase();

// ───────────── Estado de sesión (cacheado 60 s por instancia) ─────────────

export interface EstadoSesion {
  activo: boolean;
  sesionVersion: number;
  debeCambiarPassword: boolean;
  rol: Rol;
  nombre: string;
  sucursalId: string | null;
}
const cacheSesion = new Map<string, { hasta: number; valor: EstadoSesion | null }>();

export async function estadoSesion(id: string): Promise<EstadoSesion | null> {
  const c = cacheSesion.get(id);
  if (c && c.hasta > Date.now()) return c.valor;
  const u = await prisma.usuario.findUnique({ where: { id }, select: { activo: true, sesionVersion: true, debeCambiarPassword: true, rol: true, nombre: true, sucursalId: true } });
  cacheSesion.set(id, { hasta: Date.now() + 60_000, valor: u });
  return u;
}

export function olvidarSesion(id: string) {
  cacheSesion.delete(id);
}

export async function hayUsuarios(): Promise<boolean> {
  return (await prisma.usuario.count()) > 0;
}

// ───────────── Ingreso ─────────────

/** Intentos fallidos con emails inexistentes (para que el bloqueo no revele si el email existe). */
const intentosDesconocidos = new Map<string, { n: number; hasta: number }>();

export type ResultadoCredenciales = { ok: true; usuario: { id: string; nombre: string; email: string; rol: Rol; sucursalId: string | null; sesionVersion: number; debeCambiarPassword: boolean } } | { ok: false; motivo: "credenciales" | "bloqueado" | "inactivo" };

export async function verificarCredenciales(emailCrudo: string, password: string, req: InfoRequest): Promise<ResultadoCredenciales> {
  const email = normalizarEmail(emailCrudo);
  const u = await prisma.usuario.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  const ahora = Date.now();

  if (!u) {
    await bcrypt.compare(password, HASH_DUMMY);
    const d = intentosDesconocidos.get(email);
    const bloqueado = d && d.hasta > ahora && d.n >= MAX_INTENTOS;
    const n = d && d.hasta > ahora ? d.n + 1 : 1;
    intentosDesconocidos.set(email, { n, hasta: ahora + BLOQUEO_MS });
    if (intentosDesconocidos.size > 5000) intentosDesconocidos.clear();
    await auditar(prisma, "anonimo", "Ingreso fallido", "anonimo", email, req);
    return { ok: false, motivo: bloqueado || n >= MAX_INTENTOS ? "bloqueado" : "credenciales" };
  }

  if (u.bloqueadoHasta && u.bloqueadoHasta.getTime() > ahora) {
    await bcrypt.compare(password, HASH_DUMMY);
    await auditar(prisma, u.id, "Ingreso rechazado: usuario bloqueado", u.id, email, req);
    return { ok: false, motivo: "bloqueado" };
  }

  const coincide = await bcrypt.compare(password, u.passwordHash);
  if (!coincide) {
    const intentos = u.intentosFallidos + 1;
    if (intentos >= MAX_INTENTOS) {
      await prisma.usuario.update({ where: { id: u.id }, data: { intentosFallidos: 0, bloqueadoHasta: new Date(ahora + BLOQUEO_MS) } });
      await auditar(prisma, u.id, "Ingreso fallido", u.id, email, req);
      await auditar(prisma, u.id, "Usuario bloqueado por intentos fallidos", u.id, `${MAX_INTENTOS} intentos · 15 minutos`, req);
      return { ok: false, motivo: "bloqueado" };
    }
    await prisma.usuario.update({ where: { id: u.id }, data: { intentosFallidos: intentos } });
    await auditar(prisma, u.id, "Ingreso fallido", u.id, email, req);
    return { ok: false, motivo: "credenciales" };
  }

  if (!u.activo) {
    await auditar(prisma, u.id, "Ingreso rechazado: usuario desactivado", u.id, email, req);
    return { ok: false, motivo: "inactivo" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id: u.id }, data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() } });
    await auditar(tx, u.id, "Ingresó al sistema", u.id, email, req);
    await publicar(tx, u.id, [u.id]);
  });
  olvidarSesion(u.id);
  return { ok: true, usuario: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, sucursalId: u.sucursalId, sesionVersion: u.sesionVersion, debeCambiarPassword: u.debeCambiarPassword } };
}

// ───────────── Primer dueño ─────────────

/**
 * Registro del primer dueño. Con `pg_advisory_xact_lock(1)` antes de contar: si dos personas se
 * registran a la vez, la segunda espera y encuentra que ya hay un usuario.
 */
export async function registrarPrimerDueno(datos: { nombre: string; apellido: string; email: string; password: string }, req: InfoRequest): Promise<ResultadoAuth<{ id: string }>> {
  const email = normalizarEmail(datos.email);
  const errPass = validarPassword(datos.password, email);
  if (errPass) return { ok: false, error: errPass };
  const hash = await bcrypt.hash(datos.password, COSTO);
  try {
    const id = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(1)`;
        if ((await tx.usuario.count()) > 0) return null;
        const u = await tx.usuario.create({
          data: { nombre: datos.nombre.trim(), apellido: datos.apellido.trim() || null, email, rol: "DUENO", activo: true, avatarIniciales: inicialesDe(datos.nombre, datos.apellido), passwordHash: hash, debeCambiarPassword: false, ultimoAcceso: new Date() },
        });
        await auditar(tx, u.id, "Registro del primer dueño", u.id, email, req);
        await publicar(tx, u.id, [u.id], "se registró como primer dueño");
        return u.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 },
    );
    return id ? { ok: true, data: { id } } : { ok: false, error: "El registro ya no está disponible.", codigo: "YA_REGISTRADO" };
  } catch (e) {
    console.error("[auth] registro", e);
    return { ok: false, error: "No se pudo crear la cuenta. Probá de nuevo." };
  }
}

// ───────────── Administración (solo DUEÑO) ─────────────

function temporal() {
  return generarPasswordTemporal((n) => new Uint8Array(randomBytes(n)));
}

export async function crearUsuario(actor: Usuario, datos: { nombre: string; apellido?: string; email: string; rol: Rol; sucursalId?: string | null }, req: InfoRequest): Promise<ResultadoAuth<{ id: string; passwordTemporal: string }>> {
  if (!puede(actor, "config.usuarios")) return { ok: false, error: "Solo un dueño puede crear usuarios.", codigo: "PERMISO" };
  const email = normalizarEmail(datos.email);
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "El email no es válido." };
  if ((datos.rol === "VENTAS" || datos.rol === "DEPOSITO") && !datos.sucursalId) return { ok: false, error: "Ventas y Depósito necesitan una sucursal asignada." };
  if (datos.sucursalId && !(await prisma.sucursal.findUnique({ where: { id: datos.sucursalId }, select: { id: true } }))) return { ok: false, error: "La sucursal no existe." };
  if (await prisma.usuario.findFirst({ where: { email: { equals: email, mode: "insensitive" } } })) return { ok: false, error: "Ya hay un usuario con ese email." };
  const pass = temporal();
  const hash = await bcrypt.hash(pass, COSTO);
  const u = await prisma.$transaction(async (tx) => {
    const n = await tx.usuario.create({
      data: { nombre: datos.nombre.trim(), apellido: datos.apellido?.trim() || null, email, rol: datos.rol, sucursalId: datos.sucursalId || null, activo: true, avatarIniciales: inicialesDe(datos.nombre, datos.apellido), passwordHash: hash, debeCambiarPassword: true },
    });
    await auditar(tx, actor.id, "Creó usuario", n.id, `${n.nombre} · ${n.rol} · ${email}`, req);
    await publicar(tx, actor.id, [n.id], `creó el usuario ${n.nombre}`);
    return n;
  });
  return { ok: true, data: { id: u.id, passwordTemporal: pass } };
}

export async function restablecerPassword(actor: Usuario, id: string, req: InfoRequest): Promise<ResultadoAuth<{ passwordTemporal: string; email: string }>> {
  if (!puede(actor, "config.usuarios")) return { ok: false, error: "Solo un dueño puede restablecer contraseñas.", codigo: "PERMISO" };
  const u = await prisma.usuario.findUnique({ where: { id } });
  if (!u) return { ok: false, error: "El usuario no existe." };
  const pass = temporal();
  const hash = await bcrypt.hash(pass, COSTO);
  await prisma.$transaction(async (tx) => {
    // Restablecer también cierra las sesiones abiertas de ese usuario.
    await tx.usuario.update({ where: { id }, data: { passwordHash: hash, debeCambiarPassword: true, intentosFallidos: 0, bloqueadoHasta: null, sesionVersion: { increment: 1 } } });
    await auditar(tx, actor.id, "Restableció contraseña", id, u.email, req);
    await publicar(tx, actor.id, [id]);
  });
  olvidarSesion(id);
  return { ok: true, data: { passwordTemporal: pass, email: u.email } };
}

export async function cerrarSesiones(actor: Usuario, id: string, req: InfoRequest): Promise<ResultadoAuth> {
  if (!puede(actor, "config.usuarios") && actor.id !== id) return { ok: false, error: "Solo un dueño puede cerrar sesiones de otros usuarios.", codigo: "PERMISO" };
  const u = await prisma.usuario.findUnique({ where: { id }, select: { email: true } });
  if (!u) return { ok: false, error: "El usuario no existe." };
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id }, data: { sesionVersion: { increment: 1 } } });
    await auditar(tx, actor.id, "Cerró las sesiones del usuario", id, u.email, req);
    await publicar(tx, actor.id, [id]);
  });
  olvidarSesion(id);
  return { ok: true, data: undefined };
}

/** Activa / desactiva (no se borra: la auditoría referencia al usuario). */
export async function cambiarActivo(actor: Usuario, id: string, activo: boolean, req: InfoRequest): Promise<ResultadoAuth> {
  if (!puede(actor, "config.usuarios")) return { ok: false, error: "Solo un dueño puede activar o desactivar usuarios.", codigo: "PERMISO" };
  const todos = await prisma.usuario.findMany({ select: { id: true, rol: true, activo: true, email: true } });
  const err = validarCambioUsuario(todos, actor.id, id, { activo });
  if (err) return { ok: false, error: err };
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id }, data: { activo, ...(activo ? {} : { sesionVersion: { increment: 1 } }) } });
    await auditar(tx, actor.id, activo ? "Reactivó usuario" : "Desactivó usuario", id, todos.find((u) => u.id === id)?.email ?? "", req);
    await publicar(tx, actor.id, [id]);
  });
  olvidarSesion(id);
  return { ok: true, data: undefined };
}

// ───────────── Cuenta propia ─────────────

export async function cambiarPassword(usuarioId: string, datos: { actual?: string; nueva: string; forzado: boolean }, req: InfoRequest): Promise<ResultadoAuth> {
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!u || !u.activo) return { ok: false, error: "Tu sesión terminó. Volvé a ingresar.", codigo: "SESION" };
  if (!datos.forzado) {
    if (!datos.actual || !(await bcrypt.compare(datos.actual, u.passwordHash))) {
      await auditar(prisma, u.id, "Cambio de contraseña rechazado", u.id, "contraseña actual incorrecta", req);
      return { ok: false, error: "La contraseña actual no es correcta." };
    }
  } else if (!u.debeCambiarPassword) return { ok: false, error: "No hay un cambio de contraseña pendiente." };
  const err = validarPassword(datos.nueva, u.email);
  if (err) return { ok: false, error: err };
  if (await bcrypt.compare(datos.nueva, u.passwordHash)) return { ok: false, error: datos.forzado ? "La contraseña nueva tiene que ser distinta de la temporal." : "La contraseña nueva tiene que ser distinta de la actual." };
  const hash = await bcrypt.hash(datos.nueva, COSTO);
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id: u.id }, data: { passwordHash: hash, debeCambiarPassword: false } });
    await auditar(tx, u.id, "Cambió su contraseña", u.id, datos.forzado ? "contraseña temporal reemplazada" : "desde Mi cuenta", req);
    await publicar(tx, u.id, [u.id]);
  });
  olvidarSesion(u.id);
  return { ok: true, data: undefined };
}

export async function actualizarMiCuenta(usuarioId: string, datos: { nombre: string; apellido?: string }, req: InfoRequest): Promise<ResultadoAuth> {
  const nombre = datos.nombre.trim();
  if (nombre.length < 2) return { ok: false, error: "Ingresá tu nombre." };
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id: usuarioId }, data: { nombre, apellido: datos.apellido?.trim() || null, avatarIniciales: inicialesDe(nombre, datos.apellido) } });
    await auditar(tx, usuarioId, "Editó su cuenta", usuarioId, nombre, req);
    await publicar(tx, usuarioId, [usuarioId]);
  });
  olvidarSesion(usuarioId);
  return { ok: true, data: undefined };
}
