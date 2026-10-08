# Aceros RNF — Versión real, completa (reemplaza al archivo anterior)

**Contexto para vos:** tres dueños van a usar el sistema desde distintas computadoras, al mismo tiempo, como si ya lo hubiesen comprado. El sistema arranca vacío. El primero que entra se registra y queda como DUEÑO; los demás se crean desde Configuración y nacen como DUEÑO por defecto (después se cambian roles). Tipo de cambio automático con el dólar divisa vendedor del Banco Nación. Los cambios de un usuario se ven en las pantallas de los otros en pocos segundos, sin recargar.

**Orden:** primero la configuración de cuentas (te la guío de a un paso en el chat), después los prompts R1 → R2 → R3, de a uno, probando en local entre cada uno.

**Variables de entorno necesarias** (en `.env.local` y en Vercel → Settings → Environment Variables, para Production y Preview):
```
DATABASE_URL=            # Neon, cadena "pooled"
DIRECT_URL=              # Neon, cadena directa (migraciones)
BLOB_READ_WRITE_TOKEN=   # Vercel Blob
AUTH_SECRET=             # openssl rand -base64 32
AUTH_URL=                # https://construccion-demos.vercel.app (o el dominio final)
CRON_SECRET=             # openssl rand -hex 16 (protege el cron del dólar)
```

---

## PROMPT R1 — Base de datos real, lógica en el servidor, actualización en vivo y dólar automático

