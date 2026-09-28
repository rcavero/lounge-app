# Guía de Arquitectura para Claude Code

## Resumen del Proyecto

**The Lounge Beerhouse** es una aplicación web para gestionar reservas de asientos en un bar deportivo. Desarrollada con Next.js 16 (App Router), Prisma ORM y PostgreSQL (Supabase).

---

## Stack Tecnológico

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Next.js | 16.1.5 | Framework React con App Router |
| React | 19.2.3 | UI Library |
| TypeScript | 5.x | Tipado estático |
| Prisma | 6.19.2 | ORM para base de datos |
| PostgreSQL (Supabase) | - | Testing y producción en Supabase; local y tests en Docker. Un `.env*` por base, con `DB_ENV`: ver `docs/entornos.md` |
| qrcode | 1.5.x | Generación de QR codes en cliente |
| redsys-easy | - | Integración pasarela de pago Redsys (firma HMAC-SHA256) |
| Tailwind CSS | 4.x | Estilos |
| iron-session | 8.x | Manejo de sesiones |
| jsPDF | 2.5.2 | Generación de PDFs |
| Lucide React | 0.563.0 | Iconos |
| date-fns | 4.1.0 | Manipulación de fechas |
| bcryptjs | 3.x | Hash de contraseñas |
| Zustand | 5.x | Estado global (reservado para uso futuro) |
| Radix UI | - | Primitivas de UI (Dialog, Separator, Slot) |
| class-variance-authority | 0.7.1 | Variantes de componentes |

---

## Estructura de Directorios

