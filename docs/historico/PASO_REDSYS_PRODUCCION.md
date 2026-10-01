# Plan de acción — Paso de Redsys a entorno REAL (producción)

> **Contexto:** CaixaBank / Comercia Global Payments confirmó por correo el 2026-05-17 que
> el entorno real del TPV virtual de The Lounge Beerhouse (FUC `<FUC de producción>`) está disponible.
> Este documento es el plan para activar los pagos reales en la rama `main` manteniendo
> `testing` en el entorno sandbox.

---

## 1. Análisis previo

El proyecto ya está arquitecturado para esta migración:

- El código de Redsys es 100% dirigido por variables de entorno (`src/lib/redsys.ts`).
- La lógica ya distingue producción mediante la variable `REDSYS_ENV`.
- Los archivos `.env*` están en `.gitignore` (excepto `.env.example`) → los secretos nunca
  llegan a git.

### Decisión arquitectónica clave

La separación **`main` = producción / `testing` = pruebas NO se hace con código distinto
por rama**, sino con **variables de entorno por entorno en Vercel**:

- `main` → despliegue **Production** en Vercel → variables de scope **Production**.
- `testing` → despliegue **Preview** en Vercel → variables de scope **Preview**.

Las ramas `main` y `testing` quedan **idénticas en código**. Motivos:

- Evita conflictos de merge constantes y drift entre ramas.
- Evita el riesgo de filtrar la clave de producción a git.
- El proyecto **ya funciona así** para la base de datos (Supabase distinto por entorno).

> ⚠️ "Rama `main` = producción" **no** significa poner la clave real en un `.env` local.
> La clave de producción vive **solo** en Vercel (scope Production). En local, incluso en
> la rama `main`, se sigue usando sandbox.

### Datos confirmados por el correo y el PDF del banco

| Dato | Valor producción | Estado actual en el repo |
|------|------------------|--------------------------|
| `REDSYS_MERCHANT_CODE` (FUC) | `<FUC de producción>` | `<FUC de producción>` — igual |
| `REDSYS_TERMINAL` | `1` | `001` — a alinear |
| `REDSYS_MERCHANT_CURRENCY` | `978` (EUR) | hardcodeado `978` — OK |
| `REDSYS_TRANSACTIONTYPE` | `0` | hardcodeado `0` — OK |
| Clave de firma SHA-256 | **NO viene en el correo** | obtener del portal Canales |
| URL del entorno | `sis.redsys.es` (real) | se activa con `REDSYS_ENV=production` |

La clave de firma de producción **es distinta de la de pruebas** y, por seguridad, el banco
no la envía por correo: se obtiene manualmente en `https://canales.redsys.es/lacaixa`.

---

## 2. Plan de acción por fases

### Fase 1 — Obtener la clave SHA-256 de producción · *manual*

1. Acceder a `https://canales.redsys.es/lacaixa` con usuario `<FUC de producción>`.
2. Contraseña: pulsar **"¿Ha olvidado su contraseña?"** → llega al correo autorizado
   (el correo autorizado de la propietaria). Requiere coordinación con Susana para el acceso.
3. **Administración** (icono maletín) → **Comercio** → **Buscar** → botón **Detalles**
   del terminal `1`.
4. En "Datos de configuración" → **Ver clave** → introducir la contraseña de Canales.
5. Copiar la clave **SHA-256 (la larga)** — se muestra durante 10 segundos.
6. Guardarla en un gestor de contraseñas seguro.

> ⚠️ **Nunca** guardar esta clave en git, ni en `.env` local, ni en archivos de
> documentación. Solo en Vercel (scope Production) y en el gestor seguro.

- [x] Clave SHA-256 de producción obtenida y guardada de forma segura.

### Fase 2 — Endurecer el flujo de producción · *código (recomendado antes del go-live)*

**Problema detectado:** con `REDSYS_ENV=production`, la página de confirmación
(`src/app/reserva/confirmacion/[orderId]/page.tsx`) hace `notFound()` si la reserva aún
no está `CONFIRMED`. Redsys redirige el navegador del cliente a la URL OK **en paralelo**
al webhook; si el navegador llega antes que el webhook (carrera habitual), **el cliente
ve un error 404 justo después de pagar correctamente**.

**Propuesta:** en modo producción, si la reserva sigue `PENDING`, renderizar un componente
cliente "Procesando tu pago…" que sondee el estado cada ~2 s (hasta ~40 s) y muestre el
ticket al confirmarse, o un mensaje elegante si expira el sondeo — en lugar de `notFound()`.
No altera el modelo de seguridad: el webhook sigue siendo la única fuente de verdad.

- [ ] Implementada la pantalla de "procesando pago" para el camino de producción.

### Fase 3 — Configurar variables en Vercel · *manual*

En Vercel → proyecto → **Settings → Environment Variables**, **solo en scope `Production`**:

| Variable | Valor | Scope |
|----------|-------|-------|
| `REDSYS_ENV` | `production` | **Production únicamente** |
| `REDSYS_SECRET_KEY` | clave SHA-256 real (Fase 1) | Production |
| `REDSYS_MERCHANT_CODE` | `<FUC de producción>` | Production |
| `REDSYS_TERMINAL` | `1` | Production |
| `NEXT_PUBLIC_BASE_URL` | `https://lounge-app-neon.vercel.app` | Production |