```
Seguimos en construccion-demos (leé CLAUDE.md completo antes de tocar nada). El sistema deja de ser un demo con datos en el navegador y pasa a ser el sistema real de Aceros RNF: PostgreSQL con Prisma, lógica de negocio en el servidor, varios usuarios trabajando sobre los mismos datos al mismo tiempo y viendo los cambios de los demás en segundos. Las reglas puras de `src/domain/` no cambian; cambia dónde corren y dónde se guardan los datos. El sistema arranca VACÍO: sin productos, clientes, proveedores ni operaciones. Nada de datos de ejemplo en producción.

Variables ya cargadas en `.env.local` y en Vercel: `DATABASE_URL` (Neon pooled), `DIRECT_URL` (Neon directa), `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`.

## 1. Prisma y esquema
Instalá `prisma`, `@prisma/client`, `@prisma/adapter-neon`, `@neondatabase/serverless`, `ws`. `prisma/schema.prisma` con `datasource db { provider = "postgresql", url = env("DATABASE_URL"), directUrl = env("DIRECT_URL") }` y `previewFeatures = ["driverAdapters"]`. Cliente único en `src/server/db.ts` (singleton con adapter Neon, `server-only`).
Traducí UNO A UNO los tipos de `src/domain/types.ts` a modelos: Sucursal, Deposito, PosicionCarga, UnidadNegocio, Rubro, Usuario, Producto, ListaPrecios, PrecioProducto, StockDeposito, MovimientoStock, TransferenciaStock (+ items), AjusteStock (+ items), MotivoAjuste, Proveedor, OrdenCompra, ItemOC, RecepcionMercaderia (+ items), AcopioProveedor (+ costos congelados + items), Cliente, Obra, CondicionPago, Cotizacion (+ items), NotaPedido, ItemNP, DevolucionNP (+ items), Acopio, PrecioCongelado, AjusteAcopio, Comprobante (+ items), Recibo (+ medios + imputaciones), OrdenPago (+ medios + imputaciones), Cheque, Remito (+ items), Adjunto, Vehiculo, Chofer, Despacho (+ items), HojaRuta, Configuracion (fila única), Contador, CotizacionUSD, Auditoria.
Reglas:
- Ids `String @id @default(cuid())`; `creadoEn @default(now())`, `actualizadoEn @updatedAt` en todos.
- Dinero `Decimal @db.Decimal(14,2)`; cantidades `Decimal @db.Decimal(14,3)`. Nunca Float. Helper `src/lib/decimal.ts` para convertir a number solo en la capa de presentación.
- Enums Prisma para cada union type de estado/tipo.
- Índices: `@@index([clienteId])`, `[proveedorId]`, `[productoId, depositoId]`, `[estado]`, `[fecha]`, `[acopioId]`, `[notaPedidoId]`, `[sucursalId]`, `[unidadNegocioId]`; `numero` único por tipo de documento; email de usuario único; código de producto único.
- `MovimientoStock` es insert-only: ningún repositorio expone update ni delete sobre esa tabla.
- `Contador { tipo String @unique, ultimo Int }`.
- `Auditoria` suma `efectos Json?`, `ip String?`, `userAgent String?`.
- Los `items` embebidos pasan a tablas hijas con relación y `onDelete: Cascade`.
Migración inicial `pnpm prisma migrate dev --name inicial`. Scripts: `db:migrate` (`prisma migrate deploy`), `db:seed` (corre `seedBase()` solo si la tabla Sucursal está vacía: estructura, rubros, listas, condiciones de pago, motivos, posiciones, configuración, contadores en 0; SIN usuarios: ver R2), `db:check`, `db:studio`. `postinstall: prisma generate`. Script `vercel-build: prisma migrate deploy && prisma db seed && next build` y en `package.json` el bloque `"prisma": { "seed": "tsx prisma/seed.ts" }`. Instalá `tsx`.
En una migración SQL adicional: vista `v_stock_posicion` (producto, depósito, físico = Σ movimientos, pendiente_entrega = Σ(cantidad − entregados) de ItemNP de NP confirmadas no anuladas de ese depósito, reservado = Σ items de remitos en PICKING, disponible = físico − pendiente − reservado, en_transito = Σ(pedida − recibida) de OC confirmadas + pendiente de acopios con proveedor por cantidad), e índice `pg_trgm` (`CREATE EXTENSION IF NOT EXISTS pg_trgm`) sobre producto.nombre, producto.codigo, cliente.razonSocial, proveedor.razonSocial para el buscador.

## 2. Servicios en el servidor — `src/server/servicios/`
Un archivo por módulo: `catalogo.ts`, `stock.ts`, `compras.ts`, `proveedores.ts`, `clientes.ts`, `ventas.ts`, `acopios.ts`, `remitos.ts`, `despachos.ts`, `finanzas.ts`, `configuracion.ts`, `tipoCambio.ts`. Cada acción de negocio que hoy vive en el store (crearProducto, confirmarOrdenCompra, registrarRecepcion, crearAcopio, confirmarNotaPedido, registrarRetiroAcopio, generarRemito, iniciarPicking, marcarRemitoHecho, registrarCobro, crearOrdenPago, crearDevolucion, traspasarSaldo, transferirStock, crearAjuste, actualizarPreciosMasivo, programarEntrega, iniciarPreparacion, finalizarDespacho, iniciarRecorrido, marcarEntregado, etc.) se convierte en una función del servicio que:
1. Recibe `actor` (usuario de la sesión; nunca datos de rol del cliente) y verifica `puede(actor, permiso)`; si no, lanza `ErrorPermiso`.
2. Corre en `prisma.$transaction(async tx => …, { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 })` con reintento automático hasta 3 veces ante error de serialización (P2034).
3. Ejecuta las reglas puras de `src/domain/` sobre los datos leídos dentro de la transacción y persiste el resultado.
4. Escribe la fila de Auditoria en la misma transacción, con `efectos` (ver punto 5).
5. Devuelve `{ entidades afectadas, efectos, tiposAfectados: string[] }`.
Numeración: `siguienteNumero(tx, tipo)` ejecuta `UPDATE "Contador" SET ultimo = ultimo + 1 WHERE tipo = $1 RETURNING ultimo` (si no existe, lo crea). Dos usuarios creando una NP al mismo tiempo reciben números distintos y consecutivos. Sin excepciones.
Stock: antes de validar disponible, `SELECT … FROM "StockDeposito" WHERE "productoId" = ANY($1) AND "depositoId" = $2 FOR UPDATE` (vía `tx.$queryRaw`). Si dos vendedores venden las últimas 80 bolsas a la vez, uno confirma y el otro recibe "No hay disponible suficiente de X: físico 500, pendiente de entrega 420, disponible 80".
Acopio: `SELECT … FROM "Acopio" WHERE id = $1 FOR UPDATE` antes de validar un retiro o traspaso.
Toda escritura a la base pasa por estos servicios. Ningún componente ni ruta accede a Prisma directo.

## 3. Server Actions — `src/server/actions/`
Una action delgada por acción de negocio con `"use server"`: valida la entrada con `zod` (esquemas en `src/server/esquemas/`), obtiene el actor de la sesión (R2; por ahora un stub `obtenerActor()` que lee la cookie y que R2 reemplaza), llama al servicio, y devuelve `{ ok: true, data, efectos } | { ok: false, error: string, codigo?: string }`. Nunca filtra mensajes internos ni stack traces. Al terminar: `revalidatePath` de las rutas afectadas y publica el cambio (punto 4).

## 4. Actualización en vivo para todos los usuarios
Objetivo: lo que carga un usuario lo ven los demás en pocos segundos sin recargar, sin servicios externos y sin costo.
- Tabla `Cambio { id BigInt autoincrement, tipos String[], entidadIds String[], usuarioId, creadoEn }` que cada servicio escribe al final de su transacción (una fila por acción).
- Ruta `GET /api/cambios?desde=<id>`: devuelve `{ ultimo: id, cambios: [{ id, tipos, entidadIds, usuarioId }] }` con una sola consulta indexada (`WHERE id > $1 ORDER BY id LIMIT 200`). Es la ruta más barata del sistema; responde en milisegundos. Header `Cache-Control: no-store`.
- Instalá `swr`. Hook `useSincronizacion()` montado una vez en el layout autenticado: consulta `/api/cambios` cada **3 segundos** mientras la pestaña está visible (`document.visibilityState`), 15 segundos si está en segundo plano, y al instante al volver el foco. Por cada cambio recibido hace `mutate` SOLO de las claves SWR cuyo tipo coincide (ej. un cambio de tipo `NotaPedido` revalida `["notas-pedido"]`, `["stock"]`, `["pendientes-entrega"]`, `["kpis"]`, `["cliente", id]`). Mapa de dependencias en `src/lib/sincronizacion/dependencias.ts`. Si el usuario que hizo el cambio es el actual, no se muestra aviso (ya vio su toast); si fue otro, un toast discreto "Juan confirmó la NP-1254" con link, máximo uno cada 5 s (agrupar).
- Todas las lecturas de datos de negocio en componentes cliente pasan a `useSWR(clave, fetcher)` contra rutas `GET /api/<recurso>` (o server actions de lectura) con `keepPreviousData: true`, `dedupingInterval: 1000`. Las páginas de listado hacen el primer render en el servidor (Server Component que lee de Prisma y pasa `fallbackData` al SWR), así la primera carga es instantánea y sin parpadeo.
- Después de cada server action exitosa: `mutate` optimista de las claves afectadas con el resultado devuelto (sin esperar al polling), así el usuario que cargó ve el cambio al instante.
- Paginación y filtros en el servidor (`skip/take`, `where`), nunca en memoria. Búsqueda con `pg_trgm` (`similarity`/`ILIKE` sobre índice).
- Pantalla "Depósito en vivo" y Despachos: intervalo de 2 segundos mientras están abiertas.
- El store de Zustand queda SOLO para interfaz: sesión, sucursal y unidad de negocio activas, sidebar, favoritos, modo capacitación, filtros, colapsos. Eliminar `persist` de cualquier dato de negocio, borrar la key `cd-demo-v2`, el loader de hidratación y `seedEjemplo` del bundle (queda como `pnpm db:seed:ejemplo` solo para desarrollo local, con guardia que se niega a correr si `NODE_ENV === "production"`).

## 5. Modo capacitación con datos reales
`medir()` pasa al servidor: cada servicio calcula las métricas del contexto (stock por producto/depósito, saldos de acopio, cuenta corriente, KPIs) antes y después DENTRO de la transacción y devuelve `efectos` con valor anterior, posterior y delta. El cliente solo muestra el toast "Esto cambió". El panel "¿Qué pasó?" lee Auditoria (que guarda `efectos` como JSON) con `useSWR` y se actualiza en vivo con los cambios de todos los usuarios, mostrando quién hizo cada cosa.

## 6. Adjuntos en la nube
Instalá `@vercel/blob`. Subida desde el cliente con `upload()` de `@vercel/blob/client` hacia `src/app/api/adjuntos/upload/route.ts`, que en `onBeforeGenerateToken` verifica sesión, tipo MIME permitido (imágenes y PDF), tamaño máximo de Configuración y asigna el pathname `aceros-rnf/{entidadTipo}/{entidadId}/{nanoid}-{nombre-saneado}`; en `onUploadCompleted` crea la fila Adjunto. Usar `access: "private"`; si la cuenta no lo soporta, `access: "public"` con pathname impredecible y un `// TODO: migrar a R2 con URLs firmadas` en el código y en `docs/ENTREGA.md`. Ver/descargar a través de `src/app/api/adjuntos/[id]/route.ts` que verifica sesión y permisos y redirige a una URL temporal o streamea. Eliminar: borra el blob y la fila. Quitar `idb-keyval` y todo IndexedDB.

