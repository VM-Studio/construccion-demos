# Aceros RNF · Sistema de Gestión

Sistema de gestión a medida para Aceros RNF (corralón y ferretería), desarrollado por VM Studio. Incluye clientes y obras, acopios por monto con precios congelados, ventas, remitos con remito firmado, stock con pendiente de entrega, despachos con tiempos, compras y acopios con proveedores, cuentas corrientes y reportes. Es multiusuario, en vivo, sobre PostgreSQL.

- Reglas del negocio y de código: [CLAUDE.md](CLAUDE.md)
- Entrega al cliente: [docs/ENTREGA.md](docs/ENTREGA.md) · Operación: [docs/OPERACION.md](docs/OPERACION.md)
- Flujo de cambios (staging → producción): [docs/FLUJO-DE-CAMBIOS.md](docs/FLUJO-DE-CAMBIOS.md)
- Backups: [docs/BACKUPS.md](docs/BACKUPS.md) · Rendimiento: [docs/RENDIMIENTO.md](docs/RENDIMIENTO.md)

## Correrlo en local

```bash
pnpm i
vercel env pull .env.local   # variables de Development (base: branch `desarrollo` de Neon)
pnpm dev                     # http://localhost:3000
pnpm db:seed:ejemplo         # opcional: datos de ejemplo, solo en el branch desarrollo
```

La primera persona que entra a una base sin usuarios se registra como dueño.

## Pruebas

```bash
pnpm test               # unitarios del dominio (vitest)
pnpm test:integracion   # servicios contra el branch `test` de Neon (.env.test)
pnpm seed:check && pnpm flujos:check
```

CI (`.github/workflows/ci.yml`) corre tipos, lint, tests y build en cada push. La integración corre en los PR a `main`.

## Dominio propio

1. En Vercel → proyecto `construccion-demos` → **Settings → Domains** → **Add** → escribir el dominio (ej. `sistema.acerosrnf.com.ar`).
2. En el proveedor del dominio (NIC Argentina / el hosting donde esté el DNS), crear el registro que indica Vercel:
   - subdominio (recomendado): **CNAME** `sistema` → `cname.vercel-dns.com`
   - dominio raíz: **A** `@` → `76.76.21.21`
3. Esperar a que Vercel lo marque como "Valid Configuration" (minutos u horas, según el DNS). El certificado HTTPS es automático.
4. Actualizar `AUTH_URL` de **Production** con el dominio nuevo y redeployar:
   ```bash
   vercel env rm AUTH_URL production -y
   printf 'https://sistema.acerosrnf.com.ar' | vercel env add AUTH_URL production
   vercel --prod   # o un redeploy desde el panel
   ```
5. Cambiar la URL del monitor de UptimeRobot a `https://<dominio>/api/salud`.
