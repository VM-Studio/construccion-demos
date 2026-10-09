# Backups

Regla 3-2-1: los datos están en **Neon** (base de producción), en el **historial de Neon** (point-in-time restore) y en una **copia diaria propia en Cloudflare R2**, en otro proveedor.

| Capa | Dónde | Cuánto tiempo | Cómo se vuelve |
|---|---|---|---|
| Base viva | Neon, branch `main` (us-east-1) | — | — |
| Historial (PITR) | Neon | 6 h en plan gratuito · **7 días en Launch** | Consola de Neon → Branches → Restore |
| Copia diaria | Cloudflare R2, bucket `aceros-rnf-backups` | 35 diarios + el primero de cada mes por 12 meses | `pnpm db:restore` (abajo) |
| Archivos adjuntos | Vercel Blob privado | sin vencimiento | — (no entran en el dump) |

## Backup diario automático

`.github/workflows/backup.yml` corre todos los días a las **04:00 de Argentina** (07:00 UTC) y se puede disparar a mano (GitHub → Actions → "Backup diario" → Run workflow, o `gh workflow run backup.yml`). Hace esto:

1. `pg_dump --no-owner --no-privileges --format=custom` de producción con **pg_dump 18**. Neon corre Postgres 18, y un pg_dump más viejo no puede volcarlo.
2. Lo comprime con gzip y verifica que se pueda leer (`pg_restore --list`).
3. Lo sube a R2 como `aceros-rnf-AAAA-MM-DD.dump.gz` (con `rclone`) y comprueba que el tamaño en R2 sea mayor a 0 e igual al local.
4. Aplica la retención: conserva los últimos 35 diarios y el primero de cada mes de los últimos 12 meses, y borra el resto.

Si cualquier paso falla, el workflow queda en rojo y GitHub manda un mail al dueño del repo. Para que llegue: GitHub → Settings → Notifications → Actions → "Send notifications for failed workflows only".

Secrets del repo, cargados con `gh secret set`: `BACKUP_DATABASE_URL` (conexión **directa**, sin `-pooler`, a producción), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`.

## Restaurar

### Con el script (recomendado)

Requisitos locales: `brew install rclone postgresql@18`. En `.env.local` (nunca en el repo) van `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `DATABASE_URL_RESTORE`, que es la base destino con conexión directa.

```bash
pnpm db:restore -- --listar                          # ver qué backups hay en R2
pnpm db:restore aceros-rnf-2026-10-09.dump.gz        # descarga de R2 y restaura en DATABASE_URL_RESTORE
pnpm db:restore ./aceros-rnf-2026-10-09.dump.gz      # o desde un archivo local
```

El script se niega a restaurar sobre producción salvo con `--confirmo-produccion`.

### A mano (sin el repo)

```bash
# 1. Bajar el archivo desde la consola de Cloudflare (R2 → aceros-rnf-backups) o con rclone
gunzip -c aceros-rnf-2026-10-09.dump.gz > backup.dump

# 2. Restaurar en una base vacía (o pisando la existente: --clean --if-exists)
pg_restore --no-owner --no-privileges --clean --if-exists --single-transaction \
  --dbname="postgresql://USUARIO:CLAVE@HOST/neondb?sslmode=require" backup.dump
```

### Restaurar producción ante un desastre

1. **Primero probá en un branch:** crear `restauracion` en Neon desde la consola (o `neonctl branches create --name restauracion`), restaurar ahí y revisar los datos.
2. Si es reciente (menos de 7 días con Launch), suele ser mejor el **restore point-in-time de Neon** al minuto anterior al problema: no pierde nada de lo que pasó antes.
3. Si hay que usar el dump: restaurar sobre `main` con `--confirmo-produccion` fuera del horario de trabajo y verificar con `pnpm db:check`.

## Pruebas de restauración

| Fecha | Backup | Destino | Resultado |
|---|---|---|---|
| _pendiente: primera prueba al configurar R2_ | | branch `test` | |