## 7. Tipo de cambio automático — dólar divisa vendedor del Banco Nación (completo)
- Tabla `CotizacionUSD { fecha DateTime @db.Date @unique, divisaCompra Decimal, divisaVenta Decimal, billeteCompra Decimal?, billeteVenta Decimal?, fuente String, obtenidoEn DateTime }`.
- `src/server/servicios/tipoCambio.ts`:
  - `obtenerDesdeBNA()`: `fetch("https://www.bna.com.ar/Personas")` con `cheerio` (instalalo), tabla "Divisas" (no "Billetes"), fila "Dolar U.S.A.", columnas compra y venta; parsear "1.450,00". Timeout 8 s. Además intenta leer la fecha de cotización que muestra la página.
  - `obtenerDesdeFallback()`: `https://dolarapi.com/v1/dolares/mayorista` (mayorista BCRA ≈ divisa), `fuente: "DOLARAPI_MAYORISTA"`.
  - `actualizarCotizacion()`: intenta BNA, si falla el fallback, si fallan ambos registra en Auditoria "No se pudo actualizar el tipo de cambio" y devuelve la última conocida. `upsert` por fecha. Publica un Cambio de tipo `TipoCambio`.
  - `obtenerVigente()`: si Configuracion.tipoCambioModo === "MANUAL" → `tipoCambioManual`. Si no: última fila de CotizacionUSD; si es día hábil y la última tiene más de 2 h desde `obtenidoEn`, dispara `actualizarCotizacion()` (sin bloquear: `after()` de Next o `void` con catch) y devuelve la última conocida. Devuelve `{ valor, compra, fecha, fuente, obtenidoEn, modo, desactualizado }`.
  - `obtenerParaFecha(fecha)`: última cotización con fecha ≤ la pedida (para reportes de períodos pasados).
