# construccion-demos

Sistema de gestión para distribuidora de materiales de construcción (compras, stock, ventas, acopios, despachos, cuentas corrientes y reportes) — demo comercial de VM Studio.

## Cómo correrlo

```bash
pnpm i && pnpm dev
```

Abrí http://localhost:3000 y elegí un usuario del demo.

> **Nota:** es un demo **sin base de datos**. Todos los datos son semilla generada en el cliente y se persisten en `localStorage`, detrás de una capa de repositorio tipada (`src/data/repositories`) lista para reemplazar por Prisma/PostgreSQL. Se pueden restablecer desde el login o desde Configuración → Datos del demo.
