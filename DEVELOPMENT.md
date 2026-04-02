# Desarrollo - The Lounge Beerhouse

## Estado Actual del Proyecto

**Última actualización:** 2 de Abril de 2026

Aplicación web para gestionar reservas de asientos en un bar deportivo (The Lounge Beerhouse) en Valencia. Los clientes reservan asientos para ver eventos deportivos; los administradores gestionan eventos, reservas, asientos y usuarios.

---

## Funcionalidades Implementadas

### 1. Sistema de Autenticación
- Login con email y contraseña (bcryptjs)
- Sesiones con iron-session (cookies seguras)
- Roles: `ADMIN` y `WORKER`
- Control de acceso basado en roles en middleware
- Sesiones legacy: si el rol no está en la cookie, se recupera de BD automáticamente

### 2. Gestión de Eventos
- CRUD completo de eventos deportivos
- Selección de equipos (local/visitante) con logos y filtrado por competición
- Configuración de pantallas (PROYECTOR, TV1, TV2)
- **Precio por asiento configurable** (10€, 15€, 20€, 25€, 30€) — por defecto 10€
- Estados: UPCOMING, LIVE, FINISHED, CANCELLED
- Integración con football-data.org para crear eventos desde partidos reales
- Escudo de competición en tarjetas con `CompetitionEmblem` (maneja errores de carga)

### 3. Integración football-data.org
- Sync automático de equipos desde 12 competiciones del free tier (cron diario a las 4:00)
- Página de sugerencias de partidos (`/admin/eventos/sugerencias`) para crear eventos desde la API
- Emblemas de competición cargados desde `crests.football-data.org`
- Rate limiting en `api-client.ts` para respetar el límite de 10 req/min del free tier

### 4. Vista Pública de Cliente
- Página principal (`/`) con listado de eventos próximos
- **Banner informativo** bilingüe (español/inglés según idioma del navegador): "Las reservas se desbloquean 48h antes del evento"
- **Ventana de reservas**: disponible entre 48h y 5h antes del evento
  - Más de 48h: tarjeta bloqueada con icono de reloj, tooltip explicativo
  - Menos de 5h: tarjeta bloqueada con icono de candado, tooltip explicativo
- Tooltip bilingüe según idioma del navegador
- **Modal de condiciones de reserva** al entrar en la vista de asientos (bilingüe)
- Contacto por WhatsApp sticky en la parte inferior

### 5. Reserva de Asientos con Pasarela de Pago (Público)

#### Flujo completo implementado con Redsys (modo redirección):
```
Cliente selecciona asientos → RESERVAR
  → Reserva PENDING creada, asientos marcados RESERVED
  → Auto-redirect a pasarela Redsys (sandbox o producción)
  → Cliente introduce datos de tarjeta en página del banco
  → Redsys notifica al webhook POST /api/payments/notify
      → Pago OK: reserva → CONFIRMED, asientos → OCCUPIED
      → Pago KO: reserva → CANCELLED, asientos → AVAILABLE
  → Redsys redirige al cliente a:
      → /reserva/confirmacion/[orderId] → resumen + descarga ticket PDF
      → /reserva/error → mensaje de error + botón para reintentar
```

#### Detalles técnicos:
- Librería `redsys-easy` para firma HMAC-SHA256 y construcción del formulario
- Credenciales de sandbox en `.env` (públicas de Redsys); cambio a producción = 3 variables
- `orderId` = últimos 12 dígitos de `Date.now()` (válido para Redsys: 4-12 chars, empieza por dígitos)
- Almacenado en `Reservation.paymentId` para relacionar webhook y reserva
- Mapa interactivo del bar con posiciones reales de los asientos
- Asientos: verde=disponible, azul=seleccionado, rojo=ocupado/bloqueado
- Precio total calculado en tiempo real según `event.pricePerSeat`
- Sin recogida de datos personales del cliente (flujo anónimo)

#### Robustez en desarrollo local (webhook no accesible):
- La página de confirmación llama a `confirmReservationByOrderId()` al cargar
- La página de error llama a `cancelReservationByOrderId()` al cargar
- Ambas funciones son idempotentes: si el webhook ya actuó, son no-ops
- En producción el webhook es la fuente autoritativa; las páginas actúan como fallback

#### Ticket PDF (página de confirmación):
- Datos del evento, asientos, precio total
- **Código QR** que enlaza a `/admin/reservas/[eventId]/[reservationId]` para verificación por el personal
- Generado client-side con jsPDF + qrcode (importación dinámica)

### 6. Panel de Administración

#### Administrar Reservas (`/admin/reservas`)
- Lista de eventos próximos y pasados (últimos 35 días) con contador de reservas **CONFIRMED**
- Acordeón de eventos pasados
- Acordeón de Informes (solo ADMIN): generación de PDFs mensuales

#### Detalle de Reservas por Evento (`/admin/reservas/[id]`)
- Listado de reservas **CONFIRMED** con código de asientos y precio
- **Botón "Bloquear asientos"** → navega a la vista de bloqueo

#### Bloqueo de Asientos (`/admin/reservas/[id]/bloquear`)
- Plano interactivo del bar para bloquear/desbloquear asientos
- Verde=disponible, gris=bloqueado, rojo=ocupado por reserva
- Los bloqueados no generan reserva pero aparecen como ocupados (rojo) al cliente
- Los bloqueados aparecen como gris en vistas de admin

#### Detalle de Reserva (`/admin/reservas/[id]/[reservationId]`)
- Vista completa de una reserva con plano del bar (asientos destacados en dorado)
- Precio total desde `reservation.totalPrice` (BD), no recalculado

