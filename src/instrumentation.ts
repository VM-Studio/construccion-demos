/** Sentry en el servidor (Node y edge). Los errores de pedidos llegan por `onRequestError`. */
import * as Sentry from "@sentry/nextjs";
import { opcionesSentry } from "@/lib/sentry-opciones";

export async function register() {
  Sentry.init(opcionesSentry(process.env.SENTRY_DSN));
}

export const onRequestError = Sentry.captureRequestError;
