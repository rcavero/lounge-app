# TODO - The Lounge Beerhouse

Funcionalidades pendientes de implementación.

---

## Notificaciones y Cierre Automático

- [ ] **Cierre automático de reservas 2 horas antes del evento**
  - Cambiar estado del evento o bloquear nuevas reservas
  - Trigger automático basado en `eventDate`

- [ ] **Envío de resumen de reservas al cerrar**
  - Generar resumen con todas las reservas confirmadas
  - Integración con servicio de email (Resend, SendGrid, etc.)
  - Integración con WhatsApp Business API (opcional)
  - Incluir: lista de clientes, asientos reservados, ingresos totales

---

## Pasarela de Pagos

- [x] **Integración con Redsys** ✅
  - Sandbox configurado con credenciales públicas de prueba
  - Firma HMAC-SHA256 con `redsys-easy`
  - Webhook POST `/api/payments/notify` verifica firma y confirma/cancela reserva
  - Fallback en páginas OK/KO para desarrollo local (webhook no accesible desde localhost)
  - Estados de pago: PENDING → COMPLETED | FAILED

- [x] **Pantalla de éxito de pago** ✅
  - `/reserva/confirmacion/[orderId]`: resumen + descarga ticket PDF con QR

- [x] **Pantalla de error de pago** ✅
  - `/reserva/error`: cancela reserva y libera asientos + botón reintentar

- [ ] **Credenciales Redsys de producción**
  - Solicitar al banco alta de TPV Virtual
  - Sustituir `REDSYS_MERCHANT_CODE`, `REDSYS_SECRET_KEY` y `NEXT_PUBLIC_BASE_URL` en producción

---

## Gestión de Asientos

- [ ] **Renombrar IDs de asientos**
  - Cambiar nomenclatura para mejor comprensión del personal
  - Ejemplos: "Mesa 1 - Silla A", "Barra 3", "Proyector Fila 2"
  - Actualizar visualización en mapa y tickets

- [x] **Bloqueo de asientos por evento** ✅
  - Admin/Worker puede bloquear asientos desde `/admin/reservas/[id]/bloquear`
  - Plano interactivo: verde=disponible, gris=bloqueado, rojo=ocupado
  - Los asientos bloqueados aparecen como rojos (ocupados) al cliente

- [ ] **Crear asientos desde el editor**
  - Botón "Añadir asiento" en el editor de posiciones
  - Formulario: código, zona, capacidad
  - Posicionamiento drag-and-drop inicial

- [ ] **Eliminar asientos desde el editor**
  - Opción de eliminar asiento existente
  - Validación: no permitir eliminar si tiene reservas activas
  - Confirmación antes de eliminar

---

## Base de Datos de Equipos

- [ ] **Añadir equipos de las 5 grandes ligas**
  - La Liga (20 equipos)
  - Premier League (20 equipos)
  - Serie A (20 equipos)
  - Bundesliga (18 equipos)
  - Ligue 1 (18 equipos)

- [ ] **Añadir equipos de competiciones europeas**
  - Champions League (equipos adicionales no incluidos arriba)
  - Europa League (equipos adicionales)
  - Conference League (equipos principales)

- [ ] **Añadir selecciones nacionales**
  - Todas las selecciones europeas (55 UEFA)
  - Selecciones principales de Sudamérica (CONMEBOL)
  - Selecciones principales de otros continentes (USA, México, Japón, etc.)

- [ ] **Añadir competiciones**
  - Ligas domésticas principales
  - Champions League, Europa League, Conference League
  - Copa del Rey, FA Cup, Coppa Italia, DFB-Pokal, Coupe de France
  - Eurocopa, Mundial, Copa América, Nations League
  - Supercopa de Europa, Mundial de Clubes

- [ ] **Opción de crear equipo personalizado**
  - Formulario en la creación de evento
  - Campos: nombre, nombre corto, liga/competición, logo (URL)
  - Guardar en BD para uso futuro

