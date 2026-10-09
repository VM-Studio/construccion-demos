# Operación · VM Studio

Guía interna para mantener el sistema de Aceros RNF en producción.

## Accesos necesarios

| Servicio | Para qué | Dónde |
|---|---|---|
| **GitHub** `VM-Studio/construccion-demos` | código, CI, backups (Actions) y secrets | github.com |
| **Vercel** `vmstudios-projects/construccion-demos` | deploys, variables de entorno, crons, logs, Blob | vercel.com |
| **Neon** proyecto `aceros-rnf` (`muddy-boat-24470073`, org `org-soft-frog-47995096`) | base: branches `main` (prod), `staging`, `desarrollo`, `test` | console.neon.tech |
| **Cloudflare R2** bucket `aceros-rnf-backups` | copias diarias | dash.cloudflare.com |
| **Sentry** proyecto `aceros-rnf` | errores y acciones lentas | sentry.io |
| **UptimeRobot** | aviso si `/api/salud` deja de responder | uptimerobot.com |

Nunca se escriben credenciales en el repo. Viven en Vercel (variables de entorno), en los secrets de GitHub y en los `.env.local` / `.env.test` de cada máquina (ignorados por git).

## Deployar

**Regla: nunca deployar a producción sin pasar por staging.** El flujo completo está en [FLUJO-DE-CAMBIOS.md](FLUJO-DE-CAMBIOS.md):

```
rama → staging (preview + base staging) → probar → PR a main → CI verde → merge → producción
```

- Producción se deploya sola al mergear a `main` (`pnpm vercel-build` = migraciones + seed de estructura + build).
- Volver atrás: Vercel → Deployments → deploy anterior → "Promote to Production".
- Después de cada deploy: `https://construccion-demos.vercel.app/api/salud` tiene que devolver `"ok": true`.

## Restaurar

Ver [BACKUPS.md](BACKUPS.md). Resumen:

1. Para errores recientes, restore point-in-time de Neon, primero en un branch nuevo.
2. Si no alcanza: `pnpm db:restore <archivo>` desde R2, primero sobre `test` y recién después sobre producción con `--confirmo-produccion`.

## Monitoreo

- **UptimeRobot**, monitor HTTP(s) cada 5 minutos a `https://construccion-demos.vercel.app/api/salud` (o el dominio propio), con alerta por mail. Para darlo de alta: uptimerobot.com → Sign up (gratuito) → **+ New monitor** → Monitor type **HTTP(s)** → Friendly name "Aceros RNF" → URL `…/api/salud` → Monitoring interval **5 minutes** → Alert contacts: tu mail → **Create monitor**. Opcional: en "Advanced", "Keyword exists" con `"ok":true` para que alerte también si la base o Blob fallan.
  - `/api/salud` devuelve `{ ok, db, blob, cambiosUltimoId, ultimaCotizacion, version }` y responde 503 si la base o Blob fallan.
  - **Antes de que UptimeRobot llegue:** la protección de Vercel tiene que estar desactivada en Production; si no, el monitor ve un 401.
- **Sentry:** errores de servidor y navegador con el id del usuario (nunca email), sin cuerpos de formularios ni contraseñas o tokens. Las server actions que tardan más de 5 s llegan como evento "Acción lenta" (tag `tipo:lento`). Alertas por mail en cada error nuevo (Alerts → "Alert me on every new issue").
- **Logs de Vercel:** cada server action deja `[accion] nombre N ms`, con `console.warn` desde 2 s.
- **Crons** (`vercel.json`): dólar a las 10:35 y 16:05 en días hábiles, y mantenimiento diario a las 03:00 (purga `Cambio` de más de 7 días y los ingresos fallidos de más de 90 días).

## Revisión del primer día de cada mes

1. **Pagos:** Vercel (Pro), Neon (Launch) y que ninguna tarjeta esté por vencer. Revisar el consumo contra el límite de gasto.
2. **Backups:** GitHub → Actions → "Backup diario", todos en verde. En R2 tiene que haber ~35 diarios más los mensuales. **Cada 3 meses, una restauración de prueba** sobre `test`, anotada en BACKUPS.md.
3. **Errores:** Sentry → Issues del último mes, y acciones lentas (`tipo:lento`).
4. **Espacio en Neon:** consola → Usage. Con el plan gratuito, los 512 MB son de todo el proyecto: si se llenan, producción deja de poder escribir.
5. **Dependencias:** PRs de Dependabot (los lunes), siempre por staging.
6. **Usuarios:** con un dueño, revisar que no queden usuarios activos de gente que ya no trabaja ahí.

## Comandos útiles

```bash
pnpm test                    # unitarios (reglas del dominio)
pnpm test:integracion        # contra el branch test de Neon (.env.test)
pnpm db:check                # consistencia de la base (DATABASE_URL)
pnpm db:restore -- --listar  # backups en R2
pnpm db:seed:carga -- --liviana && pnpm db:rendimiento   # mediciones (ver RENDIMIENTO.md)
npx neonctl branches reset test --parent --project-id muddy-boat-24470073
```
