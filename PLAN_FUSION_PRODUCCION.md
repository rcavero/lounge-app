# Plan: llevar `academic` a `testing` y después a producción (`main`)

> Estado comprobado el 2026-10-01 con `git` en solo lectura. Este documento se guarda en el repo
> como `PLAN_FUSION_PRODUCCION.md` (paso 0.1) para comentarlo con la dueña y con tu compañero.
> Al cerrar la fusión se mueve a `docs/historico/`.

## Contexto

Desde el 21 de septiembre hay dos líneas de trabajo. `main` es producción y `testing` es su
preview. Las dos están congeladas, salvo dos excepciones: el commit de docstrings de la Fase −1 y
el hotfix de la carrera de asientos. `academic` acumula la entrega del máster, de P0 a P12: tests,
capa de dominio, arreglos de dinero, seguridad, usuarios, skeletons y documentación. Todo está
verificado por ti en la preview de `academic`.

Quieres llevar todo eso a `testing`, comprobarlo allí y después pasarlo a `main`, con tres
condiciones:

- riesgo mínimo;
- rollback sencillo;
- el menor número posible de acciones tuyas.

---

## 1. Estado real de las ramas

| Rama | En GitHub | En local | Nota |
|---|---|---|---|
| `main` | `4ec153e` (hotfix de la carrera) | `12b933d` | **Local desfasada**: le falta el hotfix |
| `testing` | `adf7594` (el mismo hotfix) | `c337e29` | **Local desfasada**: le falta el hotfix |
| `academic` | `c42c0b3` | `86feffc` | Dos commits locales sin subir, solo docs (`MASTER_IA.md` y el documento de IA) |
| `dev` | `28e866a` (junio) | igual | Rama antigua de la época SQLite. Fuera de este plan |

Hallazgos:

1. **`main` y `testing` tienen exactamente el mismo contenido**: el mismo árbol, `71ccf78`. Sus
   historias, en cambio, van en paralelo. `12b933d`/`c337e29` y `4ec153e`/`adf7594` son parejas
   de commits iguales, hechos por cherry-pick.
2. **`academic` sale de `testing`** en `c337e29` y le saca **136 commits**: 282 ficheros, +25.881
   y −7.190 líneas. Solo le falta `adf7594`, cuyo arreglo ya contiene a su manera.
3. **La fusión, simulada con `git merge-tree`, da un único conflicto**:
   `src/modules/payments/actions/index.ts`. Era el conflicto que se esperaba. Se resuelve con la
   versión de `academic`, que lleva el mismo arreglo de la carrera y además RCA-276/277/285. Con
   eso, **el resultado es idéntico byte a byte a `academic`**: lo único que `testing` cambió
   desde que se separaron es ese fichero.

## 2. Qué cambia al fusionar

### 2.1 Migraciones: dos, las dos aditivas y ya probadas con el código antiguo

| Migración | Qué hace | Testing | Producción |
|---|---|---|---|
| `20260925120000_add_reservation_access_token` | `ALTER TABLE "Reservation" ADD COLUMN "accessToken" TEXT` (anulable, sin DEFAULT) | Aplicada el 25-sep | **Pendiente** |
| `20260928190219_add_login_attempt` | `CREATE TABLE "LoginAttempt"` (sin relaciones) | Aplicada el 28-sep | **Pendiente** |

Que el código viejo funcione con ellas no es una suposición. `academic` comparte base con
`testing`, así que **la preview de `testing` lleva días con el código antiguo sobre una base que
ya tiene las dos migraciones**. En testing no hay que migrar nada.

### 2.2 Dependencias y configuración

- **Las dependencias de ejecución son idénticas**: Next 16.1.5, React 19.2.3, Prisma 6.19.2,
  iron-session 8.0.4, redsys-easy 5.3.2, jsPDF 2.5.2 y las demás. Comparado en el
  `package-lock.json` de las dos ramas.
- Solo cambian las `devDependencies`: Vitest, Playwright, Testing Library, Prettier, Husky,
  lint-staged y dotenv-cli.
- `engines.node: 24.x` y `.nvmrc` 24.21.0. Producción ya usa Node 24.
- `"prepare": "husky"`. En Vercel no hace nada, y lo demuestran todas las builds de la preview de
  `academic`.
