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

---

## Estructura de Directorios

```
lounge-app/
├── prisma/
│   ├── schema.prisma      # Esquema de base de datos
│   ├── dev.db             # Base de datos SQLite
│   └── seed.ts            # Script de seed
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── admin/
│   │   │   ├── (dashboard)/        # Grupo de rutas protegidas
│   │   │   │   ├── layout.tsx      # Layout con verificación de sesión
│   │   │   │   ├── page.tsx        # Dashboard principal
│   │   │   │   ├── eventos/        # CRUD de eventos
│   │   │   │   ├── reservas/       # Gestión de reservas
│   │   │   │   ├── asientos/       # Editor de asientos
│   │   │   │   └── usuarios/       # Gestión de usuarios
│   │   │   └── login/              # Página de login (pública)
│   │   ├── eventos/[id]/           # Vista pública de evento
│   │   └── api/
│   │       └── cron/cleanup/       # Endpoint de limpieza
│   │
│   ├── components/
│   │   └── ui/                     # Componentes reutilizables
│   │       ├── accordion.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── sheet.tsx
│   │       └── ...
│   │
│   ├── modules/                    # Módulos de negocio
│   │   ├── auth/
│   │   │   ├── actions/index.ts    # Server actions (login, logout)
│   │   │   ├── lib/session.ts      # Configuración de sesión
│   │   │   └── types/index.ts      # Tipos (SessionData, AdminRole)
│   │   │
│   │   ├── events/
│   │   │   ├── actions/index.ts    # CRUD de eventos
│   │   │   ├── components/         # EventRow, TeamLogo, etc.
│   │   │   └── types/index.ts
│   │   │
│   │   ├── reservations/
│   │   │   └── actions/index.ts    # CRUD reservas + informes
│   │   │
│   │   ├── seating/
│   │   │   └── actions/index.ts    # Gestión de asientos
│   │   │
│   │   └── users/
│   │       └── actions/index.ts    # CRUD de usuarios
│   │
│   ├── generated/
│   │   └── prisma/                 # Cliente Prisma generado
│   │
│   └── lib/
│       ├── prisma.ts               # Instancia de Prisma
│       └── utils.ts                # Utilidades (cn para clases)
│
├── backups/                        # Backups de base de datos
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
}

enum AdminRole {
  ADMIN
  WORKER
}
```

### Team
```prisma
model Team {
  id        String  @id @default(cuid())
  name      String
  shortName String
  league    String  // La Liga, Premier League, etc.
  logo      String? // URL del escudo
}
```

### Event
```prisma
model Event {
  id          String      @id @default(cuid())
  title       String
  homeTeamId  String
  awayTeamId  String
  eventDate   DateTime
  status      EventStatus @default(UPCOMING)
  screens     String      @default("PROYECTOR")

  reservations Reservation[]
  seatStatuses SeatStatus[]
}
```

### Reservation
```prisma
model Reservation {
  id            String @id @default(cuid())
  eventId       String
  event         Event  @relation(onDelete: Cascade)
  customerName  String
  customerEmail String
  numberOfSeats Int
  totalPrice    Decimal
  status        ReservationStatus
}
```

### Seat & SeatStatus
```prisma
model Seat {
  id       String   @id @default(cuid())
  code     String   @unique  // "P1", "T1-A1"
  zone     SeatZone
  posX     Int
  posY     Int
}

model SeatStatus {
  id        String         @id @default(cuid())
  eventId   String
  seatId    String
  status    SeatStatusType @default(AVAILABLE)
  reservationId String?
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
