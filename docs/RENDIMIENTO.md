# Rendimiento con volumen

Mediciones del 9 de octubre de 2026 sobre el branch `test` de Neon (us-east-1, plan gratuito, compute de 0,25 CU), con los scripts:

```bash
pnpm db:seed:carga            # volumen completo (≈360 MB) — ver "Límite de espacio" abajo
pnpm db:seed:carga -- --liviana   # sin movimientos ni Cambio
pnpm db:rendimiento           # EXPLAIN ANALYZE de las consultas de cada pantalla
pnpm db:rendimiento:estado    # camino real de la app: estado en memoria y cálculos
npx neonctl branches reset test --parent --project-id muddy-boat-24470073   # liberar espacio al terminar
```

## Volumen cargado

10.000 artículos (con stock en cada depósito y precio en las 3 listas), 2.000 clientes, 500 proveedores, 5.000 acopios (20 precios congelados cada uno = 100.000 filas), 20.000 notas de pedido de un año (60.000 ítems), 15.000 remitos, 5.000 comprobantes, 2.000 despachos (100 del día), **200.000 movimientos de stock** y **1.000.000 de filas de `Cambio`**.

## 1. Consultas a la base (EXPLAIN ANALYZE)

Tiempo de planificación + ejecución dentro de Postgres (mediana de 3 corridas), sin latencia de red. Objetivo: < 100 ms.

| Consulta | Tiempo | |
|---|---:|---|
| Tablero · ventas del mes | 0,3 ms | ✔ |
| Tablero · por cobrar | 1,0 ms | ✔ |
| Stock · posición de un depósito (`v_stock_posicion`) | 79,9 ms | ✔ |
| Stock · posición de un artículo | 22,2 ms | ✔ |
| Stock · kardex de un artículo (200.000 movimientos) | 0,3 ms | ✔ |
| Pendientes de entrega | 13,4 ms | ✔ |
| Cuentas corrientes · saldos por cliente | 2,2 ms | ✔ |
| Acopios · saldo de los vigentes | 9,1 ms | ✔ |
| Acopios · detalle de uno | 0,2 ms | ✔ |
| Remitos · en picking | 0,6 ms | ✔ |
| Remitos · últimos de una sucursal | 0,3 ms | ✔ |
| Despachos del día | 0,4 ms | ✔ |
| Buscador de artículos (pg_trgm) | 7,4 ms | ✔ |
| **`/api/cambios` con 1.000.000 de filas** | **0,3 ms** | ✔ (< 50 ms) |
| Versión del estado (`MAX(Cambio.id)`) | 0,2 ms | ✔ |

### Ajustes hechos

- **`v_stock_posicion`**: el físico ahora sale de `StockDeposito.cantidadFisica` (la misma fuente que usa el dominio) en lugar de sumar todo el kardex, y la CTE de picking no se materializa (el filtro por depósito llega hasta ella). Posición de un depósito: **156 ms → 80 ms**. Como nunca superó los 300 ms, no hizo falta convertirla en vista materializada. Migración `20261009150000_vista_stock_fisico`.
- Índice `Remito (estado, depositoId)` para lo reservado en picking.
- Caso extremo medido: con 6.668 notas de pedido abiertas en un mismo depósito (un tercio de un año entero sin entregar), la posición de ese depósito tarda 104 ms. Con la distribución realista (≈1.100 abiertas, las del último mes) tarda 80 ms.

## 2. Camino real de la app (estado en memoria)

El servidor mantiene en memoria el estado del negocio (todas las tablas menos kardex y auditoría) y lo actualiza de forma incremental con cada `Cambio`. Las pantallas se calculan sobre ese estado.

| Paso | Tiempo |
|---|---:|
| Cálculo de posiciones de stock (10.000 artículos × 2 depósitos) | 48 ms |
| Pendientes de entrega | 6 ms |
| Acopios · resumen con saldo (5.000 acopios) | **45 ms** (antes 6.560 ms) |
| Cuentas corrientes · saldos | 7 ms |
| Tablero · ventas del mes | 1 ms |
| Alertas | 210 ms |
| Lectura del estado con caché (misma versión) | 163 ms |
| Lectura completa del estado en frío | 21,8 s desde Buenos Aires* |

\* La lectura en frío ocurre una vez por instancia del servidor (después se actualiza en forma incremental). Medida desde Buenos Aires está dominada por la latencia y el volumen transferido; en Vercel la función corre en la misma región que la base (us-east-1), así que debería ser varias veces menor (no medido allá).

**Ajuste hecho:** el resumen de acopios recorría todas las notas de pedido por cada acopio (5.000 × 20.000). Ahora indexa NP, DP, ACD y comprobantes por acopio una sola vez: **6,5 s → 45 ms**, con el mismo resultado (tests y `flujos:check` verdes).

### Límites de escala de esta arquitectura

Con este volumen el estado ocupa ≈350 MB de memoria en el servidor y el JSON inicial que recibe el navegador pesa 56 MB (2,6 MB comprimido). Sobra para el tamaño de Aceros RNF hoy, que es un orden de magnitud menor. Si algún día se acercan a estos números, el paso siguiente es paginar en el servidor los listados grandes (precios, precios congelados, histórico de NP y remitos) en lugar de mandarlos completos al navegador.

## Límite de espacio del plan gratuito de Neon

En el plan gratuito, los **512 MB son de todo el proyecto**, producción incluida. La carga completa (≈360 MB en `test`) llegó al límite. Mientras el proyecto está lleno, ningún branch puede escribir, tampoco producción. Por eso:

- La carga completa se corre solo con el plan **Launch** (que además da 7 días de historial). Con el plan gratuito, usar `--liviana`.
- Al terminar, **siempre** `neonctl branches reset test --parent`.
