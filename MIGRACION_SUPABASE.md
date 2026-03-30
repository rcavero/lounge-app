# Migración SQLite → Supabase (PostgreSQL)

Guía paso a paso adaptada al estado exacto del proyecto **The Lounge Beerhouse**.

---

## Contexto del proyecto

- **BD actual:** SQLite (`prisma/dev.db`)
- **ORM:** Prisma 6.19.2 con cliente generado en `src/generated/prisma`
- **Migraciones existentes:** 3 migraciones SQLite en `prisma/migrations/` → se reemplazarán por una sola migración PostgreSQL limpia
- **Seed crea:** 47 asientos + usuario admin (`ramoncaveroaras@gmail.com`)
- **Equipos:** NO vienen del seed, se sincronizan desde football-data.org mediante el botón "API" en `/admin/eventos`

---

## FASE 1 — Crear proyecto en Supabase

### 1.1 Registro y proyecto

1. Ve a **https://supabase.com** → pulsa "Start your project"
2. Regístrate con GitHub (más rápido)
3. Pulsa **"New project"** y rellena:
   - **Name:** `lounge-app`
   - **Database Password:** genera una contraseña fuerte (mínimo 20 caracteres). **Guárdala ahora**, no hay forma de recuperarla después
   - **Region:** `West EU (Ireland)` — la más cercana a España
4. Espera ~2 minutos mientras Supabase provisiona la base de datos

### 1.2 Obtener las dos URLs de conexión

Una vez el proyecto esté listo, ve a:

**Project Settings → Database → Connection string**

Necesitas copiar **dos URLs distintas**:

#### URL 1 — `DATABASE_URL` (para la app en producción/Vercel)
- Sección: **"Connection pooling"**
- Modo: **Transaction** (no Session)
- Puerto: **6543**
- Aspecto: `postgresql://postgres.XXXX:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`
- Añade al final: `?pgbouncer=true` (si no viene ya incluido)

#### URL 2 — `DIRECT_URL` (solo para migraciones de Prisma)
- Sección: **"Direct connection"**
- Puerto: **5432**
- Aspecto: `postgresql://postgres.XXXX:[PASSWORD]@db.XXXX.supabase.co:5432/postgres`

---

## FASE 2 — Cambios en el código

### 2.1 Actualizar `prisma/schema.prisma`

Localiza el bloque `datasource db` (líneas 6-9 del archivo) y reemplázalo:

```prisma
// ANTES
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// DESPUÉS
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Nada más cambia en el schema.** Los modelos, enums y relaciones son 100% compatibles con PostgreSQL. Prisma los traduce automáticamente (incluyendo los enums nativos de PostgreSQL).

### 2.2 Actualizar `.env`

Reemplaza el contenido de `.env` con esto (sustituyendo los valores reales):

```env
# PostgreSQL — Supabase (pooler para la app)
DATABASE_URL="postgresql://postgres.XXXX:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# PostgreSQL — Supabase (directo solo para migraciones)
DIRECT_URL="postgresql://postgres.XXXX:[PASSWORD]@db.XXXX.supabase.co:5432/postgres"

# Resto de variables (sin cambios)
AUTH_SECRET="***REMOVED***"
CRON_SECRET="your-secure-cron-secret-change-in-production"
FOOTBALL_DATA_API_KEY="7979b2ac558f4cc7a322ffb917ef686d"
```

> **Nota:** El `AUTH_SECRET` y `CRON_SECRET` se quedan igual por ahora. Para producción, `CRON_SECRET` deberá cambiarse por un valor seguro real.

---

## FASE 3 — Limpiar migraciones y crear la migración PostgreSQL

Las 3 migraciones SQLite existentes en `prisma/migrations/` son incompatibles con PostgreSQL. Se reemplazan por una única migración inicial limpia.

### ⚠️ Detener el servidor de desarrollo antes de continuar (obligatorio en Windows)

```bash
# Ctrl+C en la terminal donde corre `npm run dev`
```

### 3.1 Eliminar las migraciones SQLite antiguas

```bash
rm -rf prisma/migrations
```

### 3.2 Crear la migración inicial para PostgreSQL

```bash
npx prisma migrate dev --name init
```

Este comando:
1. Conecta a Supabase usando `DIRECT_URL`
2. Crea el directorio `prisma/migrations/` de nuevo con una sola migración limpia
3. Aplica todas las tablas, enums e índices del schema actual a la BD de Supabase
4. Regenera el cliente Prisma automáticamente

Duración estimada: 20-40 segundos.

**Salida esperada:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "..."

Applying migration `20260327000000_init`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20260327000000_init/
    └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client
```

