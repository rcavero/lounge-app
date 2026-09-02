# Email de confirmación con ticket PDF adjunto

## Contexto

Hoy el ticket PDF **solo existe si el cliente pulsa "Continuar"** en la pantalla
"Operación autorizada" de Redsys: esa acción es la que le devuelve a
`/reserva/confirmacion/[orderId]`, y es esa página la que genera el PDF en el navegador
(`src/app/reserva/confirmacion/[orderId]/client.tsx:25-191`). Los clientes que cierran la pestaña
en la pasarela han pagado y tienen la reserva confirmada por el webhook, pero llegan al bar sin
ticket, y las camareras tienen que resolverlo a mano.

La solución es desacoplar la entrega del ticket del navegador del cliente: **cuando el webhook de
Redsys confirma el pago, el servidor genera el PDF y lo envía por email**. Eso obliga a capturar el
email del cliente antes de ir a la pasarela — hoy no se pide nada y se guarda el placeholder
`"cliente@lounge.com"` (`src/modules/payments/actions/index.ts:94-95`).

Decisiones ya tomadas: email obligatorio + nombre opcional, capturados en un modal al pulsar
RESERVAR; token público para no exponer datos personales en una URL enumerable. El proveedor de
correo (Gmail del bar vs. Resend) **está pendiente de confirmar con la dueña**, así que el diseño lo
deja como configuración, no como código.

---

## Punto clave de arquitectura: SMTP genérico, no SDK de proveedor

Se usa **`nodemailer` sobre SMTP**, no el SDK de Resend. Con eso la decisión pendiente deja de ser
bloqueante: las mismas variables de entorno sirven para todos los destinos posibles, sin tocar una
línea de código.

| Proveedor | `SMTP_HOST` | `SMTP_PORT` | `SMTP_USER` | `SMTP_PASS` |
|---|---|---|---|---|
| Gmail / Workspace del bar | `smtp.gmail.com` | `465` | la cuenta completa | **contraseña de aplicación** (exige 2FA activo) |
| Resend | `smtp.resend.com` | `465` | `resend` | la API key |
| Brevo / Mailjet / otros | el de su panel | `465`/`587` | usuario SMTP | clave SMTP |

Con Gmail, `MAIL_FROM` **debe ser la propia cuenta** (o un alias verificado) o Google reescribe el
remitente. Límite ~500 destinatarios/día en Gmail gratuito, 2.000 en Workspace: sobrado para el
volumen actual (325 reservas históricas). El adjunto pesa ~15-25 KB.

---

## 1. Esquema de base de datos

`prisma/schema.prisma`, modelo `Reservation` — cuatro columnas, todas nullable o con default, así
que la migración es aditiva y segura sobre las 325 reservas de producción:

```prisma
publicToken         String?   @unique   // token aleatorio de la URL pública del ticket
ticketEmailSentAt   DateTime?           // sello de envío; hace de cerrojo de idempotencia
ticketEmailAttempts Int       @default(0)
ticketEmailError    String?             // último error, para diagnóstico y reintento
```

> ⚠️ **`.env` apunta a PRODUCCIÓN.** Antes de cualquier `prisma migrate`:
> `set -a && . ./.env.testing && set +a` y confirmar con `npx tsx scripts/db-whoami.ts`.
> En producción, `prisma migrate deploy` tras el merge a `main`.

---

## 2. Captura del email (modal al pulsar RESERVAR)

**`src/app/eventos/[id]/client.tsx`** — `handleReserve` (líneas 60-98) deja de llamar a
`initializePayment` directamente: ahora abre un modal. El modal reutiliza exactamente el markup del
modal de CONDICIONES ya existente (líneas 145-179) — mismo `bg-[#1a1a1a] rounded-2xl border-white/10`
y el `Button` dorado — y es bilingüe con el `isSpanish` que ya calcula el componente (línea 52-54).

```
┌──────────────────────────────┐
│   CONFIRMAR RESERVA          │
│                              │
│  2 asientos · 20,00€         │
│                              │
│  Email *                     │
│  ┌────────────────────────┐  │
│  │ tu@email.com           │  │
│  └────────────────────────┘  │
│  Solo lo usamos para         │
│  enviarte el ticket.         │
│                              │
│  [    IR AL PAGO    ]        │
└──────────────────────────────┘
```

- Estado local (`useState`), no el store de Zustand: el email es de un solo uso y no debe quedar
  vivo al navegar. Nota: `customerName/customerEmail/customerPhone` + `setCustomerInfo` en
  `src/shared/hooks/use-reservation-store.ts` son código muerto que nadie invoca — dejarlos o
  limpiarlos en un commit aparte.