- **Ninguna variable de entorno nueva** para la app: el código lee las mismas diez.
  `SEED_ADMIN_*` y `DB_ENV` solo las usan los scripts.
- `next.config.ts` añade cabeceras de seguridad (`frame-ancestors 'none'`, `X-Frame-Options:
  DENY` y tres más).
- `vercel.json` no cambia: los mismos dos crons.

### 2.3 Cambios de funcionalidad, según quién los nota

- **Clientes**:
  - el servidor aplica la ventana de 48 h a 4 h y el estado del evento. Por enlace directo, un
    evento cerrado muestra una pantalla de «reservas cerradas»;
  - un pago que llega tarde recupera sus asientos o queda «para devolver», y el cliente ve el
    aviso;
  - las URL de vuelta llevan una llave (`&t=`). Los enlaces antiguos siguen funcionando;
  - hay pantallas de carga y animaciones.
- **Personal (WORKER)**:
  - tiene que **volver a iniciar sesión una vez**;
  - ya no entra por URL en las páginas del ADMIN;
  - conserva las reservas y el bloqueo de asientos.
- **La dueña (ADMIN)**:
  - también vuelve a iniciar sesión;
  - en Usuarios no puede editar a otro ADMIN;
  - la contraseña se cambia con un botón y un modal;
  - crear o ascender a un ADMIN le pide su propia contraseña;
  - el último ADMIN no se puede borrar;
  - aparece el aviso «Pagos a devolver», con el botón «Ya está devuelto».
- **Login**: 5 fallos en 15 minutos **por IP** bloquean el acceso, y ahora el contador se guarda en
  la base. Todo el bar comparte IP: si alguien falla 5 veces, nadie del local puede entrar en 15
  minutos (ver riesgo 4).

### 2.4 Arquitectura (para tu compañero)

- **Reglas de negocio en `src/modules/*/domain/`**, como módulos puros: importes, solape,
  caducidad, disponibilidad, ventana, meses de informe, títulos y resultado del pago. Las server
  actions quedan como adaptadores.
- **Lo que no puede ser endpoint sale de `"use server"`** a `lib/` planos: confirmar y cancelar
  desde las páginas de vuelta, la caducidad, `initializeSeatsForEvent`, el recibo y la llave.
- **La sesión se comprueba contra la base en cada petición del panel** (`auth/lib/session-data.ts`),
  con una huella de la contraseña dentro de la cookie. El rol se lee de la base.
- **Roles en el servidor**: `requireAdmin` en todas las acciones del ADMIN, y
  `redirectUnlessAdmin` en sus páginas.
- La suite y las herramientas:
  - 389 tests unitarios y de componentes, 231 de integración y 62 E2E;
  - CI en GitHub Actions, sin secretos;
  - Prettier y ESLint en el pre-commit;
  - Postgres en Docker para local y tests;
  - un `.env` por base de datos, con `DB_ENV`.
- Los planes antiguos de la raíz pasan a `docs/historico/`. Hay docs nuevas: `README`,
  `CHANGELOG`, `docs/` y 7 ADR.