Si aparece algún error, ver sección **"Solución de problemas"** al final.

### 3.3 Popular la base de datos (seed)

```bash
npm run db:seed
```

Esto crea en Supabase:
- **47 asientos** distribuidos en zonas TV1, TV2 y PROYECTOR con sus posiciones exactas
- **1 usuario admin** → email: `ramoncaveroaras@gmail.com` / contraseña: `12345678`

**Salida esperada:**
```
🌱 Seeding database...
ℹ️  Teams are managed via football-data.org API sync. Skipping team creation.
✅ Created 47 seats
✅ Created admin user
🎉 Seeding completed!
```

> **Importante:** La contraseña del admin en el seed es `12345678`. Recuerda cambiarla desde el panel de administración antes de abrir la aplicación a usuarios reales.

---

## FASE 4 — Verificación local

### 4.1 Verificar con Prisma Studio

```bash
npx prisma studio
```

Se abrirá en `http://localhost:5555`. Comprueba:
- Tabla `Seat` → 47 registros con sus zonas y posiciones
- Tabla `AdminUser` → 1 registro con el email del admin
- Tablas `Event`, `Team`, `Reservation` → vacías (es correcto, los equipos se sincronizan desde la API)

### 4.2 Arrancar el servidor de desarrollo

```bash
npm run dev
```

Prueba:
1. **Login:** Ve a `http://localhost:3000/admin/login` → entra con `ramoncaveroaras@gmail.com` / `12345678`
2. **Sincronizar equipos:** Ve a `/admin/eventos` → botón "API" → "Sincronizar equipos" → debe importar equipos desde football-data.org a Supabase
3. **Crear evento:** Crea un evento de prueba desde sugerencias de la API
4. **Vista pública:** Ve a `http://localhost:3000/eventos/[id]` → verifica que el mapa de asientos carga

---

## FASE 5 — Preparar variables para Vercel (cuando se despliegue)

Cuando llegue el momento de desplegar en Vercel, estas son las variables de entorno que deberás añadir en **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variable | Valor | Entorno |
|---|---|---|
| `DATABASE_URL` | URL del pooler de Supabase (puerto 6543) | Production, Preview |
| `DIRECT_URL` | URL directa de Supabase (puerto 5432) | Production, Preview |
| `AUTH_SECRET` | Mismo que en `.env` local | Production, Preview |
| `CRON_SECRET` | Valor seguro nuevo (diferente al de desarrollo) | Production |
| `FOOTBALL_DATA_API_KEY` | La misma API key actual | Production, Preview |

> Los cron jobs en `vercel.json` ya están configurados. Vercel los ejecutará automáticamente tras el despliegue.

---

## Solución de problemas

### Error: "P1001 Can't reach database server"
- Verifica que las URLs en `.env` son correctas y no tienen espacios extra
- Comprueba que el proyecto de Supabase está activo (no en pausa por inactividad)

### Error durante `migrate dev` sobre migraciones existentes
Si Prisma detecta un estado inconsistente, ejecuta:
```bash
npx prisma migrate reset
```
Esto borra y recrea todo en la BD de Supabase. Como es una BD nueva y vacía, no hay nada que perder. Después vuelve al paso 3.2.

### Error: "SSL connection required"
Supabase requiere SSL. Añade al final de ambas URLs:
```
?sslmode=require
```
(La `DATABASE_URL` quedaría: `...postgres?pgbouncer=true&sslmode=require`)

### El seed falla con error de `unique constraint`
Significa que el seed ya se ejecutó antes parcialmente. Es seguro ejecutar:
```bash
npx prisma migrate reset
npm run db:seed
```

---

## Resumen de comandos (orden exacto)

```bash
# 0. Parar el servidor de desarrollo (Ctrl+C)

# 1. Actualizar schema.prisma (cambio manual — ver Fase 2.1)
# 2. Actualizar .env (cambio manual — ver Fase 2.2)

# 3. Eliminar migraciones SQLite
rm -rf prisma/migrations

# 4. Crear migración PostgreSQL y aplicarla a Supabase
npx prisma migrate dev --name init

# 5. Popular la base de datos
npm run db:seed

# 6. Verificar
npx prisma studio

# 7. Arrancar y probar
npm run dev
```

---

*Plan creado el 2026-03-27. Versión de Prisma: 6.19.2. Versión de Next.js: 16.1.5.*