```
lounge-app/
├── prisma/
│   ├── schema.prisma      # Esquema de base de datos
│   ├── seed.ts            # Script de seed (omite los asientos si ya hay filas)
│   └── migrations/        # Migraciones de Prisma
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Layout raíz
│   │   ├── (inicio)/               # Grupo sin URL: la portada y su skeleton
│   │   │   ├── page.tsx            # Página principal pública
│   │   │   └── loading.tsx         # Skeleton de la portada (solo de ella: ver el propio fichero)
│   │   ├── globals.css             # Estilos globales
│   │   ├── admin/
│   │   │   ├── (dashboard)/        # Grupo de rutas protegidas
│   │   │   │   ├── layout.tsx      # Layout con verificación de sesión
│   │   │   │   ├── page.tsx        # Dashboard principal
│   │   │   │   ├── components/     # Componentes del dashboard
│   │   │   │   │   └── admin-header.tsx
│   │   │   │   ├── eventos/        # CRUD de eventos
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── nuevo/      # Crear evento
│   │   │   │   │   ├── [id]/       # Editar evento
│   │   │   │   │   └── sugerencias/ # Sugerencias de partidos (API)
│   │   │   │   │       ├── page.tsx, client.tsx
│   │   │   │   ├── reservas/       # Gestión de reservas
│   │   │   │   │   ├── page.tsx, client.tsx
│   │   │   │   │   └── [id]/       # Reservas por evento
│   │   │   │   │       ├── page.tsx            # Listado de reservas + botón bloquear
│   │   │   │   │       ├── bloquear/           # Bloqueo de asientos por evento
│   │   │   │   │       │   ├── page.tsx, client.tsx
│   │   │   │   │       └── [reservationId]/    # Detalle reserva
│   │   │   │   ├── asientos/       # Editor de asientos
│   │   │   │   │   ├── page.tsx, client.tsx
│   │   │   │   └── usuarios/       # Gestión de usuarios
│   │   │   │       ├── page.tsx, user-form.tsx
│   │   │   │       ├── nuevo/      # Crear usuario
│   │   │   │       └── [id]/       # Editar usuario
│   │   │   └── login/              # Página de login (pública)
│   │   │       ├── page.tsx, client.tsx
│   │   ├── eventos/[id]/           # Vista pública de evento (selección de asientos + pago) + loading.tsx
│   │   ├── reserva/
│   │   │   ├── confirmacion/[orderId]/ # Página de éxito post-pago
│   │   │   │   ├── page.tsx, client.tsx
│   │   │   └── error/              # Página de error post-pago (cancela reserva al cargar)
│   │   │       └── page.tsx
│   │   └── api/
│   │       ├── payments/
│   │       │   ├── notify/         # Webhook POST de notificación Redsys
│   │       │   │   └── route.ts
│   │       │   └── return/[orderId]/ # URLOK/URLKO: acepta GET y POST, 303. Ver punto 11
│   │       │       └── route.ts
│   │       └── cron/
│   │           ├── cleanup/        # Limpieza de eventos + expiración de reservas PENDING
│   │           │   └── route.ts
│   │           └── sync-teams/     # Sync equipos desde la API de ESPN
│   │               └── route.ts
│   │
│   ├── middleware.ts               # Middleware de Next.js
│   │
│   ├── components/
│   │   └── ui/                     # Componentes reutilizables (Radix-based)
│   │       ├── accordion.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── separator.tsx
│   │       └── sheet.tsx
│   │
│   ├── modules/                    # Módulos de negocio
│   │   ├── auth/
│   │   │   ├── actions/index.ts    # Server actions (login, logout)
│   │   │   ├── lib/session.ts      # Configuración de sesión
│   │   │   ├── lib/session-data.ts # La sesión comprobada contra la base (punto 14)
│   │   │   └── types/index.ts      # Tipos (SessionData, AdminRole)
│   │   │
│   │   ├── football-data/          # Integración con la API de ESPN + deportes manuales
│   │   │   ├── config/competitions.ts  # 17 competiciones (slugs de ESPN) + 11 deportes manuales con emoji
│   │   │   │                           # Exports: MANUAL_SPORTS, isManualSport(), isMotorSport(), getSportEmoji()
│   │   │   ├── lib/api-client.ts       # Cliente HTTP (sin clave, con timeout y reintentos)
│   │   │   ├── lib/team-sync.ts        # Núcleo del sync SIN requireAuth — lo llama el cron
│   │   │   ├── lib/suggestions.ts      # Mapeo ESPN → MatchSuggestion (aislado para poder testearlo)
│   │   │   ├── types/index.ts          # Tipos de respuesta de la API
│   │   │   └── actions/index.ts        # syncTeams, getMatchSuggestions, createEventFromSuggestion
│   │   │
│   │   ├── events/
│   │   │   ├── actions/index.ts    # CRUD de eventos
│   │   │   ├── components/         # EventCard, EventRow, EventRowWithBadge, TeamLogo, CompetitionEmblem
│   │   │   │   ├── event-card.tsx
│   │   │   │   ├── event-row.tsx          # Con checkAvailability (ventana 48h–5h)
│   │   │   │   ├── event-row-with-badge.tsx
│   │   │   │   │   ├── team-logo.tsx          # Emoji (deportes manuales), escudo (ruta local o URL) o iniciales; cae a iniciales si la imagen falla
│   │   │   │   ├── competition-emblem.tsx # Escudo de competición o emoji en círculo blanco
│   │   │   │   └── index.ts
│   │   │   └── types/index.ts
│   │   │
│   │   ├── reservations/
│   │   │   ├── actions/index.ts    # CRUD reservas + informes
│   │   │   └── types/index.ts
│   │   │
│   │   ├── seating/
│   │   │   ├── actions/index.ts    # Gestión de asientos y ZoneLabels
│   │   │   ├── lib/initialize-seats.ts # Crea los SeatStatus de un evento. Módulo PLANO, no action
│   │   │   ├── components/         # Componentes del mapa de asientos
│   │   │   │   ├── floor-plan-map.tsx
│   │   │   │   ├── floor-plan-view.tsx
│   │   │   │   ├── seat.tsx
│   │   │   │   ├── seat-map.tsx
│   │   │   │   └── index.ts
│   │   │   ├── constants.ts        # Constantes del mapa
│   │   │   └── types/index.ts
│   │   │
│   │   ├── payments/               # Módulo de pagos Redsys
│   │   │   ├── actions/index.ts    # initializePayment y getReservationByOrderId (exige la llave). Nada más: ver punto 13
│   │   │   ├── lib/customer-name.ts # Normaliza/valida el nombre. Módulo PLANO, no action
│   │   │   ├── lib/receipt.ts      # Guarda el recibo firmado. Módulo PLANO, no action
│   │   │   ├── lib/access-token.ts # La llave de las páginas de vuelta. Módulo PLANO
│   │   │   ├── lib/return-pages.ts # Confirmar/cancelar desde las páginas de vuelta. Módulo PLANO
│   │   │   └── types/index.ts      # InitializePaymentResult, ReservationTicketData
│   │   │
│   │   └── users/
│   │       └── actions/index.ts    # CRUD de usuarios
│   │
│   ├── shared/                     # Componentes y utilidades compartidas
│   │   ├── components/
│   │   │   ├── header.tsx          # Header público
│   │   │   ├── footer.tsx          # Footer público
│   │   │   ├── logo.tsx            # Logo de la app
│   │   │   └── info-banner.tsx     # Banner informativo bilingüe (cierra con X)
│   │   └── hooks/
│   │       ├── index.ts
│   │       └── use-reservation-store.ts  # Store de reservas (Zustand)
│   │
│   ├── generated/
│   │   └── prisma/                 # Cliente Prisma generado
│   │
│   └── lib/
│       ├── base-url.ts             # URL pública del servidor (la usan action, redsys y la ruta de retorno)
│       ├── prisma.ts               # Instancia de Prisma
│       ├── redsys.ts               # Config redsys-easy (sandbox/producción, generateOrderId, MERCHANT_INFO)
│       └── utils.ts                # Utilidades (cn para clases)
│
├── backups/                        # Backups de base de datos
├── components.json                 # Configuración de shadcn/ui
├── vercel.json                     # Configuración de cron jobs
├── docs/historico/                 # Planes y guías ya ejecutados, sin editar: lo que era cierto al escribirlos
├── MASTER_IA.md                    # Plan y registro de la entrega del máster
└── CLAUDE.md                       # Este archivo
```