## 3. Riesgos y cómo se cubren

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| 1 | Resolver mal el conflicto de `payments/actions` | Alto: es el cobro | Se coge la versión de `academic` y se exige `git diff academic testing` **vacío** antes de subir. Lo que llega a testing es exactamente lo verificado en la preview de `academic` |
| 2 | Desplegar el código antes que las migraciones | Alto: el código nuevo escribe `accessToken` y `LoginAttempt` | Orden fijo: **migración → comprobación → push**. Al revés no se hace |
| 3 | Todo el personal pierde la sesión | Bajo, pero molesta en pleno servicio | Hacerlo fuera del horario del bar, con aviso previo (texto en el anexo) |
| 4 | Bloqueo del login para todo el bar (IP compartida) | Medio: 15 min sin panel | Avisarlo. Un login correcto antes del 5.º fallo pone el contador a cero. Si hay bloqueo: esperar 15 min, o borro esa fila de `LoginAttempt` con tu OK |
| 5 | `frame-ancestors 'none'`: una web que incruste las reservas en un iframe deja de verlas | Medio | Comprobar la web del bar antes del paso a producción. Si la incrusta, se ajusta la cabecera antes de subir |
| 6 | `CRON_SECRET` de producción igual al literal de las guías antiguas | Medio: cualquiera lanzaría la limpieza | **Rotarlo en Vercel (Production) antes del push a `main`**: el propio despliegue recoge el valor nuevo |
| 7 | Desfase de versiones: un cliente con la página abierta durante el despliegue pulsa RESERVAR y la server action ya no existe en el build nuevo | Bajo-medio: error y tiene que recargar | Desplegar con poco tráfico. Justo antes, comprobar que hay **0 reservas PENDING** (caducan en 5 min) |
| 8 | Despliegue fallido en Vercel: el almacenamiento de funciones está casi lleno | Bajo: un despliegue fallido no sustituye al que está | Antes, miro el uso en Vercel (solo leyendo). Si está al límite, te propongo qué despliegues de preview viejos borrar. Si falla, producción sigue con el código anterior, que es compatible con la base ya migrada |
| 9 | El cron de limpieza nuevo solo corre de verdad en producción (las previews no ejecutan crons) | Bajo | Lanzarlo a mano en testing con `curl` (Fase 2) |
| 10 | El incidente de julio (pool de conexiones) **sigue sin arreglar**. No empeora: la parte pública hace las mismas consultas | Alto si coincide con una apertura masiva | No desplegar justo antes de abrir un evento de mucha demanda. Los arreglos P0 siguen pendientes, aparte de este plan |
| 11 | Las ramas locales `main` y `testing` están desfasadas | Medio: fusionar sobre una base vieja | Lo primero, `git fetch`, y alinearlas con `origin`. El push a `main` va con `--ff-only`, que falla si algo no cuadra |

## 4. Estrategia de ramas, y por qué así

```
            4ec153e (main hoy) ─────────────┐
                                            ▼
 adf7594 (testing hoy) ──► M1 "main en testing" (sin cambios de contenido)
                                            │
 academic (86feffc + plan) ────────────────►M2 "academic en testing" (1 conflicto → versión academic)
                                            │
                          testing = M2 ──► main avanza a M2 (fast-forward) ──► academic avanza a M2
```

1. **M1: fusionar `main` en `testing`.** El merge sale limpio y no cambia ni un byte: los árboles
   ya son iguales. Solo une las dos historias paralelas, para que `main` pueda avanzar en
   *fast-forward*.
2. **M2: fusionar `academic` en `testing`** con `--no-ff`. El conflicto se resuelve con la versión
   de `academic`, y **`git diff academic testing` tiene que salir vacío**.
3. **`main` avanza en fast-forward hasta M2.** No hay merge nuevo, ni conflicto que resolver otra
   vez: **producción despliega exactamente el mismo commit (mismo SHA) que se probó en testing.**
4. **`academic` avanza también hasta M2**, y las tres ramas quedan en el mismo commit. A partir de
   ahí se sigue trabajando en `academic` (lo decidiste el 2026-10-01), y el flujo es `academic` →
   `testing` → `main`, siempre en fast-forward.

Para el rollback hay **etiquetas anotadas**, que se suben a GitHub:

- `pre-fusion-main` → `4ec153e`;
- `pre-fusion-testing` → `adf7594`;
- `entrega-master-p12` → la punta de `academic` antes de fusionar.

Los SHA viejos no se pierden de todas formas: siguen siendo antecesores de M2.

---

## 5. Ejecución

Cada fase termina en una **puerta**: si algo no cuadra, se para ahí. Antes de cada push a
`testing` o a `main` te pido el OK explícito.

### Fase 0 · Preparación (yo, en local, sin push)

1. Guardar este plan como `PLAN_FUSION_PRODUCCION.md` en la raíz y commitearlo en `academic`,
   formateado con Prettier, porque `format:check` también revisa los `.md`.
2. `git status` limpio y `git fetch origin --prune`.
3. Alinear las ramas locales: `git branch -f main origin/main` y
   `git branch -f testing origin/testing`.
4. Crear las tres etiquetas de rollback.
5. Comprobar el estado de las dos bases, solo leyendo:
   - `npm run db:whoami:testing` y `npx dotenv -e .env.testing -- npx prisma migrate status` →
     7 migraciones, al día;
   - `npm run db:whoami:prod` → el ref de producción, 5 migraciones.
