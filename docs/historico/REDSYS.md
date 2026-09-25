# Configuración Redsys — The Lounge Beerhouse

## Estado actual (Mayo 2026)

CaixaBank confirmó el **2026-05-17** que el entorno **real** del TPV está disponible (FUC `352464580`, terminal `1`). Configuración por entorno:

- **Producción** (rama `main`, Vercel scope Production): entorno real de Redsys (`sis.redsys.es`), `REDSYS_ENV=production`. Cobra pagos reales.
- **Testing** (rama `testing`, Vercel scope Preview) y **local**: entorno sandbox (`sis-t.redsys.es`), `REDSYS_ENV` sin definir. No se cobran pagos reales.

La separación entre entornos se hace **exclusivamente con variables de entorno en Vercel**; las ramas `main` y `testing` son idénticas en código.

---

## Cómo funciona por entorno

### Variables de entorno que controlan el comportamiento

| Variable | Propósito |
|----------|-----------|
| `REDSYS_SECRET_KEY` | Clave secreta para firmar los parámetros (HMAC-SHA256 + 3DES) |
| `REDSYS_MERCHANT_CODE` | Código de comercio Redsys |
| `REDSYS_TERMINAL` | Número de terminal |
| `REDSYS_ENV` | Si es `"production"`, usa URLs de producción Redsys. Si no está definida, usa sandbox. |
| `NEXT_PUBLIC_BASE_URL` | URL base del servidor (para construir URLOK, URLKO y MERCHANTURL) |

> ⚠️ Desde agosto de 2026 `NEXT_PUBLIC_BASE_URL` **se imprime en el recibo de pago** como "URL del
> comercio". En Vercel scope Production tiene que ser el dominio real de cara al cliente, no una URL
> de preview.

### URLs de vuelta (`src/modules/payments/actions/index.ts`)

| Parámetro | Valor |
|-----------|-------|
| `DS_MERCHANT_URLOK` | `{BASE_URL}/api/payments/return/{orderId}?r=ok` |
| `DS_MERCHANT_URLKO` | `{BASE_URL}/api/payments/return/{orderId}?r=ko&eventId={eventId}` |
| `DS_MERCHANT_MERCHANTURL` | `{BASE_URL}/api/payments/notify` |

**Por qué las vueltas no apuntan directamente a las pantallas.** `/reserva/confirmacion/[orderId]` y
`/reserva/error` son `page.tsx`, y en el App Router una página solo responde a GET. Hoy Redsys hace
una redirección limpia y funciona, pero la opción de **enviar parámetros en las URLs de respuesta** y
la de **redirección automática** se configuran en el mismo módulo de administración: si al activar la
segunda se activa la primera, Redsys empezaría a hacer POST contra esas páginas y se rompería la
pantalla de todos los clientes que acaban de pagar, en producción y sin aviso.

`src/app/api/payments/return/[orderId]/route.ts` acepta las dos formas y redirige con **303** (que es
lo que convierte el POST en GET; con un 302 algunos navegadores repiten el POST). Si los parámetros
llegan, verifica la firma y guarda los datos del recibo. **No confirma ni cancela nada**: eso sigue
en el webhook y en el respaldo de cada página.

### Métodos de pago (`src/modules/payments/actions/index.ts`)

| Parámetro | Valor |
|-----------|-------|
| `DS_MERCHANT_PAYMETHODS` | `"C"` (solo tarjeta) — constante `PAY_METHODS` en `src/lib/redsys.ts` |

**Por qué se envía.** El parámetro es opcional y, si no se manda, Redsys muestra en la pasarela
**todos los métodos que tenga contratados el terminal**: hasta agosto de 2026 el cliente veía un
selector con tarjeta **y Bizum**. Enviando `"C"` la pasarela abre directamente el formulario de
tarjeta. Va dentro del `Ds_MerchantParameters` firmado, igual que el importe, así que no se puede
manipular desde el navegador.

Valores de Redsys: `"C"` tarjeta, `"z"` Bizum, `"xpay"` Apple Pay / Google Pay. Ojo: si algún día se
contrata X-Pay en el terminal, `"C"` también lo ocultaría.

### Lógica de URLs de Redsys (`src/lib/redsys.ts`)