- Rutas: `GET /api/tipo-cambio` (devuelve `obtenerVigente()`, `Cache-Control: s-maxage=300`), `POST /api/tipo-cambio/actualizar` (requiere sesión DUENO/ADMIN, fuerza actualización), `GET /api/tipo-cambio/cron` (verifica header `Authorization: Bearer ${CRON_SECRET}`, corre `actualizarCotizacion()`).
- `vercel.json`: `{ "crons": [ { "path": "/api/tipo-cambio/cron", "schedule": "35 13 * * 1-5" }, { "path": "/api/tipo-cambio/cron", "schedule": "5 19 * * 1-5" } ] }` (10:35 y 16:05 hora Argentina, lunes a viernes).
- Configuración → Parámetros: tarjeta "Tipo de cambio USD" con el valor grande, "Dólar divisa vendedor · Banco Nación", "Cotización del dd/MM · actualizado hace X min", botón "Actualizar ahora", switch "Cargar manualmente" (DUENO/ADMIN) con input y aviso ámbar "Estás usando un valor manual; el sistema no lo actualiza hasta que lo desactives", badge rojo si `desactualizado` ("Sin conexión con el Banco Nación, usando la última cotización conocida del dd/MM"). Historial de los últimos 30 días en una tabla chica. Fines de semana y feriados: se muestra "Última cotización disponible: viernes dd/MM".
- Header: indicador `USD 1.450` junto a los selectores, tooltip con fuente, fecha y hora; se actualiza en vivo por el mecanismo de Cambios.
- Uso en el sistema (todo a través de `obtenerVigente()` en el servidor):
  - `Producto.monedaCosto: ARS | USD` y `costoUSD`. Si es USD, el costo en pesos se calcula con el vigente y la ficha muestra "USD 12,40 → $ 17.980". La actualización masiva de precios tiene el modo "Recalcular desde costo USD × tipo de cambio × markup". La importación CSV acepta `moneda_costo` y `costo_usd`.
  - `OrdenCompra` y `AcopioProveedor`: `moneda: ARS | USD`. En USD los ítems se cargan en dólares, totales en ambas monedas; al confirmar se guardan `tipoCambioAplicado` y `tipoCambioFecha`. La recepción convierte al tipo de cambio del día de la recepción y muestra la diferencia contra la OC.
  - `Cliente.facturaEnUSD` (default false): habilita "Precios en USD" en cotizaciones y notas de pedido, con snapshot `tipoCambioAplicado`.
  - Reportes → Valorización y Tablero → stock por rubro: toggle ARS/USD con el valor usado al pie. Reportes de períodos pasados usan `obtenerParaFecha`.
  - Toda impresión de un documento en USD lleva la línea "Tipo de cambio aplicado: $ 1.450,00 (BNA divisa vendedor, dd/MM/yyyy)".
  - Modo capacitación: `ImpactoCampo` en el selector de moneda y en Parámetros explicando qué usa el tipo de cambio y que cada documento guarda el suyo.