- Campos: `email` (obligatorio, `type="email"` `inputMode="email"` `autoComplete="email"`),
  `nombre` (opcional). Resumen de asientos y total en la cabecera del modal.
- Precarga desde `localStorage["lounge:customerEmail"]` y lo guarda al enviar — el bar tiene
  clientes recurrentes.
- Aviso RGPD bajo el campo: *"Solo lo usamos para enviarte la confirmación y el ticket."*
- Validación en cliente (regex + campo requerido) **y** en servidor: no se confía en el cliente.

**`src/modules/payments/actions/index.ts`** — `initializePayment` pasa a
`{ eventId, seatIds, customerEmail, customerName? }`:

- Normaliza (`trim`, `toLowerCase`) y valida el email al principio, junto a la guarda de
  `seatIds.length === 0` (línea 24); devuelve `{ success: false, error }` con el patrón ya usado.
- Sustituye los placeholders de las líneas 94-95 por los datos reales
  (`customerName: nombre?.trim() || "Cliente"`).
- Genera `publicToken` (`crypto.randomUUID()`) antes de crear la reserva y lo guarda.
- `okUrl` (línea 114) pasa a `${BASE_URL}/reserva/confirmacion/${orderId}?t=${publicToken}`
  (holgado dentro del límite de 250 caracteres de `DS_MERCHANT_URLOK`).

El flujo admin `createReservation` (`src/modules/reservations/actions/index.ts:122-123`) tiene los
mismos placeholders; queda fuera de alcance, no envía emails.

---

## 3. Generación del ticket PDF compartida cliente/servidor

**Nuevo `src/modules/payments/lib/ticket-pdf.ts`**:

```ts
export async function buildTicketPdf(
  reservation: ReservationTicketData,
  options: { baseUrl: string }
): Promise<Uint8Array>
```

Es el bloque de `client.tsx:25-178` movido tal cual, con tres cambios:

1. `window.location.origin` → `options.baseUrl` (el QR sigue apuntando a
   `/admin/reservas/{eventId}/{id}`, que es la vista que escanea el personal).
2. `doc.save()` → `new Uint8Array(doc.output("arraybuffer"))`.
3. Dos líneas nuevas de contenido: nombre y email del cliente.
   **Hay que subir la constante de altura** `ticketHeight = 98 + seatsHeight + qrSize` (línea 43) en
   ~9 mm o el contenido se sale del lienzo — es el detalle más fácil de olvidar de todo el plan.

Los `await import("jspdf")` / `await import("qrcode")` dinámicos se mantienen: en cliente evitan
cargarlos en el bundle inicial y en servidor son requires normales.

`handleDownloadTicket` en `client.tsx` queda reducido a llamar a `buildTicketPdf` y volcar el
`Uint8Array` a un `Blob` + `URL.createObjectURL`. **Una sola definición del ticket** para la descarga
y para el adjunto: si divergen, el cliente y el bar acaban con documentos distintos.

`ReservationTicketData` (`src/modules/payments/types/index.ts:12-22`) gana `customerName` y
`customerEmail`. La consulta de `getReservationByOrderId` usa `include`, así que ya trae ambos
escalares — solo hay que añadirlos al `return` (líneas 217-230). Extraer esa consulta a
`src/modules/payments/lib/ticket-data.ts` para que la reutilicen la action pública y el mailer sin
duplicarla.

---

## 4. Módulo de notificaciones

**Nuevo `src/modules/notifications/`:**

- **`lib/mailer.ts`** — envoltorio fino sobre `nodemailer`: transporter singleton perezoso,
  `isMailerConfigured()` y `sendMail({ to, subject, html, text, attachments })`. Si faltan las
  variables SMTP **registra un aviso y no lanza**, para que local y los previews sigan funcionando
  sin credenciales.
- **`templates/reservation-confirmation.ts`** — `renderReservationEmail(data)` devolviendo
  `{ subject, html, text }`. Plantilla con literales de plantilla y estilos inline, sin dependencias
  ni imágenes externas. Contenido: partido, fecha/hora, asientos, total, enlace al ticket web
  (`/reserva/confirmacion/{orderId}?t={token}`), el aviso de **guardar el ticket y mostrarlo en el
  local** y las condiciones de reserva (los mismos textos del modal), dirección y el WhatsApp
  `+34 640 87 34 44` que ya usan `processing-client.tsx` y `reserva/error/page.tsx`.
