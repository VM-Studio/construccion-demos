/**
 * Opciones comunes de Sentry (servidor, edge y navegador). Sin DSN no se envía nada.
 * Privacidad: solo el id del usuario (nunca email ni nombre), sin cuerpos de formularios,
 * cookies ni encabezados de autenticación, y cualquier campo que parezca contraseña o token
 * se reemplaza por "[filtrado]".
 */
import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const SENSIBLE = /pass|contrase|clave|token|secret|authorization|cookie|session|csrf|dsn|api[-_]?key|hash/i;

function limpiar(valor: unknown, prof = 0): unknown {
  if (prof > 6 || valor == null) return valor;
  if (typeof valor === "string") return valor.replace(/(postgres(?:ql)?:\/\/)[^\s"']+/gi, "$1[filtrado]").replace(/Bearer\s+[\w.-]+/gi, "Bearer [filtrado]");
  if (Array.isArray(valor)) return valor.map((v) => limpiar(v, prof + 1));
  if (typeof valor === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) o[k] = SENSIBLE.test(k) ? "[filtrado]" : limpiar(v, prof + 1);
    return o;
  }
  return valor;
}

export function antesDeEnviar(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  void _hint;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) event.request.headers = limpiar(event.request.headers) as Record<string, string>;
    if (event.request.query_string) event.request.query_string = "[filtrado]";
  }
  if (event.user) event.user = event.user.id ? { id: String(event.user.id) } : undefined;
  if (event.extra) event.extra = limpiar(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = limpiar(event.contexts) as typeof event.contexts;
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map((b) => ({ ...b, data: limpiar(b.data) as Record<string, unknown> | undefined, message: limpiar(b.message) as string | undefined }));
  if (event.message) event.message = limpiar(event.message) as string;
  return event;
}

export function opcionesSentry(dsn: string | undefined) {
  return {
    dsn,
    enabled: !!dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: antesDeEnviar,
  };
}