### 7. Gestión de Usuarios
- CRUD de administradores (ADMIN y WORKER)
- Validación de contraseña (mínimo 8 caracteres)
- Toggle de visibilidad de contraseña
- Modal de confirmación al eliminar

### 8. Editor de Asientos
- Drag & drop para posicionar asientos en el mapa
- Configuración de etiquetas de zona (posición, escala, rotación)
- Cambios persistidos en BD (modelo ZoneLabel)

### 9. Infraestructura
- Cron job `/api/cron/cleanup` (3:00 AM diario):
  - Elimina eventos > 90 días
  - **Expira reservas PENDING > 30 minutos** y libera sus asientos
- Cron job `/api/cron/sync-teams`: sincroniza equipos desde la API (4:00 AM diario)
- `vercel.json` configurado para ambos cron jobs

---

## Roles y Permisos

| Funcionalidad | ADMIN | WORKER |
|---|---|---|
| Configurar eventos | ✅ | ❌ |
| Administrar reservas | ✅ | ✅ |
| Bloquear asientos | ✅ | ✅ |
| Ver informes PDF | ✅ | ❌ |
| Configurar asientos | ✅ | ❌ |
| Administrar usuarios | ✅ | ❌ |

---

## Modelo de Datos — Campos Relevantes

### Event
- `pricePerSeat Int @default(10)` — precio por asiento en euros, editable por evento

### SeatStatus
- `status`: AVAILABLE | RESERVED | OCCUPIED | **BLOCKED**
- RESERVED: asiento en proceso de pago (reserva PENDING)
- OCCUPIED: asiento de reserva confirmada
- BLOCKED: bloqueado por admin, aparece como rojo al cliente, gris al admin

### Reservation
- `status`: PENDING → CONFIRMED | CANCELLED | EXPIRED
- `paymentStatus`: PENDING → COMPLETED | FAILED
- `paymentId`: almacena el `orderId` de Redsys (12 dígitos) para relacionar webhook con reserva
- `customerName/Email` hardcodeados ("Cliente") — flujo anónimo sin datos personales
- `totalPrice` almacenado en BD al crear la reserva (usar `Number(reservation.totalPrice)` al mostrar)

---

## Pendiente de Implementar

### Alta Prioridad (antes de producción)
- [ ] **Migración a PostgreSQL** → ver `MIGRACION_SUPABASE.md`
- [ ] **Credenciales Redsys reales** del banco (sustituir 3 vars de entorno)
- [ ] **Caducidad de sesión admin** (iron-session ttl + aviso de expiración)
- [ ] **Despliegue en Vercel**

### Media Prioridad
- [ ] Cierre automático de reservas 2h antes del evento
- [ ] Notificaciones por email al cerrar reservas (Resend)
- [ ] Renombrar/crear/eliminar asientos desde el editor

### Baja Prioridad
- [ ] Suite de tests (Vitest + Playwright)
- [ ] Base de datos completa de equipos y selecciones nacionales
- [ ] Opción de crear equipo personalizado desde el formulario de evento

---

## Problemas Conocidos

1. **Prisma + Windows**: el `.dll.node` se bloquea mientras corre el servidor. Detener dev server antes de `npx prisma generate` o `npx prisma db push`.

2. **Decimal de Prisma**: `reservation.totalPrice` es tipo `Decimal`. Siempre convertir con `Number()` antes de usarlo en el cliente.

3. **Navegación post-action**: usar `window.location.href` para navegación fiable tras server actions en algunos flujos.

4. **Webhook Redsys en local**: Redsys no puede llamar a `localhost`. El fallback está implementado: la página de confirmación/error confirma o cancela directamente al cargar. En producción (Vercel) el webhook funciona normalmente.

5. **Errores CSS/JS en sandbox Redsys**: el sandbox intenta cargar recursos de personalización específicos del comercio (`999008881`) que no existen. Son errores cosméticos; el formulario de pago funciona igualmente.

---

## Variables de Entorno

```env
# Base de datos
DATABASE_URL="..."              # Pooler Supabase (producción) o file:./dev.db (desarrollo)
DIRECT_URL="..."                # Solo para migraciones Prisma (producción)

# Autenticación
AUTH_SECRET="..."               # Secreto para iron-session

# Cron jobs
CRON_SECRET="..."               # Header de autorización para endpoints cron

# Football-data.org
FOOTBALL_DATA_API_KEY="..."

# Redsys — sandbox (credenciales públicas de prueba)
REDSYS_MERCHANT_CODE="999008881"
REDSYS_TERMINAL="001"
REDSYS_SECRET_KEY="sq7HjrUOBfKmC576ILgskD5srU870gJ7"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Redsys — producción (sustituir al poner en producción)
# REDSYS_MERCHANT_CODE="TU_CODIGO_REAL"
# REDSYS_SECRET_KEY="TU_CLAVE_REAL"
# NEXT_PUBLIC_BASE_URL="https://tu-dominio.com"
```

---

## Tarjeta de prueba Redsys (sandbox)

| Campo | Valor |
|---|---|
| Número | `4548 8120 4940 0004` |
| Caducidad | Cualquier fecha futura (ej: `12/26`) |
| CVV | `123` |

---

## Comandos Útiles

```bash
# Desarrollo
npm run dev

# Base de datos
npx prisma db push           # Sincronizar schema (dev)
npx prisma migrate dev       # Crear migración (producción)
npx prisma generate          # Regenerar cliente
npm run db:seed              # Seed: 47 asientos + usuario admin
npm run db:studio            # Explorar BD en navegador

# Build
npm run build
npm run start
```
