# Entrega del sistema · Aceros RNF

## Qué se entrega

Sistema de gestión a medida para el corralón y la ferretería, en línea y multiusuario:

- Clientes y obras; **acopios por monto** con lista de precios congelada, retiros, devoluciones y traspasos.
- Ventas (cotizaciones, notas de pedido, facturas, notas de crédito, recibos) con circuito AC1/AC2.
- Remitos con picking y remito firmado; **stock** con disponible real (físico − pendiente de entrega − reservado).
- Despachos con tiempos, hoja de ruta, vehículos y choferes.
- Compras, recepciones, proveedores y acopios con proveedores.
- Cuentas corrientes, cheques y reportes (ventas, rentabilidad con costo histórico, valorización, acopios).
- Dólar BNA automático, usuarios con roles y permisos, auditoría de todo lo que se hace y modo capacitación.

Dirección: https://construccion-demos.vercel.app, o el dominio propio que elijan (ver README).

## Dónde viven los datos

- **Base de datos:** PostgreSQL en **Neon**, en servidores de Amazon Web Services en Estados Unidos (us-east-1, Virginia). Cifrada en reposo y en tránsito. Con el plan **Launch**, Neon guarda **7 días de historial** para volver a cualquier minuto anterior.
- **Archivos** (remitos firmados, fotos, PDF): **Vercel Blob privado**. Solo se ven desde el sistema, con sesión y permiso.
- **Aplicación:** Vercel, en la misma región que la base.

## Backups

1. Historial de Neon: 7 días con el plan Launch.
2. **Copia propia diaria en Cloudflare R2**, en otro proveedor. Se hace a las 04:00 y se guardan los últimos **35 días** y una copia por mes durante **12 meses**.
3. Cualquier dueño puede descargar en el momento todos los datos: **Configuración → Datos → Exportar respaldo**. Baja un ZIP con planillas para Excel y un archivo completo.

Detalle técnico y cómo restaurar: [BACKUPS.md](BACKUPS.md).

## Usuarios

- La primera persona que entra al sistema vacío **se registra como dueño**. Después el registro deja de existir.
- **Agregar un usuario:** Configuración → Usuarios y roles → "Nuevo usuario" (solo dueños). El rol por defecto es Dueño; se puede elegir Administración, Ventas o Depósito, con su sucursal. Se genera una **contraseña temporal** que se muestra una sola vez: "Copiar datos de acceso" arma el mensaje para mandar por WhatsApp. Al primer ingreso la persona elige su propia contraseña.
- **Restablecer una contraseña:** en la misma pantalla, menú ⋯ del usuario → "Restablecer contraseña". Se genera otra temporal y se cierran sus sesiones abiertas.
- **Cerrar sesiones o desactivar** (por ejemplo, si alguien se va de la empresa): menú ⋯ → "Cerrar sesiones" o "Desactivar". Se corta en menos de un minuto. Sus movimientos quedan en el historial.
- Protecciones: nadie puede desactivarse a sí mismo ni cambiarse el rol, y siempre queda al menos un dueño activo.

## Si el Banco Nación no responde

El dólar se toma del BNA (divisa vendedor) a las 10:35 y a las 16:05 de cada día hábil. Si el banco no responde, se usa el dólar mayorista de dolarapi.com como respaldo y se avisa en pantalla. Si igual queda desactualizado, un dueño o administración puede tocar **"Actualizar ahora"** o pasar a **valor manual** en Configuración → Parámetros, y volver a automático cuando el banco se normalice.

## Exportar todos los datos

Configuración → Datos → **Exportar respaldo** (solo dueños, queda en la auditoría). Además, cada listado tiene su descarga a Excel o PDF.

## Costos mensuales de infraestructura (estimados a octubre de 2026)

| Servicio | Plan | Costo aproximado |
|---|---|---|
| Vercel (aplicación) | Pro, 1 integrante | USD 20 / mes, con USD 20 de uso incluido |
| Neon (base de datos) | Launch (por uso, sin mínimo) | USD 5 a 30 / mes según horas de uso (compute USD 0,106 por CU-hora, storage USD 0,35 por GB-mes) |
| Cloudflare R2 (backups) | Gratis hasta 10 GB | USD 0 |
| Sentry (errores) | Developer, gratuito | USD 0 |
| UptimeRobot (monitoreo) | Gratuito | USD 0 |
| **Total** | | **≈ USD 25 a 50 / mes** |

Los precios son de los proveedores y pueden cambiar. Conviene poner un **límite de gasto** en Vercel (Settings → Billing → Spend Management).

## Fase siguiente (no incluida)

- **Facturación electrónica ARCA (ex AFIP):** CAE, punto de venta electrónico y QR en los comprobantes.
- **Migración de datos del sistema anterior:** clientes, saldos, stock y acopios vigentes. La importación por planilla ya existe para artículos, clientes y proveedores.
- **App de choferes:** hoja de ruta en el celular, entrega con foto y firma, ubicación.
