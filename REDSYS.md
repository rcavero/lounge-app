# Configuración Redsys — The Lounge Beerhouse

## Estado actual (Mayo 2026)

Se están usando las **credenciales del TPV de pruebas de CaixaBank** asignadas específicamente al comercio (FUC `352464580`). El entorno sigue siendo sandbox (URLs `sis-t.redsys.es`) — no se cobran pagos reales. Las credenciales de producción las proporcionará CaixaBank una vez validen la web operativa.

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
REDSYS_MERCHANT_CODE=352464580
REDSYS_TERMINAL=001
NEXT_PUBLIC_BASE_URL=http://localhost:3000
# REDSYS_ENV → no definida (usa sandbox)
```

- Redsys no puede alcanzar `localhost`, por eso existe el auto-confirm.
- El puerto 25443 del sandbox puede estar bloqueado en tu red local. Usar datos móviles para probar el flujo completo.
- Tarjetas de prueba CaixaBank: ver sección "Tarjetas de prueba" más abajo.

### Preview / Testing (Vercel — rama `testing`)

Configurado en Vercel → Settings → Environment Variables → entorno **Preview**:

```
REDSYS_SECRET_KEY    = sq7HjrUOBfKmC576ILgskD5srU870gJ7
REDSYS_MERCHANT_CODE = 352464580
REDSYS_TERMINAL      = 001
NEXT_PUBLIC_BASE_URL = https://lounge-app-titanium.vercel.app
# REDSYS_ENV → no definida (usa sandbox)
```

### Producción actual (Vercel — rama `main`, credenciales TPV pruebas CaixaBank)

Configurado en Vercel → Settings → Environment Variables → entorno **Production**:

```
REDSYS_SECRET_KEY    = sq7HjrUOBfKmC576ILgskD5srU870gJ7
REDSYS_MERCHANT_CODE = 352464580
REDSYS_TERMINAL      = 001
NEXT_PUBLIC_BASE_URL = https://lounge-app-neon.vercel.app
# REDSYS_ENV → no definida (usa sandbox)
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

### Paso 1 — Recibir del banco

Tras superar la validación, CaixaBank proporcionará:
- `REDSYS_MERCHANT_CODE` — puede ser el mismo `352464580` u otro
- `REDSYS_TERMINAL` — número de terminal de producción
- `REDSYS_SECRET_KEY` — **nueva clave secreta para producción** (distinta de la de sandbox)
- Confirmación de activación del terminal en entorno real

### Paso 2 — Actualizar variables en Vercel Production únicamente

En Vercel → proyecto → Settings → Environment Variables, modificar **solo el entorno Production** (no Preview):

| Variable | Valor actual (TPV pruebas) | Nuevo valor (producción) |
|----------|--------------------------|--------------------------|
| `REDSYS_MERCHANT_CODE` | `352464580` | El que dé el banco |
| `REDSYS_TERMINAL` | `001` | El que dé el banco |
| `REDSYS_SECRET_KEY` | `sq7HjrUOBfKmC576ILgskD5srU870gJ7` | La clave definitiva del banco |

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
| Credenciales de test en producción real | `REDSYS_ENV=production` activa URLs reales; sin ella, se usa sandbox aunque las credenciales sean reales |
| Credenciales expuestas en código | Las 3 variables de Redsys son obligatorias vía env vars; la app no arranca sin ellas |
