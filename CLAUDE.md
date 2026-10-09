# construccion-demos · Aceros RNF

Sistema de gestión a medida para **Aceros RNF** (dueños: **Felipe** y socios). Sistema REAL de VM Studio: varios usuarios trabajando sobre la misma base, en vivo. Plan de la versión real: `docs/plan-version-real.md`.

## Negocio
- Dos **unidades de negocio**: **Corralón** (materiales de construcción: áridos, hierros, ladrillos, viguetas, cementos, impermeabilización, construcción en seco) y **Ferretería** (herramientas, fijaciones, pinturas, electricidad, sanitarios, seguridad). `Producto` y `Rubro` llevan `unidadNegocioId`; el header tiene un selector global de unidad (Todas / Ferretería / Corralón).
- Dos sucursales: **Casa Central** (punto de venta 0001, remitos 00016) y **Sucursal 2** (0002, remitos 00006), cada una con su depósito y sus posiciones de carga (Playa 1, Galpón 2, Mostrador…).
- Clientes con **obras** (`Obra`): cada línea de nota de pedido indica a qué obra va; los acopios se asocian a una o más obras.
- **Circuito** `1 | 2`: AC1 · Fiscal / AC2 · Interno. Lo llevan acopios, NP, remitos, comprobantes, recibos, OC, OP y acopios con proveedores. Se elige al crear y se hereda a todo lo derivado (acopio → NP → RM → F → RC). Badge gris oscuro para AC1, gris claro con borde para AC2.
- **Códigos de documento** (con sufijo de circuito): `AC` acopio · `NP` nota de pedido (retiro de acopio o venta) · `DP` devolución de NP (`DP2 0001-00067661-1`) · `ACD` ajuste/traspaso de saldo · `RM` remito · `RD` remito de devolución · `F` factura · `NC` nota de crédito · `RC` recibo · `OC` orden de compra · `OP` orden de pago · `ACP` acopio con proveedor. Formato `${codigo}${circuito} ${puntoVenta}-${correlativo 8 dígitos}`; numeración independiente por código, circuito y punto de venta (`src/domain/numeracion.ts`, `tx.numero(codigo, circuito, pv)`).

### Acopio de clientes por monto (`src/domain/acopios.ts`)
1. El cliente deposita (anticipo) o pacta en cuenta corriente un **importe**; se factura (F1/F2) y, si es anticipo, se cobra con un RC.
2. Al crear el acopio se **congela TODA la lista de precios** de la unidad de negocio (`preciosCongelados`: precio + costo snapshot).
3. Retira con **notas de pedido** origen ACOPIO a precio congelado; cada NP descuenta su monto del saldo. Las NP de acopio no se facturan.
4. **Saldo disponible = importe − Σ NP + Σ DP + Σ ACD** (DP negativos suman; ACD traspasos/ajustes con signo). El detalle muestra el saldo corrido línea a línea, igual al documento real (Ramos AC2 0001-00003633 cierra en $ 844,85).
5. Estado derivado: VENCIDO si pasó la fecha con saldo, AGOTADO si saldo ≤ 0. Pendiente de entrega = Σ(cantidad − entregados − devueltos) de sus NP.

### Acopio con proveedores (`src/domain/acopiosProveedor.ts`)
Espejo del de clientes: Aceros RNF acopia con proveedores por monto o por cantidad (ej. 2.000 bolsas Loma Negra), por anticipo o cuenta corriente. Los retiros son **OC origen ACOPIO** a costo congelado; al recibir baja el pendiente de retirar y **no genera deuda nueva**. "Le debemos" = importe − pagado (cuenta corriente); "Nos falta retirar" = pactado − recibido.

### Ventas, remitos y stock
- `NotaPedido` es la fuente de verdad de las ventas (`Pedido` es alias): `origen` NUEVA | ACOPIO, `formaPago` CONTADO | CUENTA_CORRIENTE | ACOPIO, `pendienteEntrega`.
- Remitos `INICIAL → PICKING → HECHO`. Recién al pasar a HECHO se generan los movimientos de stock y se actualizan los `entregados` de la NP (`marcarHecho` en `src/store/ops.ts`).
- **Disponible = físico − pendiente de entrega − reservado (remitos en picking)**. Toda validación de venta/transferencia usa disponible; solo DUENO/ADMIN pueden forzar (auditado).
- Despachos con tiempos: ESPERA → PREPARACION → FINALIZADO (+ EN_VIAJE / ENTREGADO para envíos). `src/domain/despachos.ts`: `minutosEspera`, `minutosPreparacion`, `minutosTotal`.
- Rentabilidad = Σ (precio − costo snapshot de la línea) × cantidad. El costo snapshot nunca se recalcula.