6. En Vercel, con tu Chrome y solo leyendo:
   - el uso de almacenamiento;
   - las URL exactas de producción y de testing;
   - el último despliegue de producción, que tiene que ser `4ec153e`. Es el destino de R1.
7. Un script temporal de solo lectura contra producción, que borro sin commitear:
   - reservas `CANCELLED` con pago `COMPLETED`: tienen que ser 0, o el aviso «Pagos a devolver»
     aparecería nada más desplegar;
   - **reservas `CONFIRMED` sin asientos**: son pagos tardíos que el código viejo cobró sin
     asientos (el fallo de RCA-276). No bloquea la fusión, pero si sale alguna te la paso, por si
     hay que devolverla.

### Fase 1 · `academic` → `testing` (yo)

1. `git checkout testing`.
2. `git merge --no-ff origin/main` (M1). Comprobar que `git diff origin/testing HEAD` sale vacío.
3. `git merge --no-ff academic` (M2). Se produce el conflicto esperado y se resuelve:
   - `git checkout --theirs src/modules/payments/actions/index.ts`;
   - `git add` de ese fichero solo. Ni `git add -A` ni `git rm`;
   - revisar `git diff --cached` y commitear con un mensaje en español, escrito en un fichero y
     pasado con `git commit -F`.
4. **Puerta:** `git diff academic HEAD --stat` **vacío**.
5. Comprobación en local, con el servidor de desarrollo parado:
   - `npx prisma generate`, `npm run lint`, `npm run typecheck`, `npm run format:check` y
     `npm test`;
   - `npm run db:up`, `npm run test:integration` y `npm run e2e`.
6. **Con tu OK:** `git push origin testing` y las etiquetas. Despliega la preview de testing y
   arranca la CI.

### Fase 2 · Verificación en testing (puerta para producción)

Lo hago yo:

- Con tu Chrome y solo leyendo: el despliegue de testing en Ready en Vercel, y la CI de `testing`
  en verde en Actions.
- `curl -sI` a la URL de testing:
  - que sirva `x-frame-options: DENY`, que es la señal de que ya corre el código nuevo;
  - que `/` responda 200;
  - que `/admin` redirija al login;
  - que `/api/cron/cleanup` sin cabecera dé 401.
- Cron de limpieza a mano: `curl` con el `CRON_SECRET` de `.env.testing`, sin imprimirlo.
  Tiene que devolver 200 con `deletedLoginAttempts`. Si da 401, es que el secreto de Vercel es
  otro; lo anoto y sigo.
- Abrir la confirmación sin `t=` no tiene que enseñar datos.

Lo haces tú (unos 10 minutos):

- **una compra en el sandbox**, en la URL de testing y sobre un evento dentro de la ventana:
  ticket con nombre, recibo con el código de autorización y el PDF. Me pasas el nº de pedido;
- entrar al panel de testing (te pedirá iniciar sesión otra vez) y echar un vistazo a Reservas,
  Usuarios y Eventos.

Después, lo mío: leer la base en solo lectura con un script temporal, que borro después.

- Tu reserva tiene que estar CONFIRMED/COMPLETED, con `accessToken` y recibo, y sus asientos
  OCCUPIED.
- `verify-management-fee.ts report` contra testing.

**Puerta:** todo en verde y tu OK.

### Fase 3 · `testing` → `main`, es decir, producción

**Antes del día, lo tuyo:**

- rotar `CRON_SECRET` en Vercel, en el scope Production. Por ejemplo, con `openssl rand -hex 32`.
  El push a `main` lo recoge; no hace falta redesplegar aparte. El uso de almacenamiento lo miro
  yo;
- confirmar que ninguna web incrusta las reservas en un iframe: la web del bar, si tiene botón de
  reservar, o cualquier perfil que la muestre dentro de la página;
- mandar el aviso a la dueña y al personal (texto en el anexo);
- elegir el momento: fuera del horario del bar y sin ninguna apertura fuerte cerca.

**El día, lo mío:**

1. Comprobar, solo leyendo, que hay **0 reservas PENDING**. Si hay alguna, esperar 5 o 10
   minutos: caducan solas.
