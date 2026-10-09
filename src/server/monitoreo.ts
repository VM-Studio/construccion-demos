/** Monitoreo del servidor: usuario del pedido en Sentry y acciones lentas. */
import * as Sentry from "@sentry/nextjs";

/** Solo el id: nunca email ni nombre. */
export function usuarioEnSentry(id: string) {
  Sentry.setUser({ id });
}

/** Duración de cada acción: aviso en el log desde 2 s y evento "lento" en Sentry desde 5 s. */
export function registrarDuracion(nombre: string, ms: number, msSesion?: number) {
  const extra = msSesion !== undefined ? ` (sesión ${msSesion} ms)` : "";
  if (ms > 2000) console.warn(`[accion] ${nombre} tardó ${ms} ms${extra}`);
  else console.info(`[accion] ${nombre} ${ms} ms${extra}`);
  if (ms > 5000) Sentry.captureMessage(`Acción lenta: ${nombre}`, { level: "warning", tags: { tipo: "lento", accion: nombre }, extra: { ms } });
}
