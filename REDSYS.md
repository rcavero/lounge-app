# Configuración Redsys — The Lounge Beerhouse

## Estado actual (Abril 2026)

Se están usando **credenciales de sandbox** (cuenta de pruebas pública de Redsys) en todos los entornos. Las credenciales reales del TPV del bar están pendientes de recibir del banco.

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

---

## Configuración actual por entorno

### Local (dev)

```env
REDSYS_SECRET_KEY=sq7HjrUOBfKmC576ILgskD5srU870gJ7
REDSYS_MERCHANT_CODE=999008881
REDSYS_TERMINAL=001
NEXT_PUBLIC_BASE_URL=http://localhost:3000
# REDSYS_ENV → no definida (usa sandbox)
```

- Sandbox Redsys no puede alcanzar `localhost`, por eso existe el auto-confirm.
- El puerto 25443 del sandbox puede estar bloqueado en tu red local. Usar datos móviles para probar el flujo completo.

### Preview / Testing (Vercel — rama `testing`)

Configurado en Vercel → Settings → Environment Variables → entorno **Preview**:

```
REDSYS_SECRET_KEY    = sq7HjrUOBfKmC576ILgskD5srU870gJ7
REDSYS_MERCHANT_CODE = 999008881
REDSYS_TERMINAL      = 001
NEXT_PUBLIC_BASE_URL = https://lounge-app-titanium.vercel.app
# REDSYS_ENV → no definida (usa sandbox)
```

### Producción actual (Vercel — rama `main`, credenciales sandbox)

Configurado en Vercel → Settings → Environment Variables → entorno **Production**:

```
REDSYS_SECRET_KEY    = sq7HjrUOBfKmC576ILgskD5srU870gJ7
REDSYS_MERCHANT_CODE = 999008881
REDSYS_TERMINAL      = 001
NEXT_PUBLIC_BASE_URL = https://lounge-app-neon.vercel.app
# REDSYS_ENV → no definida (usa sandbox)
```

---

## Tarjeta de prueba Redsys (sandbox)

| Campo | Valor |
|-------|-------|
| Número | `4548 8120 4940 0004` |
| Caducidad | Cualquier fecha futura (ej: `12/26`) |
| CVV | `123` |

> El sandbox de Redsys usa el puerto `25443`. Si el navegador no puede conectar, usar datos móviles (los routers domésticos suelen bloquear puertos no estándar).

---

## Guía de migración a credenciales reales del TPV

Cuando el banco proporcione las credenciales reales del TPV, seguir estos pasos **exactamente en este orden**:

### Paso 1 — Recibir del banco

El banco debe proporcionar:
- `REDSYS_MERCHANT_CODE` — código de comercio real (distinto de 999008881)
- `REDSYS_TERMINAL` — número de terminal real
- `REDSYS_SECRET_KEY` — clave secreta real (distinta de la de sandbox)
- Confirmación de que el terminal está habilitado para operaciones de tipo Internet (e-commerce)

### Paso 2 — Actualizar variables en Vercel Production únicamente

En Vercel → proyecto → Settings → Environment Variables, modificar **solo el entorno Production** (no Preview):

| Variable | Valor actual (sandbox) | Nuevo valor (producción) |
|----------|----------------------|--------------------------|
| `REDSYS_MERCHANT_CODE` | `999008881` | El que dé el banco |
| `REDSYS_TERMINAL` | `001` | El que dé el banco |
| `REDSYS_SECRET_KEY` | `sq7HjrUOBfKmC576ILgskD5srU870gJ7` | El que dé el banco |

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
| Credenciales sandbox en producción real | `REDSYS_ENV=production` activa URLs reales; sin ella, se usa sandbox aunque las credenciales sean reales |
| Credenciales expuestas en código | Las 3 variables de Redsys son obligatorias vía env vars; la app no arranca sin ellas |