2. `npm run db:backup:prod`, que guarda un JSON en `backups/` (ignorado por git). Revisar los
   conteos que imprime.
3. `npm run db:whoami:prod`, que tiene que dar el ref de producción, y
   `npx dotenv -e .env.prod -- npx prisma migrate status`, con **exactamente las 2 pendientes**.
4. **Con tu OK explícito:** `npm run db:deploy:prod`. Después:
   - `migrate status` → al día;
   - `db:whoami:prod` → 7 migraciones;
   - `curl` a producción → 200, todavía con el código viejo y ya con el esquema nuevo.
5. `git checkout main` y `git merge --ff-only testing`. **Puerta:** `git rev-parse main` igual
   que `testing`.
6. **Con tu OK explícito:** `git push origin main`, y Vercel despliega producción.
7. Esperar, con un bucle de `curl`, a que producción sirva `x-frame-options: DENY`: en ese
   momento el código nuevo ya está en vivo. Mientras, sigo la build en Vercel con tu Chrome. Si
   falla, leo el log y paro: producción sigue con el despliegue anterior.

### Fase 4 · Verificación en producción

Lo hago yo, nada más desplegar:

- `curl` a `/`, a un evento, a `/admin` (que redirija) y al cron sin cabecera (401);
- comprobar las cabeceras;
- CI de `main` en verde.

Lo haces tú (unos 10 minutos):

- iniciar sesión en el panel de producción y mirar Usuarios y Reservas;
- **un pago real de 1 asiento** en un evento dentro de la ventana: ticket, recibo y PDF. Después
  se devuelve desde Canales o se descuenta en consumición.

Lo hago yo, después de tu pago:

- leer esa reserva en solo lectura: CONFIRMED, con `accessToken`, recibo y asientos OCCUPIED;
- `verify-management-fee.ts report` contra producción.

**A la mañana siguiente (yo):** en los logs de Vercel, con tu Chrome y solo leyendo, compruebo que
han corrido sin error los dos crons: la limpieza de las 03:00 UTC, que es la primera vez que corre
el código nuevo, y el sync de las 04:00. Repaso además los errores del primer servicio con el
código nuevo.

### Fase 5 · Cierre (yo)

1. `git checkout academic` y `git merge --ff-only main`: las tres ramas quedan en el mismo commit.
2. Un commit de documentación en `academic`:
   - `CHANGELOG`: lo que estaba «solo en academic» pasa a producción, con la fecha;
   - `MASTER_IA`: una sección «P13 · Fusión», y se cambia la regla «nunca se mergea
     `academic`»;
   - mover este plan a `docs/historico/`.
3. `git push origin academic`. Es solo un despliegue de preview.
4. Actualizar la memoria: la fusión hecha, las migraciones de producción al día y el estado
   general.
5. Linear: un comentario en RCA-261, si vuelves a conectar Linear (ver el §8).
6. Opcional, si tú lo decides: archivar `dev`. Se le pone una etiqueta y se borra la rama. Lleva
   desde junio sin uso, y cada push a ella también despliega.

**Despliegues en total:** 3 (testing, producción y la preview de `academic`). Las etiquetas no
despliegan.

---

## 6. Rollback

### Código de producción

| Opción | Quién | Tiempo | Cómo |
|---|---|---|---|
| **R1, instantánea** | Tú, un clic | ~1 min | Vercel → Deployments → el despliegue de producción anterior (`4ec153e`) → **Instant Rollback**. Ojo: después, Vercel no promociona sola ninguna build nueva de `main` hasta que pulses «Undo Rollback» o promociones a mano |
| **R2, en git y duradera** | Yo | ~5 min más la build | En `main`: `git revert -m 1 <SHA de M2>`. **Puerta:** `git diff pre-fusion-main main` vacío, que es el árbol idéntico al de hoy. Después, `git push origin main`. Para volver a fusionar más adelante, hay que revertir ese revert |

Sin force-push, en ningún caso.

**Cuándo se activa:**

- el pago no funciona: falla RESERVAR o el webhook;
- las páginas públicas dan 500;
- nadie puede entrar al panel.

**No** justifican un rollback: tener que volver a iniciar sesión, un iframe (se arregla la
cabecera) o algo estético.

### Base de datos: no se toca