---

## Modelos de Base de Datos

### AdminUser
```prisma
model AdminUser {
  id        String    @id @default(cuid())
  email     String    @unique
  password  String    // bcrypt hash
  name      String    @default("")
  role      AdminRole @default(WORKER)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

enum AdminRole {
  ADMIN
  WORKER
}
```

### Team
```prisma
model Team {
  id         String   @id @default(cuid())
  externalId Int?     @unique  // ID del proveedor externo (ESPN)
  name       String
  shortName  String
  league     String   // La Liga, Premier League, Serie A, Bundesliga, Ligue 1
  logo       String?  // Lo que pinta la UI: ruta local /escudos/{id}.png (o URL remota si aún no se ha descargado)
  logoSource String?  // URL remota de origen en ESPN, para poder re-descargar
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  homeEvents Event[] @relation("HomeTeam")
  awayEvents Event[] @relation("AwayTeam")
}
```

### Event
```prisma
model Event {
  id           String      @id @default(cuid())
  title        String
  description  String?
  sport        String      @default("football")
  competition  String?     // La Liga, Champions League, Baloncesto, Moto GP, etc.
  homeTeamId   String?     // Nullable: null para deportes manuales
  homeTeam     Team?       @relation("HomeTeam", fields: [homeTeamId], references: [id])
  awayTeamId   String?     // Nullable: null para deportes manuales
  awayTeam     Team?       @relation("AwayTeam", fields: [awayTeamId], references: [id])
  homeTeamName String?     // Nombre libre para deportes manuales (sin equipo en BD)
  awayTeamName String?     // Null para motor sports (solo un participante)
  eventDate     DateTime
  status        EventStatus @default(UPCOMING)
  screens       String      @default("PROYECTOR") // Comma-separated: TV1,TV2,TV3. Ver punto 10
  pricePerSeat  Int         @default(10)           // Precio por asiento en euros (10-30)
  managementFeeCents Int    @default(150)         // Gastos de gestión por asiento, en céntimos (0-500, pasos de 50)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  reservations Reservation[]
  seatStatuses SeatStatus[]
}

enum EventStatus {
  UPCOMING
  LIVE
  FINISHED
  CANCELLED
}
```

