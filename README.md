# construccion-demos · Aceros RNF

Sistema de gestión a medida para Aceros RNF (corralón y ferretería): clientes y obras, acopios por monto con precios congelados, ventas con origen y forma de pago, remitos con remito firmado, stock con pendiente de entrega, despachos con tiempos, proveedores y acopios con proveedores, cuentas corrientes y reportes — demo comercial de VM Studio.

## Cómo correrlo

```bash
pnpm i && pnpm dev
```

Abrí http://localhost:3000 y elegí un usuario del demo.

> **Nota:** es un demo **sin base de datos**. Los datos son un seed generado en el cliente (fechas relativas a hoy) y se persisten en `localStorage`, detrás de una capa de repositorio tipada (`src/data/repositories`) lista para reemplazar por Prisma/PostgreSQL. Se restablecen desde el login o desde Configuración → Datos del demo.

## Usuarios del demo

| Usuario | Rol | Qué ve |
|---|---|---|
| Felipe | Dueño | Todo, incluidos márgenes, usuarios, numeración y auditoría |
| Natalia Quiroga / Sergio Medina | Administración | Todo menos la administración de usuarios |
| Lucas Fernández | Ventas · Casa Central | Clientes, ventas, acopios, remitos y cuentas corrientes (sin costos ni márgenes) |
| Rocío Benítez | Ventas · Sucursal 2 | Ídem, en su sucursal |
| Hugo Ramírez | Depósito · Casa Central | Stock, recepciones, remitos (picking / hecho / firmado) y despachos |

## Scripts

- `pnpm seed:check` — valida la consistencia del seed (kardex = stock físico, saldos = total − imputado, saldo de acopio = importe − NP + DP + ACD, entregados ≤ cantidad, el acopio de Ramos cierra en $ 844,85).
- `pnpm flujos:check` — ejecuta los flujos completos de negocio sobre el store y verifica la integridad al final.
- `pnpm build` — build de producción.