Las dos migraciones son aditivas, y el código viejo funciona con ellas: así lleva días la preview
de testing. **Volver al código anterior no exige deshacer ninguna migración**, y deshacerlas sería
peor. El backup JSON es el último recurso, y nunca se restaura entero: se perderían las reservas
posteriores.

### Qué pasa con lo creado por el código nuevo si se vuelve atrás

| Dato | Con el código anterior |
|---|---|
| Cookies de sesión nuevas | Siguen valiendo: tienen todo lo de antes más la huella. Nadie tiene que volver a entrar |
| Reservas con `accessToken` y URL con `&t=` | Se ignora la llave. Las páginas abren por nº de pedido, como antes |
| Asientos libres con `reservationId` (el rastro de RCA-276) | Inofensivo: el código viejo lee la disponibilidad del `status` |
| Filas de `LoginAttempt` | El código viejo no lee esa tabla |
| Reservas «para devolver» (CANCELLED con pago COMPLETED) | El panel viejo no avisa: habría que revisarlas a mano. Solo las crea el código nuevo, así que serían las de los días con la fusión en marcha |

### Testing

Igual que R2, sobre `testing`, o se deja estar: es una preview.

---

## 7. Lo que depende de ti

| Cuándo | Acción | Tiempo |
|---|---|---|
| Ahora | Aprobar el plan | — |
| Fase 1 | OK para el push a `testing` | — |
| Fase 2 | Compra en el sandbox de testing (y pasarme el nº de pedido), y un vistazo al panel | 10 min |
| Antes de producción | Rotar `CRON_SECRET` (Production) en Vercel | 3 min |
| Antes de producción | Confirmar que ninguna web incrusta las reservas en un iframe | 5 min |
| Antes de producción | Enviar el aviso (anexo) y elegir el momento | 2 min |
| Fase 3 | OK para migrar producción y OK para el push a `main` | — |
| Fase 4 | Iniciar sesión en producción y hacer un pago real de 1 asiento | 10 min |
| Solo si algo va mal | R1 (un clic en Vercel), o decirme que haga R2 | 1 min |

Lo demás lo hago yo, incluido lo que se lee en Vercel y en GitHub Actions con tu Chrome:

- el estado de los despliegues;
- el uso de almacenamiento;
- los logs de los crons;
- la CI.

**Autorizaciones de Chrome que diste el 2026-10-01:** leer Vercel (despliegues, uso y logs) y,
como antes, GitHub Actions. No incluyen tocar variables, hacer rollback, comprar ni revisar webs
de terceros.

## 8. Recomendaciones: conexiones con los servicios del proyecto (para otro momento)

Hoy veo git, las bases a través de los scripts del repo, y GitHub y Vercel (solo leyendo) a
través de tu Chrome. Chrome sirve, pero es lento y frágil: depende de una pestaña y de la
interfaz. Con lo de abajo comprobaría casi todo sin pedirte nada y sin el navegador.
**Principios:**

- configurarlo todo en el ámbito de usuario (`claude mcp add --scope user`), nunca en un
  `.mcp.json` del repo: así ningún token entra en git;
- solo lectura por defecto;
- las escrituras en producción, solo con los scripts que ya tienen `requireDbEnv` y con tu OK.

Por orden de beneficio:

1. **GitHub, con la CLI `gh`.** Es lo que más ganas por menos coste.
   - Instalación: `winget install --id GitHub.cli` y después `gh auth login`.
   - Qué gano:
     - el estado de la CI sin Chrome: `gh run list`, `gh run watch` y `gh run view --log-failed`;
     - ver la protección de ramas: `gh api .../branches/main/protection`;
     - PR si algún día los quieres.
   - Recomendaciones sobre GitHub:
     - exigir el check `static` en `main` y `testing`;
     - prohibir el force-push.

   Con el fast-forward de este plan, el commit que llega a `main` ya trae su CI en verde desde
   `testing`.
