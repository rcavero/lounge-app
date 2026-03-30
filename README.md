# The Lounge Beerhouse

Aplicación web para gestionar reservas de asientos en un bar deportivo en Valencia. Los clientes reservan asientos para ver eventos deportivos; los administradores gestionan eventos, reservas, asientos y usuarios.

## Stack Tecnológico

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4, Radix UI, Lucide React
- **Base de datos**: SQLite (desarrollo) / PostgreSQL via Supabase (producción)
- **ORM**: Prisma 6
- **Autenticación**: iron-session + bcryptjs
- **Estado**: Zustand
- **PDFs y QR**: jsPDF + qrcode
- **Fechas**: date-fns
- **Integración externa**: football-data.org API

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Sincronizar base de datos
npx prisma db push

# Generar cliente Prisma
npx prisma generate

# Seed de datos iniciales (47 asientos + usuario admin)
npm run db:seed
```

## Variables de Entorno

```env
# Base de datos
DATABASE_URL="file:./dev.db"          # Desarrollo
# DATABASE_URL="..."                  # Pooler Supabase (producción)
# DIRECT_URL="..."                    # Migraciones Prisma (producción)

# Autenticación
AUTH_SECRET="tu-secreto-para-sesiones"

# Cron jobs
CRON_SECRET="tu-secreto-para-cron-jobs"

# Football-data.org
FOOTBALL_DATA_API_KEY="tu-api-key"
```

## Desarrollo

```bash
npm run dev          # Servidor de desarrollo
npm run db:studio    # Explorar BD en navegador
npm run build        # Build de producción
npm run start        # Servidor de producción
```

## Funcionalidades

### Vista Pública (Cliente)
- Listado de eventos próximos con logos de equipos y escudo de competición
- **Ventana de reservas**: disponible entre 48h y 5h antes del evento; tarjetas bloqueadas con icono y tooltip bilingüe fuera de la ventana
- **Banner informativo** bilingüe (español/inglés según navegador)
- Reserva de asientos con mapa interactivo del bar
- **Modal de condiciones** bilingüe al entrar al plano de asientos
- **Ticket PDF** con datos del evento, asientos, precio total y QR de verificación
- Contacto por WhatsApp sticky en la parte inferior

### Panel de Administración
- **Gestión de eventos**: CRUD completo con precio por asiento (10–30€), pantallas y equipos de la API
- **Sugerencias de partidos**: crear eventos desde football-data.org
- **Administrar reservas**: listado por evento con totales; detalle individual accesible por QR
- **Bloquear asientos**: plano interactivo por evento (verde=disponible, gris=bloqueado, rojo=ocupado)
- **Editor de asientos**: drag & drop para posicionar asientos y etiquetas de zona
- **Gestión de usuarios**: CRUD de administradores (ADMIN/WORKER)
- **Informes PDF**: generación de informes mensuales (solo ADMIN)

## Roles y Permisos

| Funcionalidad | ADMIN | WORKER |
|---|---|---|
| Configurar eventos | ✅ | ❌ |
| Administrar reservas | ✅ | ✅ |
| Bloquear asientos | ✅ | ✅ |
| Ver informes PDF | ✅ | ❌ |
| Configurar asientos | ✅ | ❌ |
| Administrar usuarios | ✅ | ❌ |

## Estructura del Proyecto

```
src/
├── app/          # Rutas (Next.js App Router)
├── components/   # Componentes UI reutilizables (Radix-based)
├── modules/      # Módulos de negocio (auth, events, reservations, seating, users, football-data, payments)
├── shared/       # Componentes y hooks compartidos
├── generated/    # Cliente Prisma generado
└── lib/          # Utilidades
```

Consultar [CLAUDE.md](./CLAUDE.md) para arquitectura detallada y [DEVELOPMENT.md](./DEVELOPMENT.md) para el estado del desarrollo.