### Adjuntos
Los archivos viven en **Vercel Blob privado** (`aceros-rnf/{entidadTipo}/{entidadId}/{clave}-{nombre}`); la metadata `Adjunto` en la base. Helper `src/lib/adjuntos.ts` (`guardarAdjunto`, `obtenerUrl`, `descargarAdjunto`, `eliminarAdjunto`). El remito firmado (categoría REMITO_FIRMADO) setea `firmadoAdjuntoId`.

## Navegación
Por **módulos** estilo launcher (se implementa en M2): `/inicio` con tarjetas de módulos y sus páginas; dentro de una página, barra lateral con las páginas del módulo y "← Módulos". Definición única en `src/config/modulos.ts`.

## Stack y reglas
- Next.js 15 App Router, TS strict, Tailwind v4 (tokens en globals.css), Recharts, Lucide, pnpm. jsPDF + autotable y exceljs para descargas (dynamic import).
- **Base real**: PostgreSQL en Neon (us-east-1, misma región que las funciones) con Prisma 6 + `@prisma/adapter-neon`. Esquema en `prisma/schema.prisma` con los MISMOS nombres de campo que `src/domain/types.ts`; el mapeo dominio ↔ base es genérico (`src/server/datos/mapeo.ts`, por DMMF). Ramas de Neon: `main` = producción (solo estructura, sin datos de ejemplo), `desarrollo` = `.env.local` / Vercel Development.
- **Decimal en la base, number solo en presentación** (`src/lib/decimal.ts`). Dinero 14,2; cantidades 14,3; costos unitarios 14,4. Nunca Float.
- **Nada de lógica de negocio en el cliente.** Toda regla vive en `src/domain/` (funciones puras) y las acciones de escritura en `src/store/negocio.ts` (slices), que corren SOLO en el servidor: `src/server/actions/*` ("use server", zod en `src/server/esquemas/*`, actor de `src/server/auth/actor.ts`) → `src/server/servicios/*` (permiso, bloqueos) → `src/server/motor.ts` (estado leído de la base, acción en memoria, cola de escrituras por proceso + transacción Read Committed con lock global — los reintentos toman el lock antes de leer —, verificación de versión, FOR UPDATE de stock/acopio, persistencia de solo lo que cambió, numeración optimista en `Contador`, Auditoria con efectos y fila `Cambio`; reintentos 50/150/400 ms).
- **Nada de Prisma fuera de `src/server` y `src/data`.** Los componentes leen con `useDb()` / `obtenerDb()` (`src/lib/datos/almacen.ts`, espejo de solo lectura de `/api/datos`, ya filtrado por rol en `src/server/lectura.ts`) y escriben con `await useStore.getState().<accion>(…)` (proxy a la server action). Kardex y auditoría se leen paginados (`useMovimientos`, `useAuditoria`).
- **Toda escritura publica un Cambio.** `useSincronizacion()` (`src/lib/datos/proveedor.tsx`) consulta `/api/cambios` cada 3 s (2 s en Despachos, 15 s en segundo plano) y refresca solo las colecciones afectadas (`src/lib/sincronizacion/dependencias.ts`); avisa lo que hicieron otros usuarios. El servidor cachea el estado por versión (= MAX(Cambio.id)) y lo actualiza incrementalmente (`src/server/estado.ts`).
- **Todo dólar sale de `obtenerVigente()`** (`src/server/servicios/tipoCambio.ts`: BNA divisa vendedor, respaldo dolarapi, crons en `vercel.json`). El motor inyecta `config.tipoCambioVigente`; los documentos guardan importes en pesos y el snapshot `tipoCambioAplicado`.
- Zustand (`src/store/index.ts`) es SOLO interfaz (sesión visible, sucursal/unidad activas, sidebar, favoritos, modo capacitación); persiste preferencias, nunca datos de negocio.
- Adjuntos en Vercel Blob privado (`src/lib/adjuntos.ts`, `src/app/api/adjuntos/**`): subida directa con token firmado, ver/borrar con sesión y permiso.
- Sesión: Auth.js v5 con credenciales (`src/auth.ts`, `src/middleware.ts`, `src/server/auth/*`). Ninguna acción acepta rol ni usuarioId del cliente.
- Pruebas: `pnpm test` (vitest, `tests/unit`) y `pnpm test:integracion` (branch Neon `test`, `.env.test`); CI en `.github/workflows/ci.yml`. Backups diarios a R2 (`backup.yml`, `pnpm db:restore`), staging = rama `staging` + branch Neon `staging`. Docs de entrega en `docs/`.
- Scripts: `pnpm db:migrate`, `db:seed` (estructura, idempotente), `db:seed:ejemplo` (solo rama desarrollo), `db:check` (consistencia de la base; `-- --historicos` con datos de ejemplo), `db:test:mapeo`, `db:test:concurrencia`, `db:studio`; `pnpm seed:check` y `pnpm flujos:check` (reglas del dominio en memoria). `vercel-build` = migrate deploy + seed + build.
- Dinero en ARS con `formatMoney`. Fechas con date-fns y `formatDate`. Nunca `toLocaleString` suelto.
- UI: primitivas de `src/components/ui`. Solo tokens de color, un acento ámbar. Densidad alta. Nada de colores llamativos.
- Español rioplatense en toda la UI. Sin anglicismos innecesarios. Textos de empresa desde `BRAND` / configuración.
- Cada página: título, acción primaria arriba a la derecha, filtros, tabla o grilla, estado vacío con CTA.
- Escritorio prioritario, responsive obligatorio.
- Commits en español, imperativo, cortos.

