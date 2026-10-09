/** Sentry en el navegador. */
import * as Sentry from "@sentry/nextjs";
import { opcionesSentry } from "@/lib/sentry-opciones";

Sentry.init(opcionesSentry(process.env.NEXT_PUBLIC_SENTRY_DSN));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
