# Plan: Integración de Pasarela de Pago Redsys

## Contexto

Actualmente las reservas se crean sin proceso de pago real: se marcan como `CONFIRMED` con `paymentStatus: "COMPLETED"` instantáneamente, con datos de cliente hardcodeados (`"Cliente"`, `"cliente@lounge.com"`). El schema de Prisma ya tiene los campos `paymentId` y `paymentStatus` preparados, y existe un módulo `src/modules/payments/types/index.ts` con tipos básicos definidos. Se necesita implementar el flujo completo de pago con Redsys usando el método de redirección (el más seguro y sencillo).

---

## Sobre el TPV físico del bar

El TPV físico (datáfono) y el TPV Virtual (pagos online) son **terminales distintos** pero comparten la misma cuenta del comercio en el banco. Los cobros de ambos se liquidan en la misma cuenta bancaria. No se "conectan" entre sí directamente; son terminales independientes con IDs diferentes.

---

## Información a solicitar al banco

Contactar con el banco y solicitar el **alta de un TPV Virtual con Redsys**:

|                        Dato                       |                        Descripción                        |
|---------------------------------------------------|-----------------------------------------------------------|
| **Código de comercio (Ds_Merchant_MerchantCode)** | Identificador del negocio (4-12 dígitos)                  |
| **Número de terminal (Ds_Merchant_Terminal)**     | ID del terminal virtual (normalmente "001")               |
| **Clave secreta (SHA-256)**                       | Para firmar y verificar transacciones con HMAC-SHA256     |
| **Acceso a canales.redsys.es**                    | Usuario y contraseña para configurar URLs de notificación |
| **Credenciales de entorno de TEST**               | Para pruebas en sandbox antes de producción               |

> El banco proporcionará primero credenciales de TEST y, tras validar la integración, las de PRODUCCIÓN.

---

## Flujo de pago propuesto

```
Cliente selecciona asientos → Formulario datos cliente (nombre, email, teléfono)
    → Server Action: crea reserva PENDING + genera formulario Redsys firmado
    → Auto-redirect a pasarela Redsys (página del banco)
    → Cliente introduce datos de tarjeta en Redsys
    → Redsys envía notificación POST a /api/payments/notify (webhook)
        → Verificar firma HMAC-SHA256
        → Si OK: actualizar reserva a CONFIRMED + paymentStatus COMPLETED
        → Si KO: actualizar reserva a CANCELLED + paymentStatus FAILED + liberar asientos
    → Redsys redirige al cliente a:
        → /reserva/confirmacion/[id] (éxito) → muestra resumen + descarga PDF
        → /reserva/error (fallo) → mensaje de error + opción de reintentar
```

---

## Paso 1: Instalar dependencia

```bash
npm install redsys-easy
```

Paquete más popular (~2000 descargas semanales), soporta redirect y REST, incluye utilidades para firmas HMAC-SHA256.

---

## Paso 2: Configuración Redsys

**Crear:** `src/lib/redsys.ts`

Instancia de `redsys-easy` con la clave secreta y URLs de sandbox/producción según `NODE_ENV`.

**Actualizar:** `.env`

