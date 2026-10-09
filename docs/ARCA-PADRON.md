# Padrón de ARCA: certificado para la consulta oficial

Al cargar un CUIT/CUIL en el alta de cliente o proveedor, el sistema completa razón social, condición frente al IVA, tipo de persona y domicilio. Hay dos fuentes:

| Fuente | Cuándo | Confiabilidad |
|---|---|---|
| **ARCA oficial** (web services `ws_sr_padron_a13` y `ws_sr_padron_a5`) | si están cargados `ARCA_CERT` y `ARCA_KEY` | oficial, estable, sin límites prácticos |
| Fuente pública no oficial (cuitonline.com) | mientras no haya certificado, o si ARCA falla | **inestable**: pide captcha si se consulta seguido y puede dejar de funcionar en cualquier momento. Cuando falla, el formulario queda manual. |

La que pedía el plan original (afip.tangofactura.com) ya no funciona: responde "Sistema desactualizado o fuera de soporte". **Para uso real conviene tener el certificado.** Las consultas se guardan 30 días (tabla `PadronCache`), así que el mismo CUIT no se vuelve a consultar.

El estado se ve en **Configuración → Parámetros → Padrón de ARCA**. Si el certificado vence en menos de 30 días, aparece un aviso en la campana.

## 1. Generar la clave y el pedido de certificado (lo hace VM Studio)

```bash
pnpm arca:csr -- --cuit <CUIT de Aceros RNF> --empresa "<Razón social exacta>" --alias aceros-rnf-padron
```

Deja dos archivos en `arca/`, una carpeta ignorada por git:

- `aceros-rnf-padron.key`: **clave privada**. Nunca sale de VM Studio, no se manda por mail ni por WhatsApp.
- `aceros-rnf-padron.csr`: el pedido que se sube a ARCA.

## 2. En ARCA (lo hace Aceros RNF, con clave fiscal nivel 3 del titular o de un administrador de relaciones)

1. Entrar a https://auth.afip.gob.ar con el CUIT de la empresa.
2. Si no aparece el servicio **"Administración de Certificados Digitales"**, agregarlo desde "Administrador de Relaciones de Clave Fiscal" → "Adherir servicio" → ARCA → Servicios interactivos → *Administración de Certificados Digitales*.
3. **Administración de Certificados Digitales** → "Agregar alias" → alias `aceros-rnf-padron` → subir el archivo `.csr` → **Agregar alias**.
4. Entrar al alias y **descargar el certificado** (`.crt`). Ese archivo se le pasa a VM Studio; no es secreto.
5. **Administrador de Relaciones de Clave Fiscal** → "Nueva relación" → Buscar servicio → ARCA → *WebServices* → **"Consulta Padrón Alcance 13"** (`ws_sr_padron_a13`) → Representante: "Computador fiscal" → elegir el alias `aceros-rnf-padron` → Confirmar.
6. Repetir el paso 5 con **"Consulta Padrón Alcance 5"** (`ws_sr_padron_a5`), que es el que informa la condición de IVA. Si no se habilita, el sistema usa solo A13 y la condición de IVA se elige a mano.

El certificado dura 2 años. Para renovarlo, se repiten los pasos 1 a 4 con un alias nuevo y se actualizan las variables.

## 3. Cargar en Vercel (VM Studio)

```bash
base64 -i arca/aceros-rnf-padron.crt | tr -d '\n' | vercel env add ARCA_CERT production --sensitive
base64 -i arca/aceros-rnf-padron.key | tr -d '\n' | vercel env add ARCA_KEY production --sensitive
printf '<CUIT de Aceros RNF sin guiones>' | vercel env add ARCA_CUIT production
printf 'produccion' | vercel env add ARCA_ENTORNO production
vercel --prod   # o redeploy desde el panel
```

Después, Configuración → Parámetros tiene que mostrar "ARCA oficial · certificado vence el dd/MM/aaaa".

## Probar primero en homologación (opcional)

ARCA tiene un entorno de prueba con datos ficticios:

1. Con clave fiscal: adherir **"WSASS - Autogestión Certificados Homologación"**, crear ahí un certificado de prueba con el mismo `.csr` y autorizarlo a `ws_sr_padron_a13` (y a5).
2. Cargar ese `.crt` en el entorno **Preview** de Vercel (`ARCA_CERT`, `ARCA_KEY`, `ARCA_CUIT`) con `ARCA_ENTORNO=homologacion`, deployar staging y probar un alta de cliente.
3. En local: con las mismas variables en `.env.local`, correr `pnpm padron:probar -- 20123456786`.

## Errores que puede mostrar

| Mensaje | Qué hacer |
|---|---|
| "El certificado de ARCA está vencido" | renovar (sección 2) |
| "El servicio de padrón no está habilitado para el certificado" | revisar las relaciones del paso 2.5 y 2.6 |
| "El CUIT no existe en el padrón de ARCA" | revisar el número |
| "ARCA no responde en este momento" | se usa la fuente pública; reintentar más tarde |

Los errores del proveedor oficial quedan en la auditoría ("Error del padrón de ARCA"). Las consultas normales no se registran, porque son muchas.