## 8. Limpieza, pruebas y CLAUDE.md
- Eliminar de la interfaz "Vaciar datos" y "Cargar datos de ejemplo". "Verificar integridad" y "Exportar respaldo" quedan (R3 los completa).
- `pnpm db:check`: Σ movimientos por producto/depósito = StockDeposito; saldos de comprobantes = total − imputaciones; saldo de acopio = importe − NP + DP + ACD; `entregados ≤ cantidad`; numeración sin duplicados ni huecos; vista de stock coincide con el cálculo en TypeScript para una muestra.
- Pruebas manuales con DOS navegadores distintos: crear un cliente en uno → aparece en el otro en menos de 5 s con el toast "X creó el cliente…"; confirmar una NP en uno → stock y pendientes cambian en el otro; vender las últimas unidades en los dos a la vez → uno pasa, el otro recibe el mensaje; dos NP simultáneas → números distintos y consecutivos; subir un remito firmado → se ve desde el otro navegador; forzar error de red en BNA → fallback y badge.
- Medir: primera carga del tablero < 1,5 s en Vercel con base vacía; `/api/cambios` < 50 ms.
- `pnpm build` limpio. CLAUDE.md: stack real, dónde vive cada cosa, reglas "nada de lógica de negocio en el cliente", "nada de Prisma fuera de src/server y src/data", "toda escritura publica un Cambio", "todo dólar sale de obtenerVigente()". Commit: "Sistema real: PostgreSQL, lógica en servidor, sincronización en vivo y dólar automático".
```

---

## PROMPT R2 — Registro del primer dueño, login real, usuarios y seguridad

```
Seguimos en construccion-demos (leé CLAUDE.md). Autenticación real. El sistema arranca sin usuarios: la PRIMERA persona que entra se registra y queda como DUEÑO. A partir de ahí no hay registro público: los demás usuarios los crean los dueños desde Configuración y nacen con rol DUEÑO por defecto (son tres dueños), y después se les cambia el rol si corresponde.

Variables ya cargadas: `AUTH_SECRET`, `AUTH_URL`.

## 1. Auth
Instalá `next-auth@beta` (Auth.js v5) y `bcryptjs`. Proveedor Credentials (email + contraseña). `Usuario` suma: `passwordHash`, `debeCambiarPassword Boolean @default(false)`, `ultimoAcceso`, `intentosFallidos Int @default(0)`, `bloqueadoHasta DateTime?`, `sesionVersion Int @default(0)`, `activo`. Sesión JWT en cookie `httpOnly`, `secure`, `sameSite: lax`, 12 horas con renovación al usar; el token lleva id, nombre, rol, sucursalId y sesionVersion. En cada request el callback compara `sesionVersion` con la base (consulta cacheada 60 s): si difiere, la sesión se invalida. `obtenerActor()` (stub de R1) pasa a leer `auth()`; ninguna server action acepta rol ni usuarioId del cliente.

## 2. Primer ingreso — `/registro`
- Si la tabla Usuario está vacía, `/login` redirige a `/registro` y el middleware permite esa ruta. `/registro` muestra: "Bienvenido a Aceros RNF. Creá la primera cuenta de dueño." Campos: nombre, apellido, email, contraseña (mínimo 10 caracteres, indicador de fortaleza), repetir contraseña. Al enviar: crea el usuario con rol DUENO, `activo = true`, inicia sesión y lleva a `/inicio` con el tour y la Guía de carga inicial. Auditoria: "Registro del primer dueño".
- Si YA existe al menos un usuario, `/registro` responde 404 y la server action de registro rechaza siempre. Esta verificación se hace en el servidor dentro de una transacción con lock sobre la tabla (`SELECT count(*) FROM "Usuario" FOR UPDATE` sobre una fila de Configuracion) para que dos personas registrándose a la vez no creen dos primeros dueños.