```
REDSYS_MERCHANT_CODE=999008881
REDSYS_TERMINAL=1
REDSYS_SECRET_KEY=sq7HjrUOBfKmC576ILgskD5srU870gJ7
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

## Paso 3: Actualizar tipos de pagos

**Archivo:** `src/modules/payments/types/index.ts`

Actualizar los tipos existentes para alinear con `redsys-easy` y el nuevo flujo (formulario de redirección, datos del cliente, resultado del webhook).

---

## Paso 4: Crear acciones de pago

**Crear:** `src/modules/payments/actions/index.ts`

Server actions:
- **`initializePayment(data)`**: Crea reserva con status PENDING, genera formulario Redsys firmado con `createRedirectForm()`, devuelve los 3 campos ocultos + URL del formulario.
- **`getReservationForConfirmation(id)`**: Obtiene datos de reserva confirmada para la página de éxito.

---

## Paso 5: Crear webhook de notificación

**Crear:** `src/app/api/payments/notify/route.ts`

Endpoint POST que:
1. Recibe `Ds_SignatureVersion`, `Ds_MerchantParameters`, `Ds_Signature`
2. Verifica firma con `processRedirectNotification()` de redsys-easy
3. Extrae `orderId` (= reservationId) y código de respuesta
4. Si pago OK (código 0000-0099): actualiza reserva a CONFIRMED + COMPLETED
5. Si pago KO: actualiza reserva a CANCELLED + FAILED, libera asientos (SeatStatus → AVAILABLE)
6. Devuelve HTTP 200 (obligatorio para Redsys)

---

## Paso 6: Modificar flujo de reserva pública

**Archivo:** `src/app/eventos/[id]/client.tsx`

Cambios:
1. Añadir paso intermedio: formulario de datos del cliente (nombre, email, teléfono) después de seleccionar asientos
2. Al confirmar, llamar a `initializePayment()` en vez de `createReservation()`
3. Recibir los datos del formulario Redsys y hacer auto-submit (redirect a la pasarela)
4. Eliminar la generación de PDF inmediata (se mueve a la página de confirmación)

---

## Paso 7: Crear páginas post-pago

**Crear:** `src/app/reserva/confirmacion/[id]/page.tsx`

Página de éxito post-pago:
- Verificar que la reserva existe y está CONFIRMED
- Mostrar resumen: equipos, fecha, asientos, precio total
- Botón "Descargar ticket" que genera el PDF (reutilizar lógica existente de jsPDF)
- Mensaje de agradecimiento

**Crear:** `src/app/reserva/error/page.tsx`

Página de error post-pago:
- Mensaje de que el pago ha fallado
- Botón para volver a intentar (link al evento)
- Información de contacto del bar

---

## Paso 8: Actualizar createReservation

**Archivo:** `src/modules/reservations/actions/index.ts`

Modificar `createReservation()`:
- Aceptar datos del cliente (nombre, email, teléfono) en vez de hardcoded
- Crear con `status: "PENDING"` y `paymentStatus: "PENDING"`
- Marcar asientos como `RESERVED` (no OCCUPIED) hasta confirmar pago
- Nuevo método `confirmReservation(id)`: cambia a CONFIRMED + OCCUPIED
- Nuevo método `cancelReservation(id)`: cambia a CANCELLED + libera asientos

---

## Paso 9: Cron de limpieza de reservas expiradas

**Actualizar:** `src/app/api/cron/cleanup/route.ts`

Añadir lógica para limpiar reservas PENDING con más de 30 minutos (timeout de pago):
- Cambiar status a EXPIRED
- Liberar asientos (RESERVED → AVAILABLE)

---

## Archivos a crear (5)

|                    Archivo                   |             Descripción              |
|----------------------------------------------|--------------------------------------|
| `src/lib/redsys.ts`                          | Instancia configurada de redsys-easy |
| `src/modules/payments/actions/index.ts`      | Server actions de pago               |
| `src/app/api/payments/notify/route.ts`       | Webhook de notificación Redsys       |
| `src/app/reserva/confirmacion/[id]/page.tsx` | Página de éxito post-pago            |
| `src/app/reserva/error/page.tsx`             | Página de error post-pago            |

## Archivos a modificar (4)

|                   Archivo                   |                     Cambio                      |
|---------------------------------------------|-------------------------------------------------|
| `src/modules/payments/types/index.ts`       | Actualizar tipos para redsys-easy               |
| `src/modules/reservations/actions/index.ts` | Flujo PENDING → CONFIRMED, datos cliente reales |
| `src/app/eventos/[id]/client.tsx`           | Formulario cliente + redirect a Redsys          |
| `src/app/api/cron/cleanup/route.ts`         | Limpiar reservas PENDING expiradas              |

---

## Verificación

1. Configurar credenciales de TEST en `.env`
2. Seleccionar asientos → rellenar datos → verificar redirect a sandbox Redsys
3. Usar tarjeta de test (4548 8120 4940 0004, CVV 123, fecha futura) → pago OK
4. Verificar webhook recibido → reserva CONFIRMED en Prisma Studio
5. Verificar página de confirmación con descarga de PDF
6. Probar pago fallido → verificar página de error y asientos liberados
7. Probar expiración: crear reserva, esperar 30min (o forzar), verificar limpieza cron
