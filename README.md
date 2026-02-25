# The Lounge Beerhouse

Aplicación web para gestionar reservas de asientos en un bar deportivo. Desarrollada con Next.js 16, Prisma ORM y SQLite.

## Stack Tecnológico

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4, Radix UI
- **Base de datos**: SQLite con Prisma ORM
- **Autenticación**: iron-session + bcryptjs
- **Estado**: Zustand
- **Informes**: jsPDF

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

# Seed de datos iniciales
npm run db:seed
```

## Variables de Entorno

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="tu-secreto-para-sesiones"
CRON_SECRET="tu-secreto-para-cron-jobs"
```

## Desarrollo

```bash
# Iniciar servidor de desarrollo
npm run dev

# Abrir Prisma Studio (explorar BD)
npm run db:studio

# Build de producción
npm run build
npm run start
```

## Funcionalidades

- **Gestión de eventos**: CRUD de eventos deportivos con equipos, pantallas y estados
- **Sistema de reservas**: Mapa interactivo de asientos con drag & drop
- **Informes PDF**: Generación de informes mensuales de reservas (solo ADMIN)
- **Gestión de usuarios**: CRUD de administradores con roles ADMIN/WORKER
- **Editor de asientos**: Configuración visual del layout del bar
- **Limpieza automática**: Cron job para eliminar eventos antiguos

## Estructura del Proyecto

```
src/
├── app/          # Rutas (Next.js App Router)
├── components/   # Componentes UI reutilizables
├── modules/      # Módulos de negocio (auth, events, reservations, seating, users, payments)
├── shared/       # Componentes y hooks compartidos
├── generated/    # Cliente Prisma generado
└── lib/          # Utilidades
```

Consultar [CLAUDE.md](./CLAUDE.md) para documentación detallada de la arquitectura y [DEVELOPMENT.md](./DEVELOPMENT.md) para el estado del desarrollo.
