# Factura electrónica con ARCA (WSFEv1)

Las facturas y notas de crédito del **circuito 1 (fiscal, F1 / NC1)** se autorizan solas en ARCA: al emitirlas quedan **"Pendiente de ARCA"**, el sistema pide el CAE y, si sale bien, el comprobante queda **Autorizado** con CAE, vencimiento del CAE, número fiscal y QR (RG 4892). Los comprobantes del circuito 2 no van a ARCA.

Si falta configurar algo, o ARCA rechaza o no responde, el comprobante queda pendiente o rechazado con el motivo a la vista y un botón **"Reintentar ARCA"**. No se pierde nada: se reintenta cuando esté todo listo.

| Tipo del sistema | Código ARCA |
|---|---|
| Factura A / B | 1 / 6 |
| Nota de crédito A / B | 3 / 8 |

## 1. Certificado

Es el mismo certificado del padrón (ver [ARCA-PADRON.md](ARCA-PADRON.md), pasos 1 a 4). Si ya está cargado para el padrón, no hace falta otro: solo hay que autorizarlo para `wsfe` (paso 3).

## 2. Punto de venta electrónico (lo hace Aceros RNF, con clave fiscal nivel 3)

Los puntos de venta 0001 y 0002 del sistema son los de los documentos internos; para factura electrónica por web services ARCA exige uno **propio**, distinto del de factura en línea o controlador fiscal.

1. Entrar a https://auth.afip.gob.ar → **"Administración de puntos de venta y domicilios"**.
2. Elegir la empresa → **"A/B/M de puntos de venta"** → **Agregar**.
3. Número: el próximo libre (por ejemplo `5`). Sistema: **"RECE para aplicativo y web services"** (en monotributo: *"Factura Electrónica - Monotributo - Web Services"*). Domicilio: el de Casa Central.
4. Confirmar y anotar el número: es `ARCA_PUNTO_VENTA`.

## 3. Autorizar el certificado para factura electrónica

1. **Administrador de Relaciones de Clave Fiscal** → "Nueva relación" → Buscar servicio → ARCA → *WebServices* → **"Facturación Electrónica"** (`wsfe`).
2. Representante: "Computador fiscal" → elegir el alias del certificado (por ejemplo `aceros-rnf-padron`) → Confirmar.

## 4. Variables en Vercel (VM Studio)

| Variable | Valor |
|---|---|
| `ARCA_CUIT` | CUIT de Aceros RNF sin guiones |
| `ARCA_CERT` | certificado `.crt` en base64 |
| `ARCA_KEY` | clave privada `.key` en base64 |
| `ARCA_ENTORNO` | `produccion` (u `homologacion` para pruebas) |
| `ARCA_PUNTO_VENTA` | número del paso 2, por ejemplo `5` |

Las cuatro primeras ya están si el padrón oficial funciona. Falta solo:

```bash
printf '5' | vercel env add ARCA_PUNTO_VENTA production
vercel --prod   # o redeploy desde el panel
```

Después, en Ventas → Comprobantes, usar **"Reintentar ARCA"** en las facturas que hayan quedado pendientes.

## Probar primero en homologación

1. Con el certificado de homologación (WSASS, ver ARCA-PADRON.md) autorizado también a `wsfe`.
2. En homologación el punto de venta no se da de alta: sirve cualquier número (por ejemplo `1`).
3. Cargar `ARCA_ENTORNO=homologacion` y `ARCA_PUNTO_VENTA` en Preview, deployar staging y emitir una F1 de prueba. Los CAE de homologación no tienen validez fiscal.

## Qué manda el sistema

- Concepto 1 (productos), moneda PES, IVA 21 % (o la alícuota que corresponda al importe).
- Receptor: CUIT del cliente (tipo 80), DNI (96) o consumidor final (99). La condición frente al IVA (RG 5616) sale de la ficha del cliente; sin CUIT, consumidor final.
- La factura A exige CUIT del cliente. La nota de crédito exige que la factura de origen ya tenga CAE.
- Número: el último autorizado por ARCA + 1. Las autorizaciones salen de a una para no pisar números.

## Errores que puede mostrar

| Mensaje | Qué hacer |
|---|---|
| "Falta configurar el certificado de ARCA…" | cargar `ARCA_CERT`, `ARCA_KEY`, `ARCA_CUIT` (sección 4) |
| "Falta configurar el punto de venta electrónico…" | cargar `ARCA_PUNTO_VENTA` (secciones 2 y 4) |
| "El servicio de factura electrónica (wsfe) no está habilitado…" | revisar la relación de la sección 3 |
| "El certificado de ARCA está vencido" | renovar (ARCA-PADRON.md) |
| "ARCA no responde en este momento" | reintentar más tarde |
| "ARCA rechazó el comprobante: …" | leer el código y el motivo, corregir el comprobante o el cliente y reintentar |