### Reservation
```prisma
model Reservation {
  id              String            @id @default(cuid())
  eventId         String
  event           Event             @relation(onDelete: Cascade)
  customerName    String
  customerEmail   String
  customerPhone   String?
  numberOfSeats   Int
  totalPrice      Decimal
  seatPriceCents     Int            // Snapshot del precio por asiento cobrado (céntimos)
  managementFeeCents Int            // Snapshot de los gastos de gestión por asiento (céntimos)
  status          ReservationStatus @default(PENDING)
  paymentId       String?           // orderId de Redsys (12 dígitos) para relacionar webhook con reserva
  paymentStatus   PaymentStatus     @default(PENDING)
  accessToken     String?           // Llave de las páginas de vuelta. NULL en las anteriores. Ver punto 13
  authorisationCode   String?       // Ds_AuthorisationCode. Ver punto 11
  paymentDateTime     String?       // Ds_Date + Ds_Hour: "28/08/2026 21:34". Texto a propósito
  paymentResponseCode String?       // Ds_Response ("0000".."0099" = autorizada)
  confirmedAt     DateTime?
  cancelledAt     DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  seatStatuses    SeatStatus[]
}

enum ReservationStatus {
  PENDING
  CONFIRMED
  CANCELLED
  EXPIRED
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}
```

### Seat & SeatStatus
```prisma
model Seat {
  id       String   @id @default(cuid())
  code     String   @unique  // Nombre real del local: "A7.2", "M3.1". Ver punto 9
  zone     SeatZone           // Vestigial
  row      String?            // Vestigial
  number   Int                // Vestigial
  posX     Int
  posY     Int
  capacity Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  seatStatuses SeatStatus[]
}

enum SeatZone {
  PROJECTOR
  TV1
  TV2
}

model SeatStatus {
  id            String         @id @default(cuid())
  eventId       String
  seatId        String
  status        SeatStatusType @default(AVAILABLE)
  reservationId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([eventId, seatId])
}

enum SeatStatusType {
  AVAILABLE
  RESERVED
  OCCUPIED
  BLOCKED
}
```