---

## UX y Mensajes al Cliente

- [ ] **Información sobre descuento en consumiciones**
  - Mostrar mensaje claro: "El importe de tu reserva (X€) se descontará de tu ticket de consumiciones"
  - Visible en: selección de asientos, confirmación, ticket PDF

- [ ] **Advertencia de guardar ticket**
  - Mensaje destacado: "Guarda este ticket y muéstralo en el local para hacer efectiva tu reserva y el descuento"
  - Mostrar en: pantalla de confirmación, email de confirmación, ticket PDF
  - Icono de advertencia para mayor visibilidad

---

## Modificar competiciones

- [x] **Deportes manuales sin API** ✅
  - 11 deportes alternativos: Baloncesto 🏀, Rugby 🏉, Tenis 🎾, Moto GP 🏍️, Fórmula 1 🏎️, Billar 🎱, Dardos 🎯, Hockey 🏒, Ciclismo 🚴, Boxeo 🥊, Otros 🏅
  - Formulario con inputs de texto (sin BD de equipos); motor sports con campo único "Gran Premio"
  - Emoji como competición emblem y team logo en todas las vistas
  - Helpers: `isManualSport()`, `isMotorSport()`, `getSportEmoji()` en `competitions.ts`
  - Schema: `homeTeamName`/`awayTeamName` nullable en Event; FK de equipos nullable

- [ ] **Sincronizar Champions, Europa League, Eurocopa y Mundial desde la API**
  - En `COMPETITION_LEAGUES`, traer equipos reales desde football-data.org para estas competiciones

---

## Seguridad y Sesiones

- [ ] **Caducidad de sesión admin/worker**
  - Configurar tiempo máximo de sesión (ej: 8 horas)
  - Configurar tiempo de inactividad (ej: 30 minutos)
  - Mostrar aviso antes de expirar
  - Redirect automático a login al expirar
  - Opción "Recordarme" para extender sesión

---

## Infraestructura y DevOps

- [ ] **Migración a PostgreSQL**
  - Actualizar `schema.prisma` (provider: postgresql)
  - Configurar base de datos en Supabase/Neon/Railway
  - Script de migración de datos existentes
  - Actualizar variables de entorno

- [ ] **Implementar suite de tests**
  - Configurar Vitest o Jest
  - Tests unitarios para server actions
  - Tests de integración para flujos críticos (reserva, pago)
  - Tests E2E con Playwright (opcional)
  - Cobertura mínima objetivo: 70%

- [ ] **Despliegue a producción**
  - Configurar proyecto en Vercel
  - Variables de entorno de producción
  - Dominio personalizado
  - Configurar cron jobs (cierre automático, limpieza)
  - Monitorización y logs (Vercel Analytics, Sentry)
  - Backup automático de BD

---

## Prioridad Sugerida

### Alta (MVP Producción)
1. Migración a PostgreSQL
2. Credenciales Redsys de producción (banco)
3. Información descuento y advertencia ticket
4. Caducidad de sesión
5. Despliegue a producción

### Media (Post-lanzamiento)
6. Cierre automático + notificaciones
7. Renombrar IDs de asientos
8. Base de datos completa de equipos

### Baja (Mejoras futuras)
10. Crear/eliminar asientos desde editor
11. Equipo personalizado
12. Suite de tests completa

---

## Notas Técnicas

### Redsys
- Documentación: https://pagosonline.redsys.es/desarrolladores.html
- Entorno de pruebas disponible
- Requiere certificado SSL en producción

### Notificaciones
- **Email**: Considerar Resend (gratis hasta 100/día) o SendGrid
- **WhatsApp**: Requiere WhatsApp Business API (coste por mensaje)

### PostgreSQL
- **Supabase**: Tier gratuito generoso, buena DX
- **Neon**: Serverless, escala a cero
- **Railway**: Simple, $5/mes mínimo

---

*Última actualización: 2 de Abril de 2026*
