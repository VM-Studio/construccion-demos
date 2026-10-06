# construccion-demos

Sistema de gestión para distribuidora de materiales de construcción (compras, stock, ventas, acopios, despachos, cuentas corrientes y reportes) — demo comercial de VM Studio.

## Cómo correrlo

```bash
pnpm i && pnpm dev
```

Abrí http://localhost:3000 y elegí un usuario del demo.

> **Nota:** es un demo **sin base de datos**. Los datos son un seed generado en el cliente (fechas relativas a hoy) y se persisten en `localStorage`, detrás de una capa de repositorio tipada (`src/data/repositories`) lista para reemplazar por Prisma/PostgreSQL. Se restablecen desde el login o desde Configuración → Datos del demo.

## Usuarios del demo

| Usuario | Rol | Qué ve |
|---|---|---|
| Martín Ferrari | Dueño | Todo, incluidos márgenes, usuarios y auditoría (ve el recorrido guiado la primera vez) |
| Laura Giménez / Diego Romero | Administración | Todo menos la administración de usuarios |
| Carla Méndez | Ventas · Sucursal Norte | Ventas, acopios, despachos y cuentas corrientes (sin costos ni márgenes) |
| Pablo Sosa | Ventas · Sucursal Sur | Ídem, bloqueado en su sucursal |
| Jorge Benítez | Depósito · Sucursal Sur | Stock, recepción de mercadería y despachos |

## Scripts

- `pnpm seed:check` — valida la consistencia del seed (kardex = stock físico, saldos = total − cobrado, retiros ≤ acopiado, despachos programados con stock).
- `pnpm flujos:check` — ejecuta los flujos completos de negocio sobre el store y verifica la integridad al final.
- `pnpm build` — build de producción.
