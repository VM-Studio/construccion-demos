# construccion-demos · Aceros RNF

Sistema de gestión a medida para **Aceros RNF** (dueño: **Felipe**). DEMO comercial de VM Studio: debe verse como producto terminado.

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
Los **blobs viven en IndexedDB** (`idb-keyval`, helper `src/lib/adjuntos.ts`: `guardarAdjunto`, `obtenerUrl`, `eliminarAdjunto`); en el store (localStorage) solo la metadata `Adjunto`. El remito firmado (categoría REMITO_FIRMADO) setea `firmadoAdjuntoId`. Los 3 remitos firmados de ejemplo del seed se generan en runtime con jsPDF.

## Navegación
Por **módulos** estilo launcher (se implementa en M2): `/inicio` con tarjetas de módulos y sus páginas; dentro de una página, barra lateral con las páginas del módulo y "← Módulos". Definición única en `src/config/modulos.ts`.

## Stack y reglas
- Next.js 15 App Router, TS strict, Tailwind v4 (tokens en globals.css), Zustand con persist (clave `cd-demo-v2`), Recharts, Lucide, pnpm. jsPDF + autotable y exceljs para descargas (dynamic import).
- SIN base de datos. `src/store/*` con transacciones (`Tx`, `ejecutar`); `src/data/repositories/*` lista para Prisma. Las pantallas nunca tocan localStorage directo.
- Toda regla de negocio vive en `src/domain/` como funciones puras. Los componentes solo renderizan y llaman acciones del store.
- `pnpm seed:check` (base vacía + datos de ejemplo: kardex, saldos, acopios, Ramos = $ 844,85) y `pnpm flujos:check` (flujos completos sobre el store, incluido el recorrido desde el sistema vacío).

- Dinero en ARS con `formatMoney`. Fechas con date-fns y `formatDate`. Nunca `toLocaleString` suelto.
- UI: primitivas de `src/components/ui`. Solo tokens de color, un acento ámbar. Densidad alta. Nada de colores llamativos.
- Español rioplatense en toda la UI. Sin anglicismos innecesarios. Textos de empresa desde `BRAND` / configuración.
- Cada página: título, acción primaria arriba a la derecha, filtros, tabla o grilla, estado vacío con CTA.
- Escritorio prioritario, responsive obligatorio.
- Commits en español, imperativo, cortos.

## Sistema vacío y carga inicial
- El store arranca con `seedBase()` (solo estructura: empresa, 2 sucursales/depósitos con posiciones, unidades de negocio y rubros, 3 listas sin precios — Mayorista 22 %, Corralón 28 %, Público 45 % —, motivos de ajuste, 4 usuarios, numeración en 0). `seedEjemplo()` (todo el ejemplo, Ramos incluido) se construye encima y se carga a pedido con `cargarDatosEjemplo()` desde Configuración → Datos del demo. `resetearDemo()` vuelve a la base.
- Prerrequisitos por pantalla en `src/domain/prerequisitos.ts` (`prerequisitos(pagina, db)`); textos de estados vacíos en `src/config/vacios.ts` (`<VacioGuiado pagina>`); guía de carga en `src/domain/cargaInicial.ts`.
- Importación CSV (papaparse) en `src/domain/importacion.ts` + `ImportarCsvDialog`; plantillas y ejemplos en `public/plantillas/`.
- Alta rápida: `SelectorCliente/Proveedor/Vehiculo/Chofer` (`src/components/shared/alta-rapida.tsx`) y "Crear artículo nuevo…" en `ProductoPicker`.
- Inventario inicial = ajuste con motivo `INVENTARIO_INICIAL` y costo unitario editable; saldos iniciales de cuenta corriente = comprobante `SALDO_INICIAL` (código `SI`).

## Modo capacitación (`src/capacitacion/`)
- Todo vive en esa carpeta y detrás de un solo interruptor (`capacitacion.modo` en el store, persistido; default `true` en demo; solo DUENO y ADMINISTRACION lo cambian desde el ícono `GraduationCap` del header o Configuración → Datos del demo).
- `impactos.ts` es el ÚNICO lugar con textos: `IMPACTOS` (qué cambia con cada acción), `CAMPOS` (una línea por valor de campo) y `PAGINAS` (de qué se alimenta cada pantalla y a qué alimenta).
- Fuera de la carpeta solo se usan, desde `@/capacitacion`: `<Impacto accion>` (debajo del botón primario o arriba del footer del dialog), `<ImpactoCampo campo>`, `<BannerPagina>` (ya está en `PageHeader`), los interruptores y `medir(accionId, contexto, fn)` alrededor de cada acción que escribe en el store. Con el modo apagado los componentes devuelven `null` y `medir()` solo ejecuta `fn()`.
- `medir.ts` es genérico: foto de métricas antes/después (stock por artículo × depósito, costos, cuentas de clientes y proveedores, acopios, KPIs del tablero, documentos y altas) y muestra el aviso "Listo · Esto cambió:" (`AvisoCambios.tsx`). El historial de la sesión (máx. 50, no persistido) se ve en el panel "¿Qué pasó?" (`PanelQuePaso.tsx`).
- **Para quitar el modo capacitación:** poner default `false` en `CAPACITACION_INICIAL.modo` (`src/capacitacion/slice.ts`) y se oculta todo; o borrar `src/capacitacion/`, los `<Impacto>`/`<ImpactoCampo>`/`<BannerPagina>`/interruptores que quedan vacíos, reemplazar cada `await medir(id, ctx, fn)` por `fn()` y sacar la clave `capacitacion` del store (`src/store/index.ts`, `src/store/types.ts`).