2. **Vercel, con la CLI y el MCP oficial.**
   - La CLI: `npm i -g vercel`, `vercel login` y `vercel link`. `.vercel` ya está en
     `.gitignore`.
   - El MCP: `claude mcp add --transport http vercel https://mcp.vercel.com`, con OAuth.
     Comprobar la URL en la documentación de Vercel al configurarlo.
   - Qué gano:
     - el estado y los logs de cada despliegue;
     - los logs de los crons;
     - qué variables existen en cada scope (solo los nombres);
     - el rollback y la promoción, con tu OK.
   - **Una regla dura: prohibir `vercel env pull` y `vercel pull`.** Escriben `.env.local`, que
     Next carga por delante de `.env`, y repetirían el fallo de `.env.production` con la base de
     producción.
   - Dos ajustes en Vercel:
     - un `ignoreCommand` que no despliegue los commits de solo documentación (está pendiente de
       tu decisión);
     - limpiar despliegues viejos para liberar almacenamiento.
3. **Supabase, con el MCP oficial en solo lectura y limitado a un proyecto.**
   - Se instala con `@supabase/mcp-server-supabase` y las opciones `--read-only` y
     `--project-ref=<ref>`, o en remoto con `mcp.supabase.com` y `read_only=true`.
   - En Windows, los servidores locales con `npx` necesitan `cmd /c` delante.
   - Empezar **solo por testing**.
   - Qué gano:
     - consultas de diagnóstico y el estado de las migraciones;
     - los logs de Postgres y del pooler (útiles para algo como el incidente de julio);
     - los *advisors* de seguridad y de rendimiento.
   - **Producción, mejor no, o solo en lectura y sabiéndolo:**
     - las filas llevan datos personales;
     - `customerName` es texto que escribe cualquiera, y podría intentar colar instrucciones al
       modelo;
     - el token personal de Supabase da acceso a toda la cuenta, y lo que lo limita es la opción
       del proyecto.
   - **Copias:** el plan gratuito no te da copias descargables ni PITR.
     - Mantener `db:backup:prod` (JSON) y añadir un `pg_dump` periódico con Docker, que guarda
       también el esquema y el `CHECK`.
     - Si el negocio crece, el plan Pro da copias diarias y más margen de conexiones.
4. **Linear.** El conector de claude.ai aparece sin autenticar en esta sesión. Volver a
   conectarlo en Ajustes → Conectores, para cerrar tarjetas y comentar en RCA-261.
5. **Redsys/CaixaBank:** sin integración. El portal Canales no tiene API pública, y las
   devoluciones deben seguir siendo manuales.
6. **Permisos de Claude Code**, en el `.claude/settings.json` del proyecto:
   - permitir lo que solo lee (`gh run *`, `vercel ls`, `vercel inspect`, `vercel logs`);
   - pedir confirmación para `git push`, `db:deploy:*`, `vercel rollback` y `vercel promote`;
   - prohibir `vercel env pull`, `vercel pull` y `vercel --prod`.

---

## Anexo · Aviso para la dueña y el personal (borrador)

> Hola. El [día] a las [hora] actualizo la web de reservas. Lo que notaréis:
>
> 1. Todos tendréis que **volver a iniciar sesión** en el panel una vez.
> 2. **Si alguien falla la contraseña 5 veces, el login se bloquea 15 minutos para todo el que
>    esté en la wifi del bar.** Si pasa, avisadme.
> 3. (Para la dueña) En Usuarios:
>    - la contraseña se cambia con el botón «Cambiar contraseña»;
>    - crear o ascender a un administrador te pedirá tu propia contraseña;
>    - la ficha de otro administrador es de solo lectura.
> 4. Nuevo aviso **«Pagos a devolver»** en el panel. Si un cliente paga tarde y sus asientos ya no
>    están libres, aparecerá ahí. Se le devuelve desde CaixaBank y después se pulsa «Ya está
>    devuelto».
> 5. Los clientes no notan nada, salvo pantallas de carga más rápidas.

## Verificación (resumen)

| Momento | Comprobaciones |
|---|---|
| Fusión en local | `git diff academic testing` vacío; lint, tipos, formato y las tres suites en verde |
| Testing | CI en verde, cabeceras, cron a mano, compra en sandbox con recibo, lectura de la reserva y `verify-management-fee report` |
| Producción (antes) | 0 PENDING, backup, `whoami` y `migrate status` (2 pendientes) |
| Producción (después) | 7 migraciones; `main` == `testing` (mismo SHA); cabeceras; tu pago real leído en la base; `verify-management-fee report`; el cron de la mañana siguiente |