```typescript
const urls =
  process.env.REDSYS_ENV === "production" ? PRODUCTION_URLS : SANDBOX_URLS;
```

- **`REDSYS_ENV` no definida** → Sandbox (`sis-t.redsys.es:25443`)
- **`REDSYS_ENV=production`** → Producción (`sis.redsys.es`)

> ⚠️ **IMPORTANTE**: No usar `NODE_ENV` para esta distinción. En Vercel, `NODE_ENV` es siempre `"production"` tanto en Production como en Preview, lo que haría que los entornos de prueba usen URLs de producción con credenciales sandbox → error SIS0042.

### Lógica de auto-confirmación (`src/app/reserva/confirmacion/[orderId]/page.tsx`)

```typescript
if (process.env.REDSYS_ENV !== "production") {
  await confirmReservationByOrderId(orderId);
}
```

| Entorno | `REDSYS_ENV` | Comportamiento en página de confirmación |
|---------|-------------|------------------------------------------|
| Local dev | no definida | Auto-confirma (webhook no puede alcanzar localhost) |
| Preview / testing | no definida | Auto-confirma (webhook sandbox no siempre alcanza Vercel preview) |
| **Producción real** | `production` | **Solo el webhook confirma** (fuente de verdad única) |

En producción, el navegador del cliente puede llegar a la página de confirmación antes de que el webhook de Redsys haya confirmado la reserva. Para evitar un error 404 en esa carrera, si la reserva aún no está `CONFIRMED` se renderiza `ProcessingClient` (`processing-client.tsx`), que sondea el estado cada 2,5 s (hasta ~40 s) y muestra el ticket al confirmarse, o un mensaje de espera si el webhook tarda más.

**Consecuencia para el recibo de pago**: el código de autorización y la fecha/hora solo llegan en la
notificación firmada, así que en local y en testing (donde la página autoconfirma sin webhook) la
tarjeta de recibo sale con guiones. Para probarla sin esperar a un pago real:

```bash
npx tsx scripts/simulate-redsys-notify.ts <orderId> [ok|ko]
```

Firma una notificación con la clave del entorno cargado y la manda a `localhost:3000`. Aborta si
`REDSYS_ENV=production` o si el destino no es localhost, y exige `--force` para un `ko` sobre una
reserva ya confirmada (la cancelaría y liberaría sus asientos de forma irreversible).

---

## Configuración actual por entorno

> ⚠️ **SEGURIDAD**: Los valores reales de `REDSYS_SECRET_KEY` nunca se documentan aquí ni en ningún archivo commiteado a git. Se configuran exclusivamente en Vercel (entornos Production y Preview) y en `.env` local (gitignoreado). Commitear la clave de producción sería una vulnerabilidad crítica: permitiría forjar notificaciones de pago.

### Local (dev)

```env
REDSYS_SECRET_KEY=<clave SHA-256 de pruebas — portal Canales>
REDSYS_MERCHANT_CODE=352464580
REDSYS_TERMINAL=1
NEXT_PUBLIC_BASE_URL=http://localhost:3000
# REDSYS_ENV → no definida (usa sandbox)
```

- Redsys no puede alcanzar `localhost`, por eso existe el auto-confirm.
- El puerto 25443 del sandbox puede estar bloqueado en tu red local. Usar datos móviles para probar el flujo completo.
- Tarjetas de prueba CaixaBank: ver sección "Tarjetas de prueba" más abajo.

### Preview / Testing (Vercel — rama `testing`)

Configurado en Vercel → Settings → Environment Variables → entorno **Preview**:

```
REDSYS_SECRET_KEY    = <clave SHA-256 de pruebas — configurar en Vercel>
REDSYS_MERCHANT_CODE = 352464580
REDSYS_TERMINAL      = 1
NEXT_PUBLIC_BASE_URL = https://lounge-app-titanium.vercel.app
# REDSYS_ENV → no definida (usa sandbox)
```

### Producción (Vercel — rama `main`, entorno REAL de Redsys)

Configurado en Vercel → Settings → Environment Variables → entorno **Production**:

```
REDSYS_ENV           = production
REDSYS_SECRET_KEY    = <clave SHA-256 real — portal Canales — configurar en Vercel>
REDSYS_MERCHANT_CODE = 352464580
REDSYS_TERMINAL      = 1
NEXT_PUBLIC_BASE_URL = https://lounge-app-neon.vercel.app
```

