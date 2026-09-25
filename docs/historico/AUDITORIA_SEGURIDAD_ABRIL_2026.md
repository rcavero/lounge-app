# Auditoría de Seguridad — The Lounge Beerhouse
**Fecha:** Abril 2026

---

## CRÍTICO

### 1. Bypass de pago — confirmación sin pagar
**Archivo:** `src/app/reserva/confirmacion/[orderId]/page.tsx:19`

El page server component llama a `confirmReservationByOrderId(orderId)` automáticamente cuando alguien visita la URL. El `orderId` es visible para el usuario en el formulario de Redsys antes de redirigir al banco. Un atacante puede:
1. Iniciar el flujo de reserva → obtiene `orderId`
2. Navegar manualmente a `/reserva/confirmacion/[orderId]` sin pasar por el banco
3. La reserva queda `CONFIRMED` sin haber pagado

**Fix:** Eliminar el auto-confirm del page y confiar únicamente en el webhook. El page debe solo leer el estado, no cambiarlo:

```typescript
// page.tsx — eliminar esta línea:
await confirmReservationByOrderId(orderId); // ❌ ELIMINAR

// Solo leer:
const reservation = await getReservationByOrderId(orderId);
if (!reservation || reservation.status !== "CONFIRMED") notFound();
```

---

### 2. Precio manipulable desde el cliente
**Archivo:** `src/modules/payments/actions/index.ts:18,82`

`initializePayment` acepta `pricePerSeat` del cliente y lo usa directamente sin validar contra el precio real del evento en base de datos. Un atacante puede enviar `pricePerSeat: 0`.

```typescript
// Línea 82 — calcula precio con dato del cliente ❌
const totalPrice = seatIds.length * pricePerSeat;
```

**Fix:** Leer el precio del evento desde la base de datos, ignorar el parámetro del cliente:

```typescript
const event = await prisma.event.findUnique({ where: { id: eventId } });
// ...
const totalPrice = seatIds.length * event.pricePerSeat; // ✅ fuente de verdad del servidor
```

---

## ALTO

### 3. CRON_SECRET bypasseable si no está configurado
**Archivos:** `src/app/api/cron/cleanup/route.ts:9`, `src/app/api/cron/sync-teams/route.ts:8`

```typescript
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) { // ❌
```

Si `CRON_SECRET` no está definido en las variables de entorno, el `if` no se ejecuta y cualquiera puede triggear los crons. El cleanup elimina eventos permanentemente.

**Fix:**
```typescript
if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) { // ✅
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

---

### 4. Sin rate limiting en el login
**Archivo:** `src/modules/auth/actions/index.ts`

No hay protección contra fuerza bruta en el formulario de login de admin. Un atacante puede intentar contraseñas indefinidamente.

**Fix a corto plazo:** Configurar rate limiting en Vercel (ya disponible en el plan Pro) o añadir un middleware de limitación en la ruta `/admin/login`.

---

### 5. Server actions de admin sin verificación de sesión
**Archivos:** `src/modules/users/actions/index.ts`, `src/modules/events/actions/index.ts`, etc.

Las server actions del panel admin no verifican que el llamante tenga sesión activa. Solo está protegida la UI mediante middleware, pero las actions son endpoints HTTP invocables directamente si se conoce el action ID.

**Fix:** Añadir verificación al inicio de las actions sensibles:

```typescript
export async function deleteUser(id: string) {
  const session = await getSessionData();
  if (!session.isLoggedIn) throw new Error("Unauthorized");
  // ...
}
```

---

## MEDIO

### 6. Credenciales Redsys sandbox hardcodeadas como fallback
**Archivo:** `src/lib/redsys.ts:3-16`

```typescript
const secretKey = process.env.REDSYS_SECRET_KEY ?? "sq7HjrUOBfKmC576ILgskD5srU870gJ7"; // ❌
```

Si se despliega sin `REDSYS_SECRET_KEY`, la app funciona silenciosamente en modo sandbox sin error visible.

**Fix:** Fallar en arranque si faltan las variables críticas:
```typescript
const secretKey = process.env.REDSYS_SECRET_KEY;
if (!secretKey) throw new Error("REDSYS_SECRET_KEY no configurado");
```

---

## Resumen de prioridades

| # | Severidad | Issue | Esfuerzo | Estado |
|---|-----------|-------|----------|--------|
| 1 | Crítico | Bypass de pago por URL directa | Bajo | ✅ Resuelto (commit acc3e7d) |
| 2 | Crítico | Precio controlado por cliente | Bajo | ✅ Resuelto (commit d4cd9e3) |
| 3 | Alto | CRON_SECRET bypasseable | Mínimo | ✅ Resuelto (commit ad128a5) |
| 4 | Alto | Sin rate limiting en login | Medio | ✅ Resuelto (commit 74d5372) |
| 5 | Alto | Server actions sin auth check | Medio | ✅ Resuelto (commit 1a52874) |
| 6 | Medio | Credenciales sandbox hardcodeadas | Mínimo | ✅ Resuelto (commit 86722bf) |

**Todos los issues resueltos el 22 de abril de 2026. Fixes aplicados en ramas `main`, `testing` y `dev`.**
