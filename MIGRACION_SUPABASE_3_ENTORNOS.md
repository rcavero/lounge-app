# Migración a Supabase — 3 entornos (dev, testing, producción)

## Estado de partida

```
Ramas:    main / testing / dev (todas en el mismo commit)
Schema:   SQLite (provider = "sqlite") en dev
          PostgreSQL pendiente en testing y main
BD local: prisma/dev.db
```

---

## FASE 1 — Crear cuenta y proyectos en Supabase

> **Todo manual. Lo haces tú en el navegador.**

### 1.1 Crear cuenta
- Ve a **supabase.com** → "Start your project" → regístrate con GitHub

### 1.2 Crear proyecto testing
- "New project"
- **Name:** `lounge-app-testing`
- **Password:** genera una contraseña fuerte (≥20 caracteres). **Guárdala ahora.**
- **Region:** West EU (Ireland)
- Espera ~2 minutos

### 1.3 Crear proyecto producción
- Mismo proceso
- **Name:** `lounge-app-prod`
- **Password:** contraseña diferente a la de testing. **Guárdala ahora.**
- **Region:** West EU (Ireland)

### 1.4 Obtener las URLs de cada proyecto

Para **cada uno** de los dos proyectos, ve a:
**Project Settings → Database → Connection string**

Copia estas dos URLs:

| Nombre | Sección | Puerto | Para qué se usa |
|---|---|---|---|
| `DATABASE_URL` | Connection pooling → Transaction | **6543** | App en Vercel + queries locales |
| `DIRECT_URL` | Direct connection | **5432** | Solo migraciones de Prisma |

Al final tendrás **4 URLs** en total (2 por proyecto).

---

## FASE 2 — Configurar el entorno testing

> **Lo hacemos juntos. Dev server parado.**

### 2.1 Cambiar a la rama testing
```bash
git checkout testing
```

### 2.2 Actualizar `prisma/schema.prisma`

Cambiar el bloque `datasource db` de sqlite a postgresql:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### 2.3 Crear el `.env` para testing

Poner en `.env` las URLs del proyecto `lounge-app-testing`:

```env
DATABASE_URL="postgresql://postgres.XXXX:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.XXXX:[PASSWORD]@db.XXXX.supabase.co:5432/postgres"
AUTH_SECRET="***REMOVED***"
CRON_SECRET="testing-cron-secret-change-this"
FOOTBALL_DATA_API_KEY="7979b2ac558f4cc7a322ffb917ef686d"
```

Guarda también este contenido como `.env.testing` (copia de seguridad para cuando estés en otra rama y necesites operar sobre esta BD).

### 2.4 Eliminar las migraciones SQLite antiguas
```bash
rm -rf prisma/migrations
```

### 2.5 Crear la migración PostgreSQL y aplicarla
```bash
npx prisma migrate dev --name init
```

Conecta a Supabase testing, crea `prisma/migrations/` limpio y aplica todo el schema.

### 2.6 Popular la base de datos
```bash
npm run db:seed
```

Crea 47 asientos + usuario admin (`ramoncaveroaras@gmail.com` / `12345678`).

### 2.7 Verificar
```bash
npx prisma studio
```

Comprueba: 47 registros en `Seat`, 1 en `AdminUser`, resto de tablas vacías.

### 2.8 Arrancar y probar en local contra testing
```bash
npm run dev
```

1. Login en `http://localhost:3000/admin/login` con `ramoncaveroaras@gmail.com` / `12345678`
2. Sincronizar equipos: `/admin/eventos` → botón "API" → "Sincronizar equipos"
3. Crear un evento de prueba
4. Verificar que el mapa de asientos carga en `/eventos/[id]`

### 2.9 Hacer commit en la rama testing
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "chore: migrate to postgresql for testing environment"
```

---

## FASE 3 — Configurar el entorno producción

> **Dev server parado. Continuamos.**

### 3.1 Cambiar a la rama main
```bash
git checkout main
```

### 3.2 Traer los cambios de testing
```bash
git merge testing
```

El `schema.prisma` ya llega con postgresql desde testing. Las migraciones también.

### 3.3 Actualizar `.env` con las URLs de producción

Sustituir el contenido de `.env` con las URLs del proyecto `lounge-app-prod`:

```env
DATABASE_URL="postgresql://postgres.XXXX:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.XXXX:[PASSWORD]@db.XXXX.supabase.co:5432/postgres"
AUTH_SECRET="GENERA-UN-VALOR-NUEVO-DIFERENTE-AL-DE-TESTING"
CRON_SECRET="prod-cron-secret-diferente-al-de-testing"
FOOTBALL_DATA_API_KEY="7979b2ac558f4cc7a322ffb917ef686d"
```

> `AUTH_SECRET` en producción debe ser un valor nuevo. Genera uno con `openssl rand -hex 32` desde Git Bash.

### 3.4 Aplicar la migración a producción
```bash
npx prisma migrate deploy
```

`migrate deploy` (no `dev`) aplica las migraciones existentes sin crear nuevas. Es el comando correcto para producción.

### 3.5 Popular la base de datos de producción
```bash
npm run db:seed
```

Igual que en testing: 47 asientos + usuario admin. **Cambia la contraseña del admin desde el panel antes de abrir la app a usuarios reales.**

### 3.6 Verificar
```bash
npx prisma studio
```

Misma comprobación: 47 asientos, 1 admin, resto de tablas vacías.

---

## FASE 4 — Configurar Vercel

> **Manual en el navegador.**

### 4.1 Conectar el repositorio
- Ve a **vercel.com** → "Add New Project"
- Importa el repositorio de GitHub
- Framework: Next.js (lo detecta automáticamente)
- No configures variables todavía — primero despliega, luego añade las variables

### 4.2 Variables de entorno para producción

En **Vercel → Project → Settings → Environment Variables**, añade estas variables marcando **solo "Production"**:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | URL pooler de `lounge-app-prod` (puerto 6543) |
| `DIRECT_URL` | URL directa de `lounge-app-prod` (puerto 5432) |
| `AUTH_SECRET` | El mismo que en el `.env` de producción |
| `CRON_SECRET` | El mismo que en el `.env` de producción |
| `FOOTBALL_DATA_API_KEY` | Tu API key |
| `NEXT_PUBLIC_BASE_URL` | `https://tu-dominio.vercel.app` |