- **`lib/reservation-confirmation.ts`** — `sendReservationConfirmationEmail(reservationId)`:

  1. **Reclama el envío de forma atómica** (esto es lo que impide duplicados):
     ```ts
     const claim = await prisma.reservation.updateMany({
       where: { id, status: "CONFIRMED", ticketEmailSentAt: null },
       data: { ticketEmailSentAt: new Date(), ticketEmailAttempts: { increment: 1 } },
     });
     if (claim.count === 0) return { sent: false, reason: "already-claimed" };
     ```
  2. Carga los datos con el helper de `ticket-data.ts`.
  3. Se salta las reservas con el email heredado `cliente@lounge.com` o vacío.
  4. `buildTicketPdf(...)` → adjunto `ticket-{id}.pdf`.
  5. `sendMail(...)`.
  6. **Si falla: revierte `ticketEmailSentAt` a `null`** y guarda `ticketEmailError`, para que el
     barrido del cron y el botón de admin puedan reintentar.

---

## 5. Dónde se dispara

| Punto | Fichero | Cómo |
|---|---|---|
| **Webhook (principal, producción)** | `src/app/api/payments/notify/route.ts`, rama de éxito (~línea 57) | `after(() => sendReservationConfirmationEmail(reservation.id))` importando `after` de `next/server` |
| Sandbox / local | `confirmReservationByOrderId`, `payments/actions/index.ts:141-167` | `await` tras la transacción |
| Red de seguridad en pantalla | `reserva/confirmacion/[orderId]/page.tsx`, cuando ya está `CONFIRMED` | `after(...)`, idempotente |
| Red de seguridad diferida | `src/app/api/cron/cleanup/route.ts` | barrido de `CONFIRMED` + `ticketEmailSentAt: null` + `ticketEmailAttempts < 3` + `confirmedAt` de los últimos 7 días, tope ~25 por ejecución |

`after()` es la pieza importante del webhook: Redsys recibe su `200 OK` de inmediato y el PDF + SMTP
(1-3 s) se ejecutan después de la respuesta. Con un `await` normal se arriesgan reintentos de Redsys
por timeout. El barrido va **dentro del cron de cleanup que ya existe**, sin tocar `vercel.json`
(el plan Hobby de Vercel solo admite 2 crons y los dos están usados).

### Arreglo incluido en el mismo sitio

El webhook (`notify/route.ts:25-75`) busca la reserva **sin filtrar por estado**. Un KO tardío
degrada a `CANCELLED` una reserva ya `CONFIRMED`, y como el `updateMany` de liberación filtra por
`seatId + eventId` en vez de por `reservationId` (línea 69), puede liberar asientos que ya haya
cogido otra reserva. Con el email de por medio esto pasa de ser un bug latente a mandar un ticket de
una reserva que luego se cancela sola, así que entra en el alcance: añadir la guarda de estado en la
rama KO y filtrar la liberación por `reservationId`.

---

## 6. Token público

`/reserva/confirmacion/[orderId]/page.tsx` lee `searchParams.t`:

- Token correcto → vista completa (incluye nombre y email).
- Sin token o token incorrecto → la misma página **sin datos personales** (partido, asientos y total;
  el PDF descargable, sin la línea de cliente).
- Las 325 reservas históricas tienen `publicToken = null` y caen en el segundo caso, que es el
  comportamiento actual: nada se rompe.

---

## 7. Vistas de administración

- **`/admin/reservas/[id]/page.tsx`** (tarjetas, líneas 127-170): el email bajo los códigos de
  asiento y el nombre en la esquina donde hoy va el ID truncado. Distintivo ⚠ cuando
  `ticketEmailSentAt` es `null`, para que el personal detecte de un vistazo los envíos fallidos.
- **`/admin/reservas/[id]/[reservationId]/page.tsx`**: bloque "Contacto" replicando el patrón
  `border-t border-white/10 pt-3` de la tarjeta resumen (líneas 118-147), con nombre, email como
  `mailto:`, estado del envío y **botón "Reenviar ticket"**.
- **Nueva action** `resendReservationTicket(reservationId)` en
  `src/modules/reservations/actions/index.ts`, con el `requireAuth()` que ya usan todas las de ese
  fichero: limpia `ticketEmailSentAt`/`ticketEmailError`, llama al remitente y hace `revalidatePath`.

Ambas consultas (`getEventWithReservations`, `getReservationWithSeats`) usan `include` sin `select`,
así que **`customerEmail` ya llega a los componentes**: no hay que tocar Prisma, solo pintar.

