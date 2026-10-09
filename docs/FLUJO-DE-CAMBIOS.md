# Flujo de cambios

Aceros RNF usa el sistema todos los días: **ningún cambio llega a producción sin pasar por staging**.

## Entornos

| Entorno | Rama de Git | Deploy en Vercel | Base (Neon) | Acceso |
|---|---|---|---|---|
| Producción | `main` | Production (`construccion-demos.vercel.app` / dominio propio) | branch `main` | público con login de la app |
| Staging | `staging` | Preview (`construccion-demos-git-staging-vmstudios-projects.vercel.app`) | branch `staging` | protegido con el login de Vercel |
| Otras ramas / PR | cualquiera | Preview | branch `staging` (compartido) | protegido con el login de Vercel |
| Local | — | `pnpm dev` | branch `desarrollo` (`.env.local`) | — |
| Tests de integración | — | — | branch `test` (`.env.test` / secret de CI) | — |

Las variables `DATABASE_URL`, `DIRECT_URL` y `DATABASE_URL_UNPOOLED` del entorno **Preview** de Vercel apuntan al branch `staging` de Neon. Ningún preview puede escribir en la base de producción. `AUTH_URL` solo existe en Production; en los previews Auth.js usa el host del pedido (`trustHost`).

## Paso a paso

1. **Rama de trabajo** desde `staging`: `git switch staging && git pull && git switch -c mi-cambio`.
2. Desarrollar y probar en local (`pnpm dev`, `pnpm test`).
3. **Merge a `staging`** (`git switch staging && git merge mi-cambio && git push`). Vercel despliega el preview de staging: corre las migraciones y el seed de estructura sobre el branch `staging` de Neon.
4. **Probar en la URL de staging** con un usuario de prueba (el branch `staging` arranca vacío: el primero que entra se registra como dueño).
5. **PR de `staging` a `main`** en GitHub. CI corre tipos, lint, tests unitarios, build y los tests de integración contra el branch `test`.
6. **CI verde → merge**. Si CI falla, no se mergea (main está protegida).
7. Vercel despliega producción (`pnpm vercel-build`: `prisma migrate deploy` + seed de estructura + build).
8. Verificar `/api/salud` en producción.

## Migraciones

- **Nunca borrar columnas ni tablas en la misma migración que las deja de usar.** Primero se deploya el código que ya no las usa; recién en un deploy posterior, otra migración las elimina. Así un rollback del código no rompe contra una base ya modificada.
- Toda migración corre **primero en staging** (paso 3) antes del PR a main.
- Las migraciones se generan contra la base local (`desarrollo`). Nunca usar una base real como *shadow database* de `prisma migrate diff/dev`.
- Cambios de datos masivos: script idempotente en `scripts/`, probado en staging, y con backup del día verificado (ver [BACKUPS.md](BACKUPS.md)).

## Volver atrás

- **Código:** en Vercel → Deployments → el deploy anterior → "Promote to Production" (instantáneo).
- **Datos:** Neon guarda historial (point-in-time restore) y hay backup diario propio en Cloudflare R2. Ver [BACKUPS.md](BACKUPS.md).

## Refrescar staging con datos reales

Para probar con datos parecidos a los reales se puede reiniciar `staging` desde producción. Esto **borra todo lo que haya en staging**:

```bash
npx neonctl branches reset staging --parent --project-id muddy-boat-24470073
```

Los usuarios y contraseñas de producción quedan copiados en staging: usarlo solo con el equipo de VM Studio.