## 3. Login — `/login`
Formulario email + contraseña, botón "Ingresar", link "Olvidé mi contraseña" → texto "Pedile a otro dueño que te la restablezca desde Configuración → Usuarios". Error genérico "Email o contraseña incorrectos". Rate limiting: 5 intentos fallidos → `bloqueadoHasta = ahora + 15 min` y mensaje "Demasiados intentos, probá en 15 minutos". Login exitoso resetea intentos y guarda `ultimoAcceso`. Si `debeCambiarPassword`, redirige a `/cambiar-password` y no deja usar nada hasta cambiarla. Opción "Mantener sesión iniciada" (30 días) con checkbox.

## 4. Middleware — `src/middleware.ts`
Protege `/(app)/*` y `/api/*` excepto `/login`, `/registro`, `/api/tipo-cambio`, `/api/tipo-cambio/cron` y `/api/salud`. Sin sesión → `/login?volver=<ruta>`. Con sesión pero sin permiso para la ruta (según `MODULOS` + `puede()`) → página 403 "No tenés acceso a esta sección" con botón a Inicio. Usuario `activo = false` → sesión cerrada con mensaje "Tu usuario fue desactivado".

## 5. Configuración → Usuarios (solo DUENO)
Tabla: nombre, email, rol, sucursal, último acceso, estado. Acciones:
- "Nuevo usuario": nombre, apellido, email, rol (**por defecto DUEÑO**, se puede elegir otro), sucursal (opcional). Genera una contraseña temporal de 12 caracteres, la muestra UNA sola vez con botón "Copiar", y marca `debeCambiarPassword = true`. Toast con los datos para pasárselos por WhatsApp.
- Editar nombre, rol, sucursal.
- "Restablecer contraseña": nueva temporal, misma mecánica.
- "Cerrar sesiones": incrementa `sesionVersion` (el usuario vuelve al login en todas sus pestañas en menos de 60 s).
- Desactivar / reactivar (no se borra: la auditoría referencia al usuario).
- Protecciones: un dueño no puede desactivarse a sí mismo, ni quitarse DUENO si es el único dueño activo; no se puede desactivar al último dueño activo.
- Modo capacitación: `<Impacto accion="crearUsuario" />` ("Entra con su email y la contraseña temporal; la cambia al primer ingreso; ve solo lo que su rol permite").
Cada usuario puede cambiar su propia contraseña desde el menú de usuario → "Mi cuenta" (pide la actual).

## 6. Permisos en el servidor
Auditar TODOS los servicios: cada uno llama `puede(actor, permiso)`. VENTAS no recibe costos ni márgenes: filtrar en el `select` de Prisma según rol (no alcanza con ocultar columnas). DEPOSITO no recibe precios de venta ni saldos de dinero. El permiso "ver circuito 2" filtra en el `where` de todas las consultas y en las server actions de creación.

## 7. Endurecimiento
- `next.config.ts` headers: `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`.
- `zod` en todas las server actions y rutas API (auditar que ninguna reciba datos sin validar).
- Auditoria registra: registro inicial, login OK, login fallido (email, sin contraseña), bloqueo, cambio de contraseña, alta/edición/baja de usuario, cierre de sesiones, con IP y user-agent.
- `.github/dependabot.yml` (npm, semanal). `.env*` en `.gitignore`; verificar con `git log -p | grep -i "postgres://"` que nunca se subió una cadena de conexión.
- `robots.txt` con `Disallow: /` y `metadata.robots = { index: false }`.

Probar: base vacía → entrar → redirige a registro → crear al primer dueño → inicio; crear dos usuarios más (nacen DUEÑO) → entrar desde otros dos navegadores con la temporal → cambio obligatorio de contraseña → los tres cargando a la vez; cambiar a uno el rol a VENTAS → ya no ve costos; 6 intentos fallidos → bloqueo; cerrar sesiones → vuelve al login. `pnpm build` limpio. Commit: "Registro del primer dueño, autenticación real, usuarios y seguridad".
```

---

## PROMPT R3 — Backups, monitoreo, rendimiento y entrega

```
Seguimos en construccion-demos (leé CLAUDE.md). Dejar el sistema listo para uso real continuo.