El informe mensual en PDF (`admin/reservas/client.tsx:29-176`) queda **fuera de alcance**: es un
documento contable de tres columnas fijas y meter el email obligaría a rehacer la maquetación.

---

## 8. Configuración

`.env.example` documenta las nuevas variables; en Vercel se añaden a los scopes **Production** y
**Preview**:

```
SMTP_HOST=""
SMTP_PORT="465"
SMTP_USER=""
SMTP_PASS=""
MAIL_FROM="The Lounge Beerhouse <reservas@ejemplo.com>"
MAIL_REPLY_TO=""
MAIL_BCC=""          # opcional: copia oculta al bar
```

Dependencia nueva: `nodemailer` + `@types/nodemailer`.

---

## Verificación

1. **Primero de todo — spike de jsPDF en Node.** `scripts/spike-ticket-pdf.ts` que llame a
   `buildTicketPdf` con datos falsos y escriba el PDF al scratchpad; abrirlo y comprobar que el QR
   se ve y que nada se sale del lienzo. jsPDF 2.5.2 funciona en Node para lo que usamos (texto,
   líneas, `addImage` con PNG data-URL), pero **conviene confirmarlo antes de escribir el resto**;
   si fallara, el sustituto es `pdf-lib`.
2. Migración contra `.env.testing` tras `npx tsx scripts/db-whoami.ts`.
3. **Local (`npm run dev`, sandbox):** reservar → modal → tarjeta de prueba → pantalla OK. El
   webhook no llega a localhost, así que dispara `confirmReservationByOrderId`. Comprobar el email
   real en la bandeja de entrada, con adjunto que abre bien.
4. **Prueba de aceptación, en el deployment `testing` (Preview, URL pública, Redsys sandbox):**
   pagar y **cerrar la pestaña en "Operación autorizada" sin pulsar Continuar**. El email debe
   llegar igual. Esto es exactamente el caso que motiva todo el trabajo y solo se puede reproducir
   con webhook real.
5. **Idempotencia:** repetir el flujo y luego lanzar el cron a mano —
   `curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/cleanup` — y verificar que
   llega **un solo** email por reserva.
6. **Token:** abrir `/reserva/confirmacion/<orderId>` sin `?t=` (no debe aparecer ningún dato
   personal) y con el token correcto (vista completa).
7. **Reintento:** poner un `SMTP_PASS` inválido, pagar, comprobar que la reserva queda con
   `ticketEmailSentAt = null` y `ticketEmailError` relleno, corregir la clave y reenviar desde el
   botón de admin.
8. Admin: listado con email y distintivo ⚠, detalle con bloque Contacto, botón Reenviar.
9. `npm run build` y merge `testing` → `main`; en producción, `prisma migrate deploy` + variables
   SMTP en el scope Production.

---

## Alternativas y mejoras propuestas

**Que atacan la causa raíz, sin código:**

- **Pedir a CaixaBank la redirección automática a la URL OK.** Muchos terminales Redsys permiten
  configurar en el Módulo de Administración que el cliente vuelva solo al comercio en lugar de tener
  que pulsar "Continuar". Merece una llamada al banco: si su terminal lo admite, elimina el problema
  de origen sin tocar nada. El email sigue mereciendo la pena igualmente, porque también cubre al
  cliente que pierde el PDF o cambia de móvil.

**Extras baratos sobre este mismo trabajo:**

- **`MAIL_BCC` al correo del bar**: el personal recibe cada reserva en tiempo real, sin abrir el
  panel. Una variable de entorno, cero código adicional.
- **Recordatorio unas horas antes del evento** reutilizando el mismo mailer y plantilla — encaja con
  el punto "Envío de resumen de reservas al cerrar" que ya está en `TODO.md:13`.

**Deuda técnica detectada de paso (fuera de alcance salvo que quieras incluirla):**

- `generateOrderId()` es `Date.now()` recortado y `paymentId` no tiene `@unique`: dos pagos en el
  mismo milisegundo colisionan. Un sufijo aleatorio y un índice único lo cierran.
- `cancelReservationByOrderId` nunca rellena `cancelledAt`, que sí existe en el esquema.
- En `api/cron/cleanup/route.ts:16` la variable `thirtyMinutesAgo` vale en realidad 5 minutos: el
  comportamiento es el correcto y documentado, el nombre no.
- El QR del ticket apunta a `/admin/reservas/...`, que solo abre si la camarera tiene sesión. Una
  vista de check-in dedicada por token sería más cómoda para el personal.