## Sistema vacío y carga inicial
- La base de producción arranca con la estructura de `seedBase()` (empresa, 2 sucursales/depósitos con posiciones, unidades de negocio y rubros, 3 listas sin precios — Mayorista 22 %, Corralón 28 %, Público 45 % —, motivos de ajuste, configuración, numeración en 0) SIN usuarios: el primero que entra se registra como dueño. `seedEjemplo()` (todo el ejemplo, Ramos incluido) solo se carga en la rama de desarrollo con `pnpm db:seed:ejemplo`.
- Prerrequisitos por pantalla en `src/domain/prerequisitos.ts` (`prerequisitos(pagina, db)`); textos de estados vacíos en `src/config/vacios.ts` (`<VacioGuiado pagina>`); guía de carga en `src/domain/cargaInicial.ts`.
- Importación CSV (papaparse) en `src/domain/importacion.ts` + `ImportarCsvDialog`; plantillas y ejemplos en `public/plantillas/`.
- Alta rápida: `SelectorCliente/Proveedor/Vehiculo/Chofer` (`src/components/shared/alta-rapida.tsx`) y "Crear artículo nuevo…" en `ProductoPicker`.
- Inventario inicial = ajuste con motivo `INVENTARIO_INICIAL` y costo unitario editable; saldos iniciales de cuenta corriente = comprobante `SALDO_INICIAL` (código `SI`).

## Modo capacitación (`src/capacitacion/`)
- Todo vive en esa carpeta y detrás de un solo interruptor (`capacitacion.modo` en el store, persistido; default `true` en demo; solo DUENO y ADMINISTRACION lo cambian desde el ícono `GraduationCap` del header o Configuración → Datos del demo).
- `impactos.ts` es el ÚNICO lugar con textos: `IMPACTOS` (qué cambia con cada acción), `CAMPOS` (una línea por valor de campo) y `PAGINAS` (de qué se alimenta cada pantalla y a qué alimenta).
- Fuera de la carpeta solo se usan, desde `@/capacitacion`: `<Impacto accion>` (debajo del botón primario o arriba del footer del dialog), `<ImpactoCampo campo>`, `<BannerPagina>` (ya está en `PageHeader`), los interruptores y `medir(accionId, contexto, fn)` alrededor de cada acción que escribe en el store. Con el modo apagado los componentes devuelven `null` y `medir()` solo ejecuta `fn()`.
- Los efectos reales se miden en el SERVIDOR dentro de cada transacción (`efectos.ts`: foto de métricas antes/después — stock por artículo × depósito, costos, cuentas, acopios, KPIs, documentos y altas) y se guardan en `Auditoria.efectos`; `medir.ts` en el cliente solo muestra el aviso "Listo · Esto cambió:" (`AvisoCambios.tsx`). El panel "¿Qué pasó?" (`PanelQuePaso.tsx`) lee la auditoría del servidor y muestra lo que hicieron todos los usuarios.
- **Para quitar el modo capacitación:** poner default `false` en `CAPACITACION_INICIAL.modo` (`src/capacitacion/slice.ts`) y se oculta todo; o borrar `src/capacitacion/`, los `<Impacto>`/`<ImpactoCampo>`/`<BannerPagina>`/interruptores que quedan vacíos, reemplazar cada `await medir(id, ctx, fn)` por `fn()` y sacar la clave `capacitacion` del store (`src/store/index.ts`, `src/store/types.ts`).