### 4.3 Variables de entorno para testing

Añade las mismas variables marcando **solo "Preview"**, con los valores del proyecto `lounge-app-testing`.

Para que Vercel use estas variables solo en la rama `testing` (no en todas las ramas de preview), en cada variable selecciona **"Custom branch"** y escribe `testing`.

| Variable | Valor |
|---|---|
| `DATABASE_URL` | URL pooler de `lounge-app-testing` (puerto 6543) |
| `DIRECT_URL` | URL directa de `lounge-app-testing` (puerto 5432) |
| `AUTH_SECRET` | El de testing |
| `CRON_SECRET` | El de testing |
| `FOOTBALL_DATA_API_KEY` | La misma API key |
| `NEXT_PUBLIC_BASE_URL` | `https://tu-proyecto-git-testing.vercel.app` |

### 4.4 Configurar los deployments por rama

En **Vercel → Project → Settings → Git**:
- **Production branch:** `main`
- Vercel desplegará automáticamente la rama `testing` como Preview cada vez que hagas push

---

## FASE 5 — Verificación end-to-end

### Testing
1. Haz push de la rama `testing` a GitHub
2. Vercel despliega automáticamente
3. Entra en la URL de preview → login con `ramoncaveroaras@gmail.com` / `12345678`
4. Sincroniza equipos → crea un evento de prueba → crea una reserva de prueba
5. Verifica en el Supabase dashboard (Table Editor) que los datos aparecen

### Producción
1. Haz push de `main` a GitHub (o merge desde testing)
2. Vercel despliega en producción
3. Misma verificación
4. **Cambia la contraseña del admin desde `/admin/usuarios`**

---

## Flujo de trabajo habitual tras la migración

```
# Nuevo desarrollo
git checkout dev
git checkout -b feat/mi-funcionalidad
# ... trabajas con SQLite local ...
git commit
git checkout dev
git merge feat/mi-funcionalidad

# Pasar a testing
git checkout testing
git merge dev
# Si hay conflicto en schema.prisma → conservar la versión postgresql de testing
# Si hay nuevos modelos/campos → ejecutar migración (ver tabla más abajo)
git push  # Vercel despliega automáticamente en preview

# Pasar a producción (cuando testing está validado)
git checkout main
git merge testing
# Si hubo migraciones nuevas → npx prisma migrate deploy (con .env de prod activo)
git push  # Vercel despliega en producción
```

### Cuándo ejecutar migraciones de Prisma

| Situación | Rama | `.env` activo | Comando |
|---|---|---|---|
| Añadir campo/modelo en desarrollo | `dev` | SQLite local | `npx prisma db push` |
| Llevar ese cambio a testing | `testing` | `.env.testing` (Supabase testing) | `npx prisma migrate dev --name descripcion` |
| Llevar a producción | `main` | `.env` (Supabase prod) | `npx prisma migrate deploy` |

> **Nota sobre el `.env` activo:** como `.env` está en `.gitignore`, su contenido no viaja con las ramas. Cuando cambies de rama para ejecutar migraciones, asegúrate de que `.env` tiene las credenciales correctas para ese entorno. Guarda siempre una copia como `.env.testing` para no perder las URLs de testing.

---

## Solución de problemas

### Error: "P1001 Can't reach database server"
- Verifica que las URLs en `.env` son correctas y no tienen espacios extra
- Comprueba que el proyecto de Supabase está activo (no en pausa por inactividad)

### Error durante `migrate dev` sobre migraciones existentes
```bash
npx prisma migrate reset
```
Borra y recrea todo en la BD de Supabase. Como es nueva y vacía, no hay nada que perder. Vuelve al paso 2.5.

### Error: "SSL connection required"
Añade al final de ambas URLs:
```
?sslmode=require
```
La `DATABASE_URL` quedaría: `...postgres?pgbouncer=true&sslmode=require`

### El seed falla con error de `unique constraint`
El seed ya se ejecutó antes parcialmente. Es seguro ejecutar:
```bash
npx prisma migrate reset
npm run db:seed
```

---

*Plan creado: 2026-04-16. Prisma: 6.19.2. Next.js: 16.1.5.*
