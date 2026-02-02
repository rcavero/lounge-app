# Desarrollo - The Lounge Beerhouse

## Estado Actual del Proyecto

**Última actualización:** 2 de Febrero de 2026

El proyecto es una aplicación web para gestionar reservas de asientos en un bar deportivo (The Lounge Beerhouse) en Valencia. Permite a los clientes reservar asientos para ver eventos deportivos y a los administradores gestionar eventos, reservas y usuarios.

---

## Funcionalidades Implementadas

### 1. Sistema de Autenticación
- Login de administradores con email y contraseña
- Sesiones con iron-session (cookies seguras)
- Roles de usuario: `ADMIN` y `WORKER`
- Control de acceso basado en roles

### 2. Gestión de Eventos
- CRUD completo de eventos deportivos
- Selección de equipos (home/away) con logos
- Configuración de pantallas (PROYECTOR, TV1, TV2)
- Estados: UPCOMING, LIVE, FINISHED, CANCELLED

### 3. Gestión de Reservas
- Visualización de reservas por evento
- Creación de reservas desde el panel admin
- Mapa interactivo de asientos con drag & drop
- Acordeón de "Reservas de eventos pasados" (últimos 35 días)
- Acordeón de "Informes de reservas" (solo ADMIN) con generación de PDFs

### 4. Gestión de Usuarios (Nuevo)
- Listado de usuarios con tarjetas (nombre, email, rol)
- Crear usuario con validación de contraseña (mínimo 8 caracteres)
- Editar usuario (email, contraseña opcional, nombre, rol)
- Eliminar usuario con modal de confirmación
- Toggle de visibilidad de contraseña

### 5. Gestión de Asientos
- Editor visual de posiciones de asientos
- Drag & drop para posicionar asientos
- Configuración de etiquetas de zonas

### 6. Sistema de Limpieza Automática
- Endpoint `/api/cron/cleanup` para eliminar eventos > 90 días
- Configurado en `vercel.json` para ejecutar diariamente a las 3:00 AM

---

## Roles y Permisos

| Funcionalidad | ADMIN | WORKER |
|--------------|-------|--------|
| Configurar eventos | ✅ | ❌ |
| Administrar reservas | ✅ | ✅ |
| Ver informes PDF | ✅ | ❌ |
| Configurar asientos | ✅ | ❌ |
| Administrar usuarios | ✅ | ❌ |

---

## Usuarios de Prueba

| Email | Contraseña | Rol | Nombre |
|-------|------------|-----|--------|
| ramoncaveroaras@gmail.com | (existente) | ADMIN | Ramón |

---

## Tareas Pendientes / Ideas Futuras

### Alta Prioridad
- [ ] Integración con pasarela de pago (Redsys)
- [ ] Sistema de notificaciones por email
- [ ] Vista pública para clientes (selección de asientos)

### Media Prioridad
- [ ] Dashboard con estadísticas
- [ ] Exportar datos a Excel
- [ ] Sistema de descuentos/promociones

### Baja Prioridad
- [ ] App móvil (React Native)
- [ ] Integración con calendarios (Google Calendar)
- [ ] Sistema de fidelización de clientes

---

## Problemas Conocidos

1. **Prisma Generate en Windows**: Al tener el servidor de desarrollo corriendo, `npx prisma generate` puede fallar con error EPERM. Solución: detener el servidor, eliminar archivos `.node` en `src/generated/prisma/`, y volver a generar.

2. **Navegación después de Server Actions**: Se usa `window.location.href` en lugar de `router.push` para navegación confiable después de crear/editar usuarios.

---

## Comandos Útiles

```bash
# Desarrollo
npm run dev

# Base de datos
npm run db:push          # Sincronizar schema
npm run db:studio        # Abrir Prisma Studio
npm run db:seed          # Ejecutar seed
npx prisma generate      # Regenerar cliente

# Build
npm run build
npm run start

# Backup de BD
cp prisma/dev.db backups/dev.db.backup.$(date +%Y%m%d_%H%M%S)
```

---

## Variables de Entorno Requeridas

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="tu-secreto-para-sesiones"
CRON_SECRET="tu-secreto-para-cron-jobs"
```

---

## Estructura de Backups

Los backups de la base de datos se guardan en `/backups/` con formato:
```
dev.db.backup.YYYYMMDD_HHMMSS
```

---

## Notas para Continuar el Desarrollo

1. El servidor de desarrollo corre en `http://localhost:3000`
2. La base de datos es SQLite en `prisma/dev.db`
3. Los tipos de Prisma se generan en `src/generated/prisma/`
4. Las sesiones se manejan con iron-session y el rol se obtiene de la BD si no está en la sesión
5. Los Server Actions están en `src/modules/*/actions/index.ts`
6. Los componentes de UI reutilizables están en `src/components/ui/`