### ZoneLabel
```prisma
model ZoneLabel {
  id       String @id @default(cuid())
  zone     String @unique // "TV1", "TV2", "TV3"
  posX     Float  // Posición X en porcentaje (0-100)
  posY     Float  // Posición Y en porcentaje (0-100)
  scaleX   Float  @default(1)
  rotation Float  @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### LoginAttempt
```prisma
model LoginAttempt {
  key     String   @id // la IP
  count   Int
  resetAt DateTime // fin de la ventana de 15 minutos
}
```

---

## Patrones y Convenciones

### Server Actions
Ubicación: `src/modules/*/actions/index.ts`

```typescript
"use server";

export async function createSomething(data: CreateData): Promise<Result> {
  // Validaciones
  // Operación con Prisma
  // Return { success: true/false, error?: string }
}
```

### Componentes de Página
```typescript
// Server Component (page.tsx)
export default async function Page() {
  const data = await getServerData();
  return <ClientComponent data={data} />;
}

// Client Component (client.tsx)
"use client";
export function ClientComponent({ data }) {
  // useState, useEffect, handlers
}
```

### Estilos
- Tailwind CSS con clases directas
- Colores principales:
  - Dorado: `#D4AF37` (botones primarios, badges)
  - Negro: `#000000` (fondo)
  - Gris oscuro: `#1a1a1a` (tarjetas, inputs)
  - Bordes: `white/10`

### Autenticación
```typescript
// Obtener sesión en Server Component
const session = await getSessionData();
const isAdmin = session.role === "ADMIN";

// Verificar en layout.tsx
if (!session.isLoggedIn) redirect("/admin/login");
```

---

## Flujos Importantes

### Login
1. Usuario envía email/contraseña
2. `login()` en auth/actions verifica con bcrypt
3. Se guarda sesión con iron-session (incluye role)
4. Redirect a /admin

### Flujo de Reserva con Pago Redsys
1. Cliente selecciona asientos → pulsa RESERVAR
2. `initializePayment()` (payments/actions):
   - Verifica disponibilidad de asientos
   - Calcula el importe **en céntimos enteros**: `(pricePerSeat*100 + managementFeeCents) * asientos`
   - Crea reserva `PENDING` con asientos `RESERVED` en transacción, **congelando el desglose**
     (`seatPriceCents`, `managementFeeCents`) en la propia reserva
   - Genera orderId (12 dígitos de timestamp) → guardado en `Reservation.paymentId`
   - Construye formulario Redsys firmado con HMAC-SHA256 (`redsys-easy`)
   - Devuelve `{ redsysUrl, formBody }`
3. Cliente hace auto-submit del formulario oculto → redirect al banco
4. Cliente paga en la pasarela Redsys
5. Redsys POST a `/api/payments/notify`:
   - Verifica firma, extrae orderId y código de respuesta
   - OK (código 0000-0099): reserva → `CONFIRMED`, asientos → `OCCUPIED`
   - KO: reserva → `CANCELLED`, asientos → `AVAILABLE`
6. Redsys redirige al cliente:
   - OK → `/reserva/confirmacion/[orderId]?t=<llave>`: confirma si el webhook no llegó (fallback local, **nunca en producción**) + muestra ticket + descarga PDF
   - KO → `/reserva/error?…&t=<llave>`: cancela si el webhook no llegó (fallback local) + botón reintentar
   - Sin la llave de la reserva, ninguna de las dos enseña ni toca nada (punto 13)

**Nota sobre el webhook en local**: Redsys no puede alcanzar `localhost`. El fallback en las páginas de OK/KO es idempotente: si el webhook ya actuó, las páginas detectan que la reserva no está en estado `PENDING` y no hacen nada.

### Generar Informe PDF
1. Admin abre acordeón "Informes de reservas"
2. Click en mes deseado
3. `getMonthlyReportData()` obtiene datos
4. jsPDF genera PDF en cliente
5. `window.open()` abre en nueva pestaña

---

## Comandos de Desarrollo

Sin sufijo es local (Docker); con sufijo `:testing` o `:prod`, remoto. Lista completa y
procedimiento de migración en `docs/entornos.md`.

```bash
npm run db:up               # Postgres local en Docker (puerto 5433)
npm run dev                 # la app contra lounge_dev
npm run db:migrate          # crear una migración nueva tras cambiar schema.prisma
npm run db:deploy           # aplicar las migraciones a lounge_dev
npm test                    # unitarios y componentes
npm run test:integration    # contra lounge_test
npm run e2e                 # build + Playwright en el 3100

npm run db:whoami:testing   # SIEMPRE antes de tocar una base remota
```

- **Nunca `db push` contra una base con datos**: el `CHECK` de importes vive en una migración
  y `db push` no lo crea.
- **Nunca un fichero `.env.production`**: Next lo carga solo en `build` y `start`, y un
  `npm start` local arrancaría contra producción. El de producción se llama `.env.prod`.
- En Windows, parar el servidor antes de `prisma generate` (punto 1).

---

## Consideraciones Especiales

1. **Windows + Prisma**: El archivo `.dll.node` se bloquea mientras el servidor corre. Detener dev server antes de regenerar.

2. **Decimal de Prisma**: No se puede serializar a cliente. Convertir a `Number()` antes de retornar.

3. **La cookie de sesión no es la verdad**: `getSessionData` relee al usuario en la base en cada petición (punto 14). Las cookies antiguas, sin rol o sin huella, ya no valen.

4. **Navegación post-action**: Usar `window.location.href` para navegación confiable.

5. **Cascade Delete**: Al eliminar Event, se eliminan Reservations y SeatStatuses automáticamente.

6. **Módulo de pagos**: Integración Redsys completa en `src/modules/payments/`. El entorno se controla con la variable `REDSYS_ENV` (sandbox por defecto; `production` solo en Vercel scope Production / rama `main`). Ver `docs/historico/REDSYS.md` para la configuración por entorno.

7. **Gastos de gestión (`Event.managementFeeCents`)**: importe por asiento que se cobra junto a la
   reserva pero **no es descontable en consumiciones**. Se maneja siempre en céntimos enteros y solo
   admite los valores de `MANAGEMENT_FEE_OPTIONS_CENTS` (`src/modules/events/config/pricing.ts`),
   validados en la server action. Cada reserva **congela** el precio y los gastos unitarios que pagó
   (`Reservation.seatPriceCents` / `managementFeeCents`), así que el ticket y el detalle de admin
   nunca releen el evento: editarlo no reescribe reservas ya cobradas. Un `CHECK` en la BD garantiza
   que `totalPrice * 100 = (seatPriceCents + managementFeeCents) * numberOfSeats`.
   Verificación: `npx tsx scripts/verify-management-fee.ts report`.

8. **Escudos y emblemas servidos en local**: las imágenes viven en `public/escudos/{Team.id}.png` y `public/competiciones/{slug}.png`, versionadas en git. La web pública **no hace ninguna petición a `a.espncdn.com`**: ESPN es solo la fuente en el momento del sync. Consecuencias al tocar este código:
   - `Team.logo` es lo que se renderiza; `Team.logoSource` guarda la URL remota de origen.
   - **El sync nunca sobrescribe un `logo` que empiece por `/escudos/`** (`LOCAL_LOGO_PREFIX` en `lib/team-sync.ts`). Si se quita ese guardarraíl, el primer cron deshace toda la descarga.
   - Los equipos que crea el cron sobre la marcha apuntan a ESPN hasta que se ejecuta `npx tsx scripts/download-crests.ts` en local y se hace commit: Vercel tiene el sistema de ficheros en solo lectura y la función serverless no puede escribir en `public/`.
   - `scripts/sync-verify.ts report` incluye el recuento de escudos locales vs remotos.

9. **Nombres de asiento (`Seat.code`)**: es el nombre real del asiento en el local (`"A7.2"`,
   `"M3.1"`) y **lo único que ve el cliente**: se imprime en el ticket PDF y en las tarjetas de
   reserva del panel. No se desnormaliza en ningún sitio —siempre se resuelve por join
   `SeatStatus → Seat`—, así que cambiarlo aquí cambia las dos pantallas a la vez. Al tocarlo:
   - Se renombra con **`npx tsx scripts/rename-seats.ts report|apply`**, nunca a mano. El mapa de
     nombres vive dentro del script, versionado en git, y es el registro de qué se cambió.
   - **Máximo 10 caracteres**, sólo `A-Za-z0-9_-/.`, y únicos **ignorando mayúsculas**. El límite
     de 10 es duro: el ticket son 80 mm de papel con 3 códigos por línea
     (`reserva/confirmacion/[orderId]/client.tsx`).
   - El renombrado va en **dos fases** (código temporal por el medio) porque `Seat_code_key` es un
     índice único no diferible y una permutación no tiene ningún orden seguro.
   - **`Seat.id` no se toca nunca.** En las 47 filas actuales `id === code` original (lo fijó el
     seed), y `SeatStatus.seatId` es FK contra él: cambiarlo destruiría las reservas. Por eso
     `DEFAULT_SEAT_POSITIONS` (indexado por `id`) sigue siendo válido tras un renombrado.
   - **`zone`, `row` y `number` son vestigiales**: el nombre ya no codifica zona ni fila. Nada vivo
     las lee, y las ordenaciones van por `code`.
   - Renombrar **reescribe el pasado**: las reservas de partidos ya jugados pasan a mostrar el
     nombre nuevo, mientras que el PDF que el cliente descargó sigue diciendo el viejo. Elegir para
     producción una ventana sin reservas pendientes de consumir.

10. **Pantallas: `TV1` / `TV2` / `TV3`**. `PROYECTOR` se renombró a `TV3` en agosto de 2026. Vive en
    dos sistemas independientes que hay que mover juntos: el cartel del plano (tabla `ZoneLabel` +
    `DEFAULT_ZONE_LABEL_POSITIONS` en `seating/constants.ts`) y el badge de pantalla de cada evento
    (`Event.screens`, string separado por comas). Los datos de ambos los migra
    `scripts/rename-seats.ts`. El `@default("PROYECTOR")` de `schema.prisma` se dejó a propósito: no
    lo usa ningún camino de creación y cambiarlo pediría una migración a cambio de nada.

11. **Nombre del cliente y recibo de pago** (agosto 2026). Dos cosas que se implementaron juntas
    porque comparten pantalla, pero que son independientes:

    - **`Reservation.customerName`** ya no es el literal `"Cliente"`: lo escribe el cliente en un
      modal al pulsar RESERVAR, antes de ir a la pasarela. Se normaliza y valida en
      `modules/payments/lib/customer-name.ts`, un **módulo plano a propósito** (sin `"use server"`)
      para que lo compartan el modal y la server action; si solo validara el cliente, bastaría con
      llamar a `initializePayment` desde la consola para saltárselo. La lista blanca es **Latin-1**:
      no es paranoia con SQL (Prisma parametriza) ni con XSS (React escapa), sino que las fuentes
      estándar de jsPDF no saben pintar otra cosa y que las marcas bidireccionales permiten que un
      nombre se lea distinto de como está guardado. El tope de 24 caracteres es lo que hace que
      entre en una línea de los 80 mm del ticket.
    - Las reservas anteriores conservan `"Cliente"`. **`displayCustomerName()` las pinta como "Sin
      nombre"**, y el ticket omite el bloque entero: su PDF sale con el layout de siempre.

    - **El recibo** (`authorisationCode`, `paymentDateTime`, `paymentResponseCode`) lo exige
      CaixaBank en la URL OK. Esos datos **solo llegan dentro de la notificación firmada de Redsys**,
      así que los escriben únicamente el webhook y la ruta de retorno, vía
      `modules/payments/lib/receipt.ts` — que **tampoco es server action** por lo mismo: lo sería un
      endpoint sin autenticar capaz de escribir un código de autorización inventado en cualquier
      reserva. Gana el primero que escribe, así que recargar la URL OK no reescribe un recibo.
    - `paymentDateTime` es **texto, no `DateTime`**: Redsys manda `Ds_Date` + `Ds_Hour` en hora local
      española ya formateada. Guardarlo literal hace que el recibo imprima lo mismo que figura en los
      registros del banco y evita decidir el desfase CET/CEST — un fallo ahí saldría impreso en un
      documento contable. El timestamp de máquina sigue siendo `confirmedAt`.

    - **URLOK y URLKO ya no apuntan a las páginas**, sino a `/api/payments/return/[orderId]`, que
      acepta GET y POST y redirige con **303**. El motivo es que las pantallas son `page.tsx` y en el
      App Router no responden a POST: el día que en el módulo de administración de Redsys se active
      el envío de parámetros en las URLs de respuesta, sin esa ruta se rompería la pantalla de todos
      los clientes que acaban de pagar. La ruta **no confirma ni cancela nada**: solo anota el recibo.

    - **En local el recibo sale con guiones**, porque ahí el webhook no llega (Redsys no alcanza
      `localhost`) y la página autoconfirma. En las previews de Vercel sí llega. Para probarlo en
      local:
      `npx tsx scripts/simulate-redsys-notify.ts <orderId> [ok|ko]`, que firma una notificación con
      la clave del entorno y la manda a localhost. Aborta si `REDSYS_ENV=production` o si el destino
      no es localhost, y pide `--force` para un `ko` sobre una reserva ya confirmada (la cancelaría
      y liberaría sus asientos de forma irreversible).

12. **Estados de carga** (septiembre 2026). Cada página tiene un `loading.tsx` que imita su forma: en producción `<Link>` lo precarga y sale en cuanto se pulsa. Las piezas están en `components/ui/skeleton.tsx` (`Skeleton`, `LoadingRegion`), en `admin/(dashboard)/components/page-skeleton.tsx` (`AdminPageSkeleton`), en `shared/components/link-pending.tsx` (el spinner de la tarjeta pulsada, con `useLinkStatus`) y en `shared/components/motion.ts` (animaciones, todas `motion-safe:`). Los botones de acción usan `<Button loading>`, y **si tras la acción se navega, el botón no se reactiva en el éxito**: solo en el error.
    - **El menú del panel (`/admin`) no tiene `loading.tsx`, a propósito.** Con uno en `(dashboard)/`, la respuesta de «Ya está devuelto» a veces no se aplicaba (medido: 7–12 fallos de 30 frente a 0). Si se vuelve a poner, repetir el E2E de `admin/refunds.spec.ts` 30 veces.
    - La portada vive en el grupo `(inicio)` para que su skeleton no haga de pantalla de carga de las demás rutas.

13. **Roles y llave de las reservas** (septiembre 2026, RCA-285).
    - **Las acciones del ADMIN exigen `requireAdmin`, no solo sesión**: eventos, sugerencias, plano, carteles, informes y usuarios. Sus páginas llaman a `redirectUnlessAdmin()` para devolver al WORKER al menú, pero lo que protege es la acción, que es un endpoint. El WORKER conserva las reservas y **bloquear asientos**, cuyo botón está en su vista. `tests/integration/roles.test.ts` recorre cada acción con la sesión de un WORKER: una acción nueva del panel va ahí.
    - **El nº de pedido no basta para abrir una reserva.** Sale del reloj y se adivina. Cada reserva lleva `accessToken`, aleatorio, que `initializePayment` mete en la URLOK y la URLKO (`&t=`). La ruta de retorno lo pasa a las páginas, y estas y `getReservationByOrderId` lo exigen. Las reservas anteriores tienen `NULL` y se abren sin él, porque sus URL ya estaban repartidas.
    - **`payments/actions` solo exporta `initializePayment` y `getReservationByOrderId`.** Confirmar y cancelar desde las páginas viven en `payments/lib/return-pages.ts`, y confirmar lleva dentro la guarda de producción. Un test comprueba la lista de exportaciones: si se añade una acción a ese fichero, que sea a propósito.
    - Con `loading.tsx`, `notFound()` responde **200** con la pantalla de 404, porque el streaming ya ha empezado. No es un fallo: lo que cuenta es que no sale ningún dato.

14. **Sesión revocable, login y datos privados** (septiembre 2026, RCA-286 y RCA-275).
    - **La sesión se comprueba contra la base en cada petición del panel** (`auth/lib/session-data.ts`, con `cache()` de React). Al entrar, la cookie guarda una huella del hash de la contraseña. Si el usuario ya no existe o la huella no coincide, no hay sesión. El rol se lee siempre de la base. Borrar a un usuario, cambiarle el rol o la contraseña surte efecto **al instante**; por eso `updateUser` no deja sin ADMIN al panel y `deleteUser` no deja borrarse a uno mismo.
    - **El middleware ya no manda de `/admin/login` a `/admin`**: solo ve la cookie, y con una que la base rechaza habría un bucle. Lo hace la página del login; el layout del panel manda al login si la sesión no vale.
    - **Sin sesión, `requireAuth` y `requireAdmin` hacen `redirect("/admin/login")`, no lanzan.** En una navegación con `<Link>` el layout no se vuelve a pintar, solo la página, así que la redirección del layout no basta. Con un error, un WORKER revocado veía «Application error» (lo encontró Ramón en la preview). Un WORKER con sesión que llama a una acción del ADMIN sigue recibiendo `Forbidden`.
    - **Los usuarios de test llevan un hash fijo (`TEST_PASSWORD_HASH`)**: el E2E resiembra antes de cada test, y un hash nuevo invalidaría las sesiones del setup.
    - **El límite del login vive en la tabla `LoginAttempt`** (`lib/rate-limit.ts`), con una suma atómica en SQL. El cron de limpieza borra las ventanas vencidas. Con un email inexistente, el login calcula bcrypt igualmente.
    - **`initializeSeatsForEvent` está en `seating/lib/`**, fuera de `"use server"`, como confirmar y cancelar.
    - **Cabeceras de seguridad** en `next.config.ts`: `frame-ancestors 'none'`, `X-Frame-Options` y tres más. Sin CSP de scripts, a propósito (ver `docs/seguridad.md`).
    - **Nada privado en el árbol**: ni el FUC de producción, ni correos de terceros, ni claves, ni contraseñas. `tests/unit/no-private-data.test.ts` lo vigila por huella SHA-256; si hay que añadir un dato a la lista negra, se añade su huella, **nunca el valor**. El seed saca el primer ADMIN de `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`. Los commits antiguos sí conservan esos datos: el propietario decidió no reescribir el historial.