---

## Tarjetas de prueba (proporcionadas por CaixaBank)

### Pago aceptado

| Campo | Valor |
|-------|-------|
| Número | `4548 8100 0000 0003` |
| Caducidad | `12/27` |
| CVV2 | `123` |
| Código CIP | `123456` |

### Pago denegado

| Campo | Valor |
|-------|-------|
| Número | `1111 1111 1111 1117` |
| Caducidad | `12/27` |
| CVV2 | (no requerido) |

> El sandbox de Redsys usa el puerto `25443`. Si el navegador no puede conectar, usar datos móviles (los routers domésticos suelen bloquear puertos no estándar).

---

## Guía de migración a credenciales de producción

Cuando CaixaBank valide la web y proporcione las credenciales definitivas de producción, seguir estos pasos **exactamente en este orden**:

### Paso 1 — Datos del banco (recibidos el 2026-05-17)

CaixaBank confirmó el entorno real con estos datos:
- `REDSYS_MERCHANT_CODE` (FUC) = `352464580` (el mismo que en pruebas)
- `REDSYS_TERMINAL` = `1`
- `REDSYS_MERCHANT_CURRENCY` = `978` (EUR)
- `REDSYS_SECRET_KEY` — **clave SHA-256 de producción**, distinta de la de pruebas. No se envía por correo: se obtiene del portal `https://canales.redsys.es/lacaixa` (Administración → Comercio → Detalles del terminal → Ver clave).

### Paso 2 — Actualizar variables en Vercel Production únicamente

En Vercel → proyecto → Settings → Environment Variables, modificar **solo el entorno Production** (no Preview):

| Variable | Valor actual (TPV pruebas) | Nuevo valor (producción) |
|----------|--------------------------|--------------------------|
| `REDSYS_MERCHANT_CODE` | `352464580` | `352464580` (sin cambios) |
| `REDSYS_TERMINAL` | `1` | `1` (sin cambios) |
| `REDSYS_SECRET_KEY` | *(clave sandbox en Vercel)* | Clave SHA-256 real del portal Canales |

### Paso 3 — Añadir REDSYS_ENV en Production

Crear una nueva variable **solo en Production**:

```
REDSYS_ENV = production
```

> Esta variable es la que activa las URLs reales de Redsys Y desactiva el auto-confirm en la página de confirmación, dejando el webhook como única fuente de verdad.

### Paso 4 — Redesplegar

Hacer un push vacío a `main` para forzar el redespliegue con las nuevas variables:

```bash
git checkout main
git commit --allow-empty -m "ci: redeploy with production Redsys credentials"
git push origin main
```

### Paso 5 — Verificar el webhook en producción

Tras el redespliegue, hacer un pago de prueba con una tarjeta real (importe mínimo). Verificar en Vercel → Logs que aparece:

```
[Payment notify] orderId=XXXX response=0000 success=true
[Payment notify] Reservation XXXX confirmed
```

Si el log del webhook no aparece, la reserva quedará en PENDING y habrá que investigar por qué el banco no puede alcanzar `NEXT_PUBLIC_BASE_URL/api/payments/notify`.

### Paso 6 — Preview sigue usando sandbox

Los entornos Preview (rama `testing`) **no requieren ningún cambio** — seguirán usando las credenciales de sandbox y el auto-confirm. Esto es correcto: nunca debe haber dinero real en el entorno de pruebas.

---

## Resumen de seguridad

| Riesgo | Mitigación |
|--------|-----------|
| Precio manipulado desde el cliente | `pricePerSeat` se lee de la BD, nunca del cliente (`payments/actions/index.ts`) |
| Confirmación de reserva sin pagar | Solo en sandbox/dev; en producción real solo el webhook confirma (`REDSYS_ENV=production`) |
| Webhook forjado (firma falsa) | `REDSYS_SECRET_KEY` **nunca se commitea a git** — solo en Vercel y `.env` local (gitignoreado) |
| Credenciales de test en producción real | `REDSYS_ENV=production` activa URLs reales; sin ella, se usa sandbox aunque las credenciales sean reales |
| Credenciales expuestas en código | Las 3 variables de Redsys son obligatorias vía env vars; la app no arranca sin ellas |
