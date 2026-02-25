# Guía de Arquitectura para Claude Code

## Resumen del Proyecto

**The Lounge Beerhouse** es una aplicación web para gestionar reservas de asientos en un bar deportivo. Desarrollada con Next.js 16 (App Router), Prisma ORM y SQLite.

---

## Stack Tecnológico

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Next.js | 16.1.5 | Framework React con App Router |
| React | 19.2.3 | UI Library |
| TypeScript | 5.x | Tipado estático |
| Prisma | 6.19.2 | ORM para base de datos |
| SQLite | - | Base de datos (desarrollo) |
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
│   ├── dev.db             # Base de datos SQLite
│   ├── seed.ts            # Script de seed
│   └── migrations/        # Migraciones de Prisma
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Layout raíz
│   │   ├── page.tsx                # Página principal pública
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
│   │   │   │   │       └── [reservationId]/ # Detalle reserva
│   │   │   │   ├── asientos/       # Editor de asientos
│   │   │   │   │   ├── page.tsx, client.tsx
│   │   │   │   └── usuarios/       # Gestión de usuarios
│   │   │   │       ├── page.tsx, user-form.tsx
│   │   │   │       ├── nuevo/      # Crear usuario
│   │   │   │       └── [id]/       # Editar usuario
│   │   │   └── login/              # Página de login (pública)
│   │   │       ├── page.tsx, client.tsx
│   │   ├── eventos/[id]/           # Vista pública de evento
│   │   └── api/
│   │       └── cron/
│   │           ├── cleanup/        # Endpoint de limpieza
│   │           │   └── route.ts
│   │           └── sync-teams/     # Sync equipos desde football-data.org
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
│   │   │   └── types/index.ts      # Tipos (SessionData, AdminRole)
│   │   │
│   │   ├── football-data/          # Integración con football-data.org API
│   │   │   ├── config/competitions.ts  # 12 competiciones del free tier
│   │   │   ├── lib/api-client.ts       # Cliente HTTP con rate limiting
│   │   │   ├── types/index.ts          # Tipos de respuesta de la API
│   │   │   └── actions/index.ts        # syncTeams, getMatchSuggestions, createEventFromSuggestion
│   │   │
│   │   ├── events/
│   │   │   ├── actions/index.ts    # CRUD de eventos
│   │   │   ├── components/         # EventCard, EventRow, EventRowWithBadge, TeamLogo
│   │   │   │   ├── event-card.tsx
│   │   │   │   ├── event-row.tsx
│   │   │   │   ├── event-row-with-badge.tsx
│   │   │   │   ├── team-logo.tsx
│   │   │   │   └── index.ts
│   │   │   └── types/index.ts
│   │   │
│   │   ├── reservations/
│   │   │   ├── actions/index.ts    # CRUD reservas + informes
│   │   │   └── types/index.ts
│   │   │
│   │   ├── seating/
│   │   │   ├── actions/index.ts    # Gestión de asientos y ZoneLabels
│   │   │   ├── components/         # Componentes del mapa de asientos
│   │   │   │   ├── floor-plan-map.tsx
│   │   │   │   ├── floor-plan-view.tsx
│   │   │   │   ├── seat.tsx
│   │   │   │   ├── seat-map.tsx
│   │   │   │   └── index.ts
│   │   │   ├── constants.ts        # Constantes del mapa
│   │   │   └── types/index.ts
│   │   │
│   │   ├── payments/               # Módulo de pagos (estructura preparada)
│   │   │   └── types/index.ts
│   │   │
│   │   └── users/
│   │       └── actions/index.ts    # CRUD de usuarios
│   │
│   ├── shared/                     # Componentes y utilidades compartidas
│   │   ├── components/
│   │   │   ├── header.tsx          # Header público
│   │   │   ├── footer.tsx          # Footer público
│   │   │   └── logo.tsx            # Logo de la app
│   │   └── hooks/
│   │       ├── index.ts
│   │       └── use-reservation-store.ts  # Store de reservas (Zustand)
│   │
│   ├── generated/
│   │   └── prisma/                 # Cliente Prisma generado
│   │
│   └── lib/
│       ├── prisma.ts               # Instancia de Prisma
│       └── utils.ts                # Utilidades (cn para clases)
│
├── backups/                        # Backups de base de datos
├── components.json                 # Configuración de shadcn/ui
├── vercel.json                     # Configuración de cron jobs
├── DEVELOPMENT.md                  # Progreso del desarrollo
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
  externalId Int?     @unique  // ID de football-data.org
  name       String
  shortName  String
  league     String   // La Liga, Premier League, Serie A, Bundesliga, Ligue 1
  logo       String?  // URL del escudo (auto-synced from football-data.org)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  homeEvents Event[] @relation("HomeTeam")
  awayEvents Event[] @relation("AwayTeam")
}
```

### Event
```prisma
model Event {
  id          String      @id @default(cuid())
  title       String
  description String?
  sport       String      @default("football")
  competition String?     // La Liga, Champions League, etc.
  homeTeamId  String
  awayTeamId  String
  eventDate   DateTime
  status      EventStatus @default(UPCOMING)
  screens     String      @default("PROYECTOR") // Comma-separated
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

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
  status          ReservationStatus @default(PENDING)
  paymentId       String?           // ID de transacción Redsys
  paymentStatus   PaymentStatus     @default(PENDING)
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
  code     String   @unique  // "P1", "T1-A1"
  zone     SeatZone
  row      String?
  number   Int
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
  zone     String @unique // "TV1", "TV2", "PROYECTOR"
  posX     Float  // Posición X en porcentaje (0-100)
  posY     Float  // Posición Y en porcentaje (0-100)
  scaleX   Float  @default(1)
  rotation Float  @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
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

### Crear Reserva
1. Admin selecciona evento
2. Selecciona asientos en el mapa
3. `createReservation()` crea reserva y actualiza SeatStatus
4. Transacción Prisma garantiza consistencia

### Generar Informe PDF
1. Admin abre acordeón "Informes de reservas"
2. Click en mes deseado
3. `getMonthlyReportData()` obtiene datos
4. jsPDF genera PDF en cliente
5. `window.open()` abre en nueva pestaña

---

## Comandos de Desarrollo

```bash
# Iniciar desarrollo
npm run dev

# Regenerar Prisma (si cambia schema)
# IMPORTANTE: Detener servidor primero en Windows
npx prisma db push
npx prisma generate

# Ver base de datos
npx prisma studio

# Seed de datos
npm run db:seed

# Build producción
npm run build
```

---

## Consideraciones Especiales

1. **Windows + Prisma**: El archivo `.dll.node` se bloquea mientras el servidor corre. Detener dev server antes de regenerar.

2. **Decimal de Prisma**: No se puede serializar a cliente. Convertir a `Number()` antes de retornar.

3. **Sesiones legacy**: Si la sesión no tiene `role`, se busca en BD automáticamente.

4. **Navegación post-action**: Usar `window.location.href` para navegación confiable.

5. **Cascade Delete**: Al eliminar Event, se eliminan Reservations y SeatStatuses automáticamente.

6. **Módulo de pagos**: Estructura preparada en `src/modules/payments/` pero sin implementación aún (pendiente integración con Redsys).