## 1. Backup propio diario (regla 3-2-1)
`.github/workflows/backup.yml`: todos los días `0 7 * * *` UTC (04:00 Argentina) y `workflow_dispatch`. Pasos: instalar `postgresql-client` 16, `pg_dump --no-owner --format=custom` contra el secret `BACKUP_DATABASE_URL` (la DIRECT_URL de Neon), comprimir, subir a Cloudflare R2 con `rclone` (secrets `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, bucket `aceros-rnf-backups`) como `aceros-rnf-YYYY-MM-DD.dump.gz`. Retención: conservar 35 diarios y el primero de cada mes durante 12 meses; borrar el resto. Si cualquier paso falla, el workflow falla y queda visible. `docs/BACKUPS.md` con los comandos exactos para restaurar en una base vacía (`pg_restore`) y script `pnpm db:restore <archivo>`. Probar una restauración en una base de prueba de Neon y dejar anotada la fecha.
Configuración → Datos → "Exportar respaldo" (DUENO): ZIP con todas las tablas en CSV + un JSON completo, generado en el servidor y descargado; auditado.

## 2. Monitoreo
- `@sentry/nextjs` con `SENTRY_DSN` (plan gratuito): errores de servidor y cliente con id de usuario (no email) y ruta; sin capturar cuerpos de formularios. `tracesSampleRate: 0.1`.
- `GET /api/salud` → `{ ok, db, blob, ultimaCotizacion, version }` para UptimeRobot (gratuito, cada 5 min, avisa por mail a VM Studio).
- Log de duración de cada server action; `console.warn` si supera 2 s y registro en Sentry como "lento" si supera 5 s.

## 3. Rendimiento con volumen
Script local `pnpm db:seed:carga` (bloqueado en producción) que genera 10.000 productos, 2.000 clientes y 200.000 movimientos. Con eso: todos los listados paginan en servidor; búsqueda con `pg_trgm`; `EXPLAIN ANALYZE` de las 10 consultas más usadas (tablero, stock, pendientes de entrega, cuentas corrientes, acopios, remitos, despachos del día, cambios) con índices ajustados hasta que todas bajen de 100 ms; si `v_stock_posicion` supera 300 ms, convertirla en vista materializada refrescada al final de cada transacción que toca stock (`REFRESH MATERIALIZED VIEW CONCURRENTLY`). `/api/cambios` tiene que seguir por debajo de 50 ms con 1 millón de filas (índice en id, y purga de Cambio de más de 7 días vía el cron diario).

## 4. Entrega
- `/ayuda`: guía corta de los 8 flujos (reusar textos del modo capacitación), preguntas frecuentes y contacto de soporte de VM Studio.
- Modo capacitación activo por defecto; los dueños lo apagan desde Configuración cuando quieran.
- Metadata "Aceros RNF · Sistema de Gestión", favicon, `noindex`.
- Dominio: pasos en README para apuntar el dominio que elijan y actualizar `AUTH_URL`.
- `docs/ENTREGA.md`: qué se entrega, dónde viven los datos (Neon, São Paulo, cifrado, PITR del plan), backups (Neon + R2 diario), cómo se agregan usuarios, cómo se restablece una contraseña, qué hacer si el BNA no responde, y qué queda para la fase siguiente (facturación electrónica ARCA, migración de datos del sistema anterior, app de choferes).

Recorrer los 8 flujos en producción con tres usuarios, correr el backup a mano y restaurarlo. `pnpm build` limpio. Commit: "Backups, monitoreo, rendimiento y entrega".
```

---

## Lo que les decís al entregar

"Ya no es un demo. Entran con usuario y contraseña; el primero que entra se registra como dueño y desde Configuración crea a los otros dos. Lo que carga uno lo ven los demás en segundos. Los datos están en una base propia de Aceros RNF en servidores en São Paulo, con copia de seguridad automática todas las noches en dos lugares, y pueden exportar todo cuando quieran. Los remitos firmados y las facturas quedan guardados en la nube. El dólar se actualiza solo con la cotización divisa del Banco Nación, dos veces por día. Para la versión completa falta la factura electrónica y migrar lo que tienen en el sistema anterior."