> ⚠️ **Crítico:** `REDSYS_ENV` **NO debe existir en scope Preview**. Si se filtra a Preview,
> la rama `testing` intentaría usar las URLs reales con la clave sandbox → error `SIS0042`.
> El scope Preview se queda exactamente como está (sandbox).

- [ ] Variables de Redsys configuradas en Vercel scope Production.
- [ ] Verificado que `REDSYS_ENV` **no** existe en scope Preview.

### Fase 4 — Verificar configuración del terminal en Canales · *manual*

En el detalle del terminal real, comprobar:

- Notificación: **"ON-LINE HTTP + Email"** activa.
- Sincronización: **"Síncrona"**.
- "URL del comercio" coherente con el dominio de producción.

- [ ] Configuración del terminal real verificada en Canales.

### Fase 5 — Redesplegar `main`

Hacer push (o un commit vacío) a `main` para que Vercel reconstruya con las nuevas variables:

```bash
git checkout main
git commit --allow-empty -m "ci: redeploy with production Redsys credentials"
git push origin main
```

- [ ] Redespliegue de `main` completado en Vercel.

### Fase 6 — Pruebas en entorno real · *según PDF del banco, apartado 3*

1. **Pago denegado** — tarjeta de prueba del PDF:
   - Número `4548 8120 4940 0004`, caducidad `12/20`, CVV `123`, CIP `123456`.
   - Verificar que la reserva queda `CANCELLED` y los asientos se liberan.
2. **Pago aceptado** — **no existe tarjeta de prueba para operaciones autorizadas en real**:
   - Usar una tarjeta real, preferiblemente en un evento de importe mínimo (10 €).
   - Devolver el cargo después desde el portal Canales (guía "Consultas y devoluciones
     en Canales.pdf").
3. En ambos casos, verificar en **Vercel → Logs**:
   ```
   [Payment notify] orderId=XXXX response=0000 success=true
   [Payment notify] Reservation XXXX confirmed
   ```

- [ ] Pago denegado probado con éxito.
- [ ] Pago aceptado probado con tarjeta real y devuelto desde Canales.
- [ ] Logs del webhook verificados en Vercel.

### Fase 7 — Actualizar documentación · *código*

- Actualizar `REDSYS.md` (resolver los placeholders del "Paso 1" con los valores ya
  conocidos y corregir el terminal a `1`).
- Actualizar `.env.example`.
- Corregir la nota obsoleta de `CLAUDE.md`, punto 6 ("módulo de pagos sin implementación"
  — ya está implementado).

- [ ] Documentación del repositorio actualizada.

---

## 3. Riesgos y consideraciones

- **Terminal `001` vs `1`:** el correo asigna el terminal `1`. Redsys suele tolerar los
  ceros a la izquierda, pero lo profesional es enviar exactamente lo asignado. Recomendado:
  `1` en producción, y alinear `testing` por consistencia.

- **Webhook = única fuente de verdad en producción:** si el webhook fallara por completo,
  el cliente quedaría cobrado con la reserva en `PENDING`, y el cron de limpieza la
  expiraría a los 5 minutos liberando los asientos (`src/app/api/cron/cleanup/route.ts`).
  Es poco probable (la notificación de Redsys es síncrona y rápida), pero conviene
  monitorizar los logs en los primeros pagos reales; la notificación "Email" del banco
  sirve de respaldo manual.

- **Entorno `testing` con clave genérica:** `.env` y `.env.testing` usan la clave pública
  genérica de Redsys (`sq7Hjr…`), no la clave **sandbox específica** del comercio
  `<FUC de producción>`. Para que las pruebas en `testing` sean fiables conviene obtener también la
  clave SHA-256 *de pruebas* del portal. Es secundario y no bloquea el paso a producción.

- **Local siempre en sandbox:** la clave de producción vive solo en Vercel scope
  Production. En local se usa siempre sandbox, incluso estando en la rama `main`.

---

## 4. Decisiones confirmadas

1. **Dominio de producción:** `https://lounge-app-neon.vercel.app` (alias de Vercel).
   Es el valor de `NEXT_PUBLIC_BASE_URL` y la base del webhook `/api/payments/notify`.
2. **Alcance:** la **Fase 2** (corrección de la condición de carrera del 404) se incluye
   en este trabajo.

---

## 5. Reparto de tareas

| Fase | Responsable | Tipo |
|------|-------------|------|
| 1 — Obtener clave SHA-256 | Usuario / Susana | Manual (portal Canales) |
| 2 — Endurecer flujo producción | Claude | Código |
| 3 — Variables en Vercel | Usuario | Manual (panel Vercel) |
| 4 — Verificar terminal en Canales | Usuario | Manual (portal Canales) |
| 5 — Redesplegar `main` | Usuario / Claude | Git |
| 6 — Pruebas en real | Usuario | Manual |
| 7 — Actualizar documentación | Claude | Código |
