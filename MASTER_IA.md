# Plan: preparar `lounge-app` como entrega de máster

> **Estado:** plan cerrado, sin implementar.
> **Fecha:** 21 de septiembre de 2026.
> **Rama de trabajo:** `academic`. **`main` y `testing` no se tocan** (salvo la Fase −1, que son dos comentarios).

---

## Contexto

`lounge-app` es una aplicación real en producción: reservas de asientos para un bar deportivo en Valencia, con cobro real por Redsys y ~325 reservas de clientes. Hay que entregarla como proyecto de un máster de desarrollo de software con IA, lo que exige tres cosas que hoy **no existen**: suite de tests, documentación profesional y una presentación.

Estado de partida, verificado:

- **Cero tests, cero CI, cero `data-testid`.** `package.json` solo tiene `dev`, `build`, `start`, `lint` y los `db:*`.
- La lógica de negocio vive dentro de server actions `"use server"`, mezclada con Prisma, con **duplicaciones literales** (importes, solape de eventos, títulos, resultado del pago).
- 17 `.md` en la raíz (5.653 líneas), mezcla de documentación viva y planes ya ejecutados. El `README.md` está personalizado pero su bloque de variables sigue diciendo `DATABASE_URL="file:./dev.db"`, obsoleto desde la migración a Supabase.
- 72 commits desde el 2026-01-27, de los cuales 70 con prefijo convencional.
- Entorno local: Node **v22.11.0**, npm 11.6, Docker Desktop 29.5 instalado (daemon parado), remoto `github.com/rcavero/lounge-app`, sin `gh` CLI.

**Hallazgos que se corrigen en `academic`** y que de paso justifican por qué se escriben los tests:

- `src/modules/payments/actions/index.ts`: la comprobación de disponibilidad va **fuera** de la transacción y el `updateMany` de dentro no filtra por `status: "AVAILABLE"`. Dos clientes simultáneos sobre el mismo asiento pasan los dos. **Condición de carrera real sobre dinero, hoy en producción.**
- `src/app/api/cron/cleanup/route.ts`: la variable `thirtyMinutesAgo` calcula 5 minutos. El comportamiento es correcto, el nombre miente.
- Ventana de reservas: el código (`event-row.tsx:65-66`) usa **48h–4h**; `README.md` y `CLAUDE.md` dicen 48h–5h.
- Código muerto sin ningún caller: `seating/components/seat.tsx` y `seat-map.tsx`, `shared/components/header.tsx` y `footer.tsx`, y `createReservation` en `reservations/actions`.

---

## Los tres entornos — regla dura

| Rama | Base de datos | Vercel | Redsys | Quién la toca |
|---|---|---|---|---|
| `main` | Supabase producción | Production → `lounge-app-neon.vercel.app` | **producción (real)** | Nadie durante la entrega |
| `testing` | Supabase testing | Preview → `lounge-app-titanium.vercel.app` | sandbox | Nadie durante la entrega |
| `academic` | **la misma de testing** | Preview → `lounge-app-academic.vercel.app` | sandbox | **La única rama que se toca** |
| local | Postgres en Docker (`lounge_dev`) | — | sandbox | Desarrollo |
| tests | Postgres en Docker (`lounge_test`) | — | sandbox | Vitest y Playwright |

> **`academic` y `testing` comparten base de datos, y eso es deliberado.** El plan original
> le daba a `academic` su propio esquema (`?schema=academic`) dentro del mismo proyecto
> Supabase. La puerta de la Fase 0.2 lo tumbó: el pooler de Supavisor en modo transacción
> reutiliza conexiones entre clientes, el `SET search_path` persiste en el backend, y una
> conexión de testing acabó heredando el esquema `academic` —vacío— y rompiendo testing con
> `42P01`. Detalle completo en la tarjeta 03.4 de Linear.
>
> Consecuencia de compartir base: **no hay `DB_ENV=academic`**. Hay un nombre de entorno por
> base de datos, no por despliegue, porque si no un script destructivo lanzado "contra
> academic" escribiría en testing sin avisar. Para trabajar en local contra esa base se usa
> `npm run dev:testing`, se llame como se llame la rama que tengas activa.
>
> Consecuencia operativa: **`academic` no se siembra**. Nada de `db:seed` contra esa base —
> crearía un usuario admin con contraseña conocida en un entorno compartido. Los eventos, las
> reservas y los usuarios (ADMIN y WORKER) los crea Ramón a mano desde testing, y los renueva
> periódicamente para que el proyecto tenga actividad cuando lo revisen.

- `academic` **no sustituye** a `testing` en Vercel: cada rama genera su propio Preview deployment con su propia URL. Conviven.
- **Nunca** se mergea `academic` hacia `testing` ni `main` mientras dure la entrega. Al terminar se decide qué se porta, y se porta a mano.
- Protección de rama en GitHub para `main` y `testing`: sin push directo, PR obligatorio. Es lo que convierte la regla en algo que no depende de acordarse.
- En `academic` **jamás** entran las credenciales reales de CaixaBank, solo sandbox.
- Vercel **no ejecuta crons en Preview**: en `academic` no se disparan solos, se llaman a mano con `CRON_SECRET`.

---

## Fase −1 — Poner en orden `main` y `testing`

Los ficheros `.env*` están en `.gitignore`: hay **un solo sistema de ficheros y no tienen rama**. En cuanto se renombre `.env`, la realidad deja de coincidir con las docstrings de las tres ramas a la vez. No se puede "renombrar solo en academic", así que esto va antes que nada.

El daño real, medido: **dos líneas de comentario en dos ficheros** — `scripts/backup-prod.ts:14` y `scripts/rename-seats.ts:18`. Todo lo demás que menciona `.env` son documentos históricos o lecturas de `process.env.X`, que no dependen del nombre del fichero.

**El cambio:** que esas docstrings dejen de afirmar qué contiene cada fichero —que es lo que se queda obsoleto— y apunten al único gate que no miente:

```
 *   Cargar explícitamente el entorno de producción (.env.production) y CONFIRMAR
 *   la primera línea de salida: debe imprimir el ref del proyecto de producción.
 *   Si dice "(ref no reconocido)", estás contra otra base de datos: aborta.
```

Commit en `main` → `git cherry-pick` sobre `testing` → push de las dos. **Es la única excepción a "no se tocan", y es un commit de comentarios: cero líneas de código.** Si no se hace, la rama de producción queda documentando algo falso.

**Verificación, en este orden:**

1. `git diff main~1 main` — solo líneas que empiezan por `*` dentro de bloques `/** */`. Si aparece una línea de código, parar.
2. `npm run build` en `main` — pasa igual que antes.
3. `db-whoami` con `.env.production` — imprime el ref de producción y los conteos de siempre (~325 reservas). Ese es el examen que demuestra que producción sigue intacta.

**Los documentos históricos no se tocan.** Los `PLAN_*.md` y `MIGRACION_*.md` que dicen "`.env` apunta a PRODUCCIÓN" se quedan como están en las tres ramas: son el registro de lo que era cierto cuando se escribieron, se leen antes de actuar y no ejecutan nada. En `academic` se mueven a `docs/historico/` **sin editar**, con una nota en el índice de la carpeta.

**Red de seguridad que ya existe y conviene no romper:** los siete scripts que tocan la BD imprimen como primera línea `Proyecto Supabase : <ref>`, extraído con `/postgres\.([a-z0-9]+)/`. Una URL local no casa y sale `(ref no reconocido)` con todos los conteos a cero. El fallo es ruidoso por diseño.

---

## Fase 0 — Entornos aislados

### 0.1 Node

Subir a la **Node 22 LTS actual (22.23.2)**. Verificado que nada se opone: Next 16 exige `>=20.9.0` y Prisma `>=18.18`. El motivo es higiene —la 22.11.0 no lleva los parches recientes—, y como consecuencia se puede usar el Vitest último sin pines raros. Añadir `.nvmrc`, `engines.node` en `package.json`, y subir `@types/node` de `^20` a `^22` (que coincida con el runtime; los tipos de 24 dejarían usar APIs que no existen en tu Node).

⚠️ Comprobar en Vercel que el proyecto no está fijado a Node 20.x, o chocará con `engines`.

### 0.2 Renombrar los entornos

El problema de fondo no es la incantación `set -a && . ./.env.testing && set +a`, es que **`.env` apunta a producción y se carga solo**: `prisma.config.ts` hace `import "dotenv/config"` y Next carga `.env` en cada `next dev`. El caso por defecto es el peligroso. La corrección es invertir el defecto:

| Fichero | Apunta a | `DB_ENV` |
|---|---|---|
| `.env` | Postgres local de Docker, base `lounge_dev` | `local` |
| `.env.test` | Postgres local de Docker, base `lounge_test` | `test` |
| `.env.testing` | Supabase testing, esquema `public` *(no se toca)* | `testing` |
| `.env.academic` | Supabase testing, esquema `academic` *(nuevo)* | `academic` |
| `.env.production` | Supabase producción *(el `.env` de hoy, renombrado)* | `production` |

No requiere tocar una línea de código y son ficheros de tu máquina. El peor accidente pasa de "he escrito en la base de datos del bar" a "he escrito en mi Postgres de usar y tirar".

**El guard**: cada fichero declara `DB_ENV`, y `scripts/lib/require-db-env.ts` expone `requireDbEnv(esperado)` que aborta si no coincide. Lo llaman solo los scripts destructivos (`rename-seats.ts apply`, `sync-reset.ts`) y el setup de los tests de integración, que exige `DB_ENV=test`. Son diez líneas y sustituyen al guard por expresión regular sobre la URL: más simple y más fiable.

### 0.3 Docker local

Un solo `docker-compose.yml` con `postgres:17-alpine` en el puerto **5433**, volumen persistente, y un `initdb` de una línea que crea la segunda base:

```sql
CREATE DATABASE lounge_test;
```

Dos bases en el mismo contenedor: `lounge_dev` para desarrollar (persiste) y `lounge_test` para los tests (se trunca en cada test). Así la suite no te borra los datos con los que estabas trabajando.

### 0.4 Lo que haces tú, paso a paso

**En tu máquina**

1. Instalar Node 22.23.2. `node -v` para confirmar.
2. Hacer la Fase −1 completa (commit, cherry-pick, push, las tres verificaciones).
3. `copy .env .env.production` y **comprobar la copia antes de tocar el original**: cargarla y lanzar `db-whoami`; debe imprimir el ref de producción.
4. Solo entonces, reescribir `.env` con la BD local. `.env.testing` se queda tal cual.

**En Supabase (proyecto `lounge-app-testing`)**

5. *SQL Editor* → `CREATE SCHEMA IF NOT EXISTS academic;`. Lo creamos a mano en vez de confiárselo a Prisma, para no depender de un comportamiento que habría que verificar.
6. Crear `.env.academic` copiando `.env.testing` y añadiendo `?schema=academic` a `DATABASE_URL` **y** a `DIRECT_URL` (cuidado con el `&` si la URL ya lleva parámetros). Añadir `DB_ENV=academic`.
7. **Prueba de humo que decide el plan — hazla antes de construir nada encima.** Cargar `.env.academic` y lanzar `db-whoami`:
   - **0 en todos los conteos** → el `search_path` se respeta, el esquema está aislado, seguimos.
   - **Aparecen los datos de testing** → el pooler está ignorando el `search_path`. Es un riesgo real del pooler en modo transacción.

   El plan B **no es** usar la conexión directa para la app: ya te agotó el pool en julio de 2026. Sería un tercer proyecto Supabase, pausando uno si el plan gratuito no deja tener tres activos.
8. `npm run db:deploy:academic` → crea las tablas dentro del esquema. Relanzar `db-whoami`: 5 migraciones listadas y 0 filas.

**Copia de seguridad previa**

9. Con Docker arrancado, volcar testing entero antes de nada:
   ```
   docker run --rm postgres:17-alpine pg_dump "<DIRECT_URL de testing>" -Fc > backups/testing-pre-academic-2026-09-21.dump
   ```
   Con `DIRECT_URL` (puerto 5432), no con el pooler: `pg_dump` necesita conexión directa. Comprobar que el fichero no pesa cero. Es un formato estándar que `pg_restore` sabe devolver; el JSON de `backup-db.ts` se queda como instantánea lógica rápida.

**Rama y GitHub**

10. `git switch -c academic testing`, commitear `MASTER_IA.md` ahí (ahora está suelto en `testing`), `git push -u origin academic`.
11. GitHub → *Settings* → *Branches*: protección para `main` y `testing`, sin push directo, PR obligatorio.

**Vercel**

12. *Settings* → *Environment Variables*: por cada una de `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `CRON_SECRET`, `REDSYS_ENV`, `REDSYS_MERCHANT_CODE`, `REDSYS_TERMINAL`, `REDSYS_SECRET_KEY` → entorno **Preview**, *Custom branch* = `academic`. Sin esto la preview arranca sin base de datos.
13. **`NEXT_PUBLIC_BASE_URL` se deja sin definir** en academic: `src/lib/base-url.ts` cae a `VERCEL_BRANCH_URL`, que es estable por rama, y así las URLs de vuelta de Redsys apuntan solas al sitio correcto.
14. `REDSYS_*` solo sandbox.
15. *Deployment Protection*: confirmar que las previews no están detrás de autenticación de Vercel, o Redsys no puede llamar al webhook y nadie puede abrir el enlace que enseñes.

**Poblar academic**

16. `npm run db:seed:academic` (47 asientos + admin), lanzar el sync de ESPN para traer equipos y escudos, y crear tres eventos a mano para la demo. Mejor esto que un script de restauración: menos código, y de paso demuestra que el sync funciona.

### 0.5 Scripts de `package.json`

**Sin sufijo = local. Con sufijo = remoto y explícito.** Nada remoto es nunca el defecto, y se ve de un vistazo qué comando puede tocar qué.

```json
"dev":                "next dev",
"dev:testing":        "dotenv -e .env.testing  -- next dev",
"dev:academic":       "dotenv -e .env.academic -- next dev",

"typecheck":          "tsc --noEmit",
"format":             "prettier --write .",
"format:check":       "prettier --check .",

"db:up":              "docker compose up -d --wait",
"db:down":            "docker compose down",
"db:migrate":         "prisma migrate dev",
"db:seed":            "tsx prisma/seed.ts",
"db:studio":          "prisma studio",
"db:whoami":          "tsx scripts/db-whoami.ts",

"db:whoami:testing":  "dotenv -e .env.testing    -- tsx scripts/db-whoami.ts",
"db:whoami:academic": "dotenv -e .env.academic   -- tsx scripts/db-whoami.ts",
"db:whoami:prod":     "dotenv -e .env.production -- tsx scripts/db-whoami.ts",

"db:deploy:testing":  "dotenv -e .env.testing    -- prisma migrate deploy",
"db:deploy:academic": "dotenv -e .env.academic   -- prisma migrate deploy",
"db:deploy:prod":     "dotenv -e .env.production -- prisma migrate deploy",

"db:seed:academic":   "dotenv -e .env.academic   -- tsx prisma/seed.ts",
"db:studio:academic": "dotenv -e .env.academic   -- prisma studio",

"db:backup:testing":  "dotenv -e .env.testing    -- tsx scripts/backup-db.ts",
"db:backup:academic": "dotenv -e .env.academic   -- tsx scripts/backup-db.ts",
"db:backup:prod":     "dotenv -e .env.production -- tsx scripts/backup-db.ts",

"test":               "vitest run --project unit --project ui",
"test:watch":         "vitest --project unit --project ui",
"test:coverage":      "vitest run --project unit --project ui --coverage",
"test:integration":   "dotenv -e .env.test -- vitest run --project integration",
"e2e":                "dotenv -e .env.test -- playwright test",
"e2e:ui":             "dotenv -e .env.test -- playwright test --ui",
"build:e2e":          "dotenv -e .env.test -- npm run build",
"start:e2e":          "dotenv -e .env.test -- next start -p 3100",
"ci:local":           "npm run lint && npm run typecheck && npm run test && npm run test:integration"
```

Renombrar `scripts/backup-prod.ts` → `scripts/backup-db.ts`: es agnóstico del entorno (solo lee lo que diga `DATABASE_URL`) y el nombre actual miente.

---

## Fase 1 — Tooling de calidad

`devDependencies` a añadir: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@playwright/test`, `dotenv-cli`, `prettier`, `husky`, `lint-staged`.

Nada de `vite-tsconfig-paths` (el alias es uno solo: dos líneas de `resolve.alias` en el config y una dependencia menos) ni de `@vitejs/plugin-react` (Vite ya transforma `.tsx` con esbuild respetando el `jsx: "react-jsx"` del `tsconfig.json`; el plugin solo aporta Fast Refresh, irrelevante en tests).

**`vitest.config.ts`** en la raíz, con `test.projects`:

- `unit` — `environment: "node"`, `src/**/*.test.ts`, **excluye `src/app/**`**.
- `ui` — `environment: "jsdom"`, `src/**/*.test.tsx`.
- `integration` — `environment: "node"`, `tests/integration/**`, `globalSetup` que migra, `setupFiles` que fija entorno y trunca, `pool: "forks"` con `singleFork` y `fileParallelism: false`.

Dos detalles que se olvidan y cuestan una tarde:

- **`process.env.TZ ??= "Europe/Madrid"` al principio del config**, antes de que arranque ningún worker: `monthRange` usa constructores de fecha **locales**, así que sin fijar el huso los tests de informes pasan aquí y fallan en CI (UTC).
- **Ningún `*.test.ts` bajo `src/app/`**: el App Router escanea ese árbol para descubrir rutas. Los tests de handlers van en `tests/integration/`, importando `{ POST } from "@/app/api/payments/notify/route"`.

Imports explícitos desde `vitest`, sin `globals`. `eslint.config.mjs` necesita un bloque para los ficheros de test. Al `.gitignore`: `/test-results`, `/playwright-report`, `/tests/e2e/.auth`, `/tests/e2e/.artifacts`, `.env.test`, `.env.academic`, `.env.production`.

**Husky + lint-staged**: pre-commit ejecuta `lint-staged` (prettier + eslint sobre lo tocado) y `typecheck`. Nada de correr la suite entera en cada commit.

---

## Fase 2 — Extracción de capa de dominio

Patrón único: **crear `src/modules/<módulo>/domain/*.ts` como módulos planos (sin `"use server"`, sin Prisma, sin `next/*`), mover ahí la regla, y dejar la server action como adaptador fino**. El reloj entra como parámetro `now: Date` con valor por defecto, en lugar de llamar a `new Date()` dentro.

No es preferencia de estilo: **en un fichero `"use server"` todo lo exportado tiene que ser una función asíncrona y se convierte en un endpoint invocable desde el navegador.** Una función pura no puede vivir ahí. El proyecto ya aplica ese razonamiento en `payments/lib/receipt.ts` y `payments/lib/customer-name.ts`.

| Nuevo módulo | Qué absorbe | Elimina la duplicación de |
|---|---|---|
| `payments/domain/amount.ts` | `computeReservationAmount`, `expectedCentsFromTotalPrice`, `toRedsysAmount` | `payments/actions:47-48,103-104` + `reservations/actions:116-119` |
| `events/domain/overlap.ts` | `eventWindow`, `windowsOverlap`, `overlappingEventIds` | `payments/actions:76-82` + `seating/actions:9-32` |
| `events/domain/title.ts` | `resolveEventNaming` con las tres ramas (motor / manual / fútbol) | `events/actions:104-129` + `:189-214` |
| `payments/domain/outcome.ts` + `payments/lib/apply-payment-outcome.ts` | Decisión pura de estados + la transacción compartida | `payments/actions:178-192,213-223` + `notify/route.ts:63-77,83-94` |
| `seating/domain/availability.ts` | "AVAILABLE aquí pero ocupado en evento solapado → OCCUPIED, salvo BLOCKED" | `seating/actions:91-98` |
| `reservations/domain/expiry.ts` | `PENDING_RESERVATION_TTL_MS`, `EVENT_RETENTION_MS` y sus cutoffs | `seating/actions:35` + `cron/cleanup:15-16` |
| `reservations/domain/report-months.ts` | Agrupado por mes y rango `(year, month)` | `reservations/actions:307-337,345-346` |

### Tres trampas que hay que respetar al pie de la letra

1. **Los `where` de confirmar y cancelar son distintos a propósito y NO se unifican.** Confirmar usa `where: { reservationId }`; cancelar usa `where: { seatId: { in }, eventId }`. Unificarlos parece más limpio y cambia el comportamiento: dejaría de tocar un `SeatStatus` cuyo `reservationId` ya fuera nulo.
2. **Las guardas de estado se quedan en cada caller.** Son tres y son diferentes: `confirmReservationByOrderId` solo actúa sobre `PENDING`; `cancelReservationByOrderId` sale si ya está `CONFIRMED` (el pago manda); el webhook actúa **sin filtro de estado**.
3. **`recordPaymentReceipt` se queda fuera de la transacción**, como hoy: si falla el recibo, la reserva tiene que confirmarse igual.

En `overlap.ts`, el filtro `status: { in: ["UPCOMING","LIVE"] }` se queda en la query de Prisma: duplicarlo en los dos callers sería peor que dejarlo donde está.

### Exportaciones y borrados

Sin mover código (riesgo ~0): exportar `espnMonths` (`api-client.ts:95` — **no está exportada**, corrección respecto a la primera versión de este plan), `planTeam` y `planCreate` (`team-sync.ts:182,271`, ya puras pero internas), y partir `loadTeamIndex()` en un `buildTeamIndex(rows)` puro más la query. **`safeManagementFeeCents` se mueve** de `events/actions:16-18` a `events/config/pricing.ts`, que ya es un módulo plano.

Ya son puras y se testean tal cual: `payments/lib/customer-name.ts`, `events/config/pricing.ts`, `toSuggestion`, `getTeamLogo`, los helpers de `team-sync.ts` y `football-data/config/competitions.ts`.

Borrados, en commits aparte tras `grep` confirmatorio: **`createReservation`** (cero callers; elimina de paso una copia del cálculo de importe sin refactorizarla) y el resto del código muerto.

### Dos cosas más

**La mejor ganancia no es el refactor.** Hoy el cliente calcula su propio total en `shared/hooks/use-reservation-store.ts:82-87`, con una **tercera** copia de la fórmula. Con `domain/amount.ts` extraído, el store llama a la misma función que el servidor y dejan de poder divergir.

**Un bug latente que el refactor NO arregla:** con deporte manual no-motor y `awayTeamName` vacío, el título sale `"Boxeo vs "` con espacio final. Se escribe un test que **documenta el comportamiento actual** y se abre un issue. Arreglarlo aquí sería colar un cambio observable dentro de un refactor.

### Lo que no se refactoriza

`src/lib/redsys.ts:4-15` **se queda lanzando en tiempo de import**. Es tentador hacerlo perezoso para facilitar los tests, y sería un error: hoy un despliegue sin `REDSYS_SECRET_KEY` revienta al arrancar y te enteras en el deploy; con validación perezosa, revienta cuando un cliente intenta pagar. **El acoplamiento es un rasgo de seguridad.** Los tests lo resuelven con `setupFiles` y las credenciales públicas del sandbox, cinco líneas.

---

## Fase 3 — Suite de tests

### 3.1 Unitarios (`src/**/*.test.ts`, colocados junto al código)

Por riesgo, empezando por el dinero:

1. **Importes** — tabla sobre `computeReservationAmount`: precios 0–30 €, los 11 valores de `MANAGEMENT_FEE_OPTIONS_CENTS`, 1–47 asientos. Casos nombrados: base (10 €/150/1), fee cero, fee máximo, precio no redondo, aforo completo. Y los invariantes recorriendo toda la matriz: `Number.isInteger(totalCents)`, la regla del `CHECK` de la BD, y **`expectedCentsFromTotalPrice(totalPriceEuros) === totalCents`**, que demuestra que la traza de descuadre del webhook no puede dar un falso positivo. Es el test más valioso de la suite.
2. **Nombre del cliente** — 1 y 2 caracteres, 24 y 25; tildes y `Müller` pasan (Latin-1); emoji, `@`, `_`, griego y chino fallan con `"chars"`; NFD → NFC; invisibles y marcas bidireccionales se eliminan; comillas tipográficas y guiones largos se sustituyen. Casos puente normalizar→validar (30 caracteres con invisibles que quedan en 24 → válido): es lo que justifica validar **después** de normalizar. `displayCustomerName("Cliente") === "Sin nombre"`.
3. **Solape de eventos** — objetivo 20:00 + 120 min: parcial por cada lado, idéntico, contenido, contiene, y las dos fronteras **back-to-back exactas → no solapan** (`<` estricto), que es lo que decide si un asiento se vende dos veces. Más: excluye el propio id, cruza medianoche y cruza el cambio de hora.
4. **Gastos de gestión** — `isValidManagementFeeCents` con los 11 válidos y con `149`, `501`, `-50`, `1.5`, `"150"`, `null`, `NaN`. Y `safeManagementFeeCents`: `undefined → 150`, **`0 → 0`** (la trampa del falsy: si alguien lo reescribe como `value || DEFAULT`, un evento sin gastos empieza a cobrar 1,50 € por asiento).
5. **Resultado del pago** — `PENDING + ok → CONFIRMED/OCCUPIED`; `PENDING + ko → CANCELLED/AVAILABLE`; `CONFIRMED + ko → no-op`.
6. **Matching de equipos** — `planTeam`: match por `externalId` sin cambios → **cero updates** (la regresión cara: sin esto vuelven cientos de UPDATE por ejecución del cron); match por nombre normalizado, por alias, por slug; **fila con `logo: "/escudos/…"` y API con URL de ESPN → el logo no cambia** (el bug que reescribía 430 escudos). `planCreate`: slug libre, slug ocupado, colisión.
7. **Resto** — `toSuggestion` (partido empezado, competidor ausente, id no parseable, fecha inválida, `dbTeamId` presente y ausente), `espnMonths` (cruza mes y año), `resolveEventNaming` (tres ramas + el bug documentado), `report-months` (febrero bisiesto, diciembre), `availability` (BLOCKED nunca se pisa), `rate-limit` (5 intentos, ventana, aislamiento por IP — con `vi.resetModules()` porque el `Map` es estado de módulo) y `base-url` (la cadena de fallback, con import dinámico porque es constante de módulo).

### 3.2 Componentes (`src/**/*.test.tsx`, jsdom)

Dos ficheros, solo donde la UI *decide* algo:

- `event-row.test.tsx` — con `vi.setSystemTime`: +24 h navegable, +72 h bloqueado con tooltip, +2 h bloqueado, `checkAvailability: false` siempre navegable, y **evento pasado (−1 h) NO bloqueado** porque la condición exige `hoursUntilEvent >= 0`. Necesita mockear `next/link` y `next/image`.
- `floor-plan-map.test.tsx` — disponible clicable, ocupado y bloqueado `disabled`, y **un asiento seleccionado que pasó a no disponible sigue siendo clicable**. Es lo que blinda los selectores que usa Playwright.

### 3.3 Integración (`tests/integration/`, Postgres real)

Base `lounge_test` del Docker local; en CI, `services: postgres` de GitHub Actions.

**El esquema se crea con `prisma migrate deploy`, no con `db push`.** El `CHECK` de importes vive como SQL crudo en `prisma/migrations/20260825120000_add_management_fee/migration.sql:34` y **no está en `schema.prisma`**: con `db push` la restricción no existiría y los tests que la verifican pasarían en falso. Como efecto colateral gratis, `deploy` comprueba que las 5 migraciones aplican limpiamente sobre una BD virgen.

**Guard**: el setup exige `DB_ENV=test` y aborta si no. Aislamiento: `TRUNCATE … RESTART IDENTITY CASCADE` en `beforeEach`, y factories en `tests/fixtures/factories.ts` con un `TEST_NOW` fijo del que cuelgan todas las fechas. Descartada una transacción por test con rollback: el código bajo prueba abre sus propias `$transaction` y Prisma no soporta anidarlas.

Refactor previo trivial: extraer el array de asientos de `prisma/seed.ts:17-68` a `prisma/seats.ts` exportado, para que el seed y el fixture de E2E no puedan divergir.

**Por qué no `vi.mock` de Prisma:** `$transaction` interactiva está en todos los caminos críticos, y un doble nunca falla donde falla Postgres — no valida `@@unique([eventId, seatId])`, ni el `onDelete: Cascade`, ni el `CHECK`, ni hace rollback. Además `totalPrice` es `Decimal`: un mock devolvería `number` y escondería justo el `Number(reservation.totalPrice)` del webhook. `vi.mock` sí se usa, pero para cortar los bordes del framework (`@/lib/auth-guard`, `next/headers`, `next/navigation`).

**Los 12 escenarios:**

1. `initializePayment` happy: reserva `PENDING`, asientos `RESERVED`, céntimos congelados, `paymentId` de 12 dígitos.
2. Rechaza asientos no disponibles en el mismo evento, con los códigos en el mensaje.
3. Solape: evento solapado con asiento tomado → rechaza; evento que empieza justo al terminar → **acepta**.
4. Nombre inválido → **cero escrituras** (contar filas antes y después).
5. **Congelación**: crear reserva → cambiar precio y fee del evento → los céntimos de la reserva no cambian.
6. El `CHECK` rechaza importes incoherentes.
7. `confirmReservationByOrderId`: `PENDING → CONFIRMED + OCCUPIED + confirmedAt`, e **idempotente**.
8. `cancelReservationByOrderId`: `PENDING → CANCELLED + AVAILABLE`; `CONFIRMED → no-op`; y **una reserva cuyos `SeatStatus` ya tienen `reservationId` nulo se libera igual** — el test que impide unificar los dos `where`.
9. `POST /api/payments/notify`: OK → `CONFIRMED`; KO → `CANCELLED` + liberados; **firma inválida → 200 y reserva intacta**; orderId desconocido → 200 y no-op. ⚠️ Al firmar hay que mandar **`DS_MERCHANT_ORDER` y `Ds_Order` a la vez**: el firmante lee una clave y el verificador la otra. Ya está resuelto así en `scripts/simulate-redsys-notify.ts`.
10. `recordPaymentReceipt`: gana el primero que escribe; sin fecha no escribe.
11. `saveBlockedSeats` libera los `BLOCKED` previos, bloquea solo `AVAILABLE` y **nunca toca `RESERVED`/`OCCUPIED`**. Y `getSeatsForEvent` expira las `PENDING` viejas antes de leer y no pisa `BLOCKED`.
12. `GET /api/cron/cleanup`: sin `Authorization` → 401 y cero escrituras; con el secreto → expira la de 6 minutos y **no** la de 4, borra el evento de 91 días y **no** el de 89, y la cascada se lleva reservas y `SeatStatus`.

### 3.4 E2E (`tests/e2e/`, Playwright)

`playwright.config.ts` con `locale: "es-ES"` y `timezoneId: "Europe/Madrid"` (la UI elige idioma por `navigator.language`), `workers: 1`, y **tres proyectos**: `setup`, `public` (viewport móvil, que es como se usa) y `admin` (escritorio). El rol WORKER y los tests de API no necesitan proyecto propio: `test.use({ storageState })` y el fixture `request` bastan.

**`webServer` levanta `next build` + `next start` en el puerto 3100, nunca `next dev`.** En Windows, `next dev` compila cada ruta en el primer hit y el primer test se pasa 20-40 s esperando: flakiness garantizada.

**Contra la base `lounge_test` de Docker. Nunca contra Supabase**, porque el E2E crea reservas y cambia asientos.

**Redsys.** Se descarta una ruta stub en el servidor bajo flag de entorno: añadiría a producción un endpoint capaz de confirmar reservas cuya única protección es una variable bien puesta. Quedan dos mecanismos, y hacen falta los dos porque cubren caminos distintos:

1. **`page.route()` sobre el host de Redsys** (camino del navegador). El handler responde un **303** hacia la `URLOK`/`URLKO` que la propia app acaba de firmar. Detalle que no es obvio: **el `orderId` no viaja en la URL**, sino dentro de `Ds_MerchantParameters`, un JSON en base64 en el cuerpo del POST. Reutilizar las URLs firmadas en vez de reconstruirlas hace que el test sobreviva a un cambio de formato.
2. **Notificación firmada de verdad contra `/api/payments/notify`** (camino servidor-servidor). Se extrae `signNotification()` de `scripts/simulate-redsys-notify.ts` a un módulo importable; el script sigue funcionando igual.

⚠️ Con `REDSYS_ENV=""` la página de confirmación **autoconfirma**, lo que simplifica el escenario "ok" pero **enmascara el camino real de producción**. Por eso están separados: el de navegador pasa por la autoconfirmación, el de webhook no navega a la confirmación.

`global.setup.ts` siembra los 47 asientos reales, los dos roles y cinco eventos con fechas calculadas (+24 h clicable, +72 h demasiado pronto, +2 h demasiado tarde, uno solapado, uno pasado con reservas), y hace login una vez por rol guardando `storageState`. ⚠️ El rate limit son 5 intentos por IP en un `Map` que vive mientras viva el servidor: el spec negativo usa `extraHTTPHeaders: { "x-forwarded-for": … }`, que es de donde `auth/actions:15-16` saca la IP. Eso lo hace **realmente testeable** en E2E.

**Los 7 escenarios:**

1. **Compra completa**: home → los eventos fuera de ventana no navegan y muestran tooltip → condiciones → dos asientos → el total dice `23,00€` → RESERVAR → `"a"` da error y no navega → nombre válido → intercept → confirmación con nombre, asientos y total → **assert en BD**: `CONFIRMED`, 2 `OCCUPIED`, `seatPriceCents=1000`, `managementFeeCents=150`, `totalPrice=23`. Y después, los dos asientos salen ocupados y no clicables, también en el evento solapado.
2. **Pago rechazado** → `/reserva/error`, reserva `CANCELLED`, asientos liberados.
3. **Webhook** (sin navegador): notificación firmada OK → `CONFIRMED` + recibo con `authorisationCode` y `paymentDateTime`; firma corrupta → 200 y reserva intacta.
4. **Login y roles**: `/admin/eventos` sin sesión redirige; credenciales malas; 5 fallos desde la misma IP bloquean y desde otra no; un WORKER solo ve "Administrar reservas".
5. **CRUD de evento**: crear uno de fútbol y uno de Fórmula 1 (el formulario colapsa a un campo), verificar el título y que se crean 47 `SeatStatus`, cambiar el fee y ver el precio nuevo en el plano público.
6. **Bloqueo de asientos**: bloquear tres → no disponibles en público → desbloquear → vuelven.
7. **PDFs**: `page.waitForEvent("download")` para ticket y recibo, `waitForEvent("popup")` para el informe mensual. Marcado `@slow`. ⚠️ `/admin/asientos` usa `window.alert` nativo: `page.on("dialog", d => d.accept())` **antes** del clic, o el test se cuelga hasta el timeout.

**`data-testid` a añadir.** Hoy no hay ninguno. Criterio: solo donde no hay rol o nombre accesible estable, más los tres pasos del camino del dinero. Dos motivos concretos: el único selector estable de un asiento es hoy el `title`, y el separador es `-` en el flujo público pero `—` en el de admin; y el botón de login dice `"Iniciar sesion"` **sin tilde**, así que un selector por texto se rompe el día que alguien corrija la falta.

- `floor-plan-map.tsx` → `data-testid="seat"` + `data-seat-code` + `data-seat-state`. El más valioso.
- `eventos/[id]/client.tsx` → `conditions-accept`, `reserve-button`, `selection-total`, `name-modal`, `customer-name-input`, `name-error`, `pay-button`.
- `event-row.tsx` → `event-row` + `data-event-id` + `data-locked`, en **las dos ramas** (el `<div>` bloqueado y el `<Link>`), y `event-row-tooltip`.
- `reserva/confirmacion/[orderId]/client.tsx` → `ticket`, `ticket-total`, `ticket-seats`, `ticket-pdf`.
- `admin/login/client.tsx` → `login-email`, `login-password`, `login-submit`, `login-error`.
- Admin: las 4 tarjetas del dashboard, el botón de asiento de `bloquear/client.tsx`, `save-positions`, y el submit del formulario de evento.

Son atributos `data-*`, inertes para React y Tailwind: el comportamiento no cambia. Van en un commit propio y aislado.

### 3.5 CI — `.github/workflows/ci.yml`

Dos jobs, en `push` y `pull_request`:

| Job | Qué hace | Duración |
|---|---|---|
| `static` | `npm ci`, `prisma generate`, `lint`, `typecheck`, `format:check`, unitarios y componentes con cobertura. Sin BD. | ~2 min |
| `db` | `services: postgres:17-alpine`, `prisma migrate deploy`, integración, `playwright install chromium`, `build:e2e`, E2E | ~10 min |

- **`npx prisma generate` en los dos jobs, sin excepción.** `src/generated/prisma` está en `.gitignore`: sin ese paso, `tsc --noEmit` y `eslint` fallan con "cannot find module `@/generated/prisma`". Es el error que aparecerá el primer día si se olvida.
- **Solo Chromium.** El proyecto no promete soporte cross-browser.
- **Cero secretos reales.** Todo el entorno se genera en el workflow con los valores **públicos** del sandbox genérico de Redsys, ya documentados en `.env.example`; `AUTH_SECRET` se genera aleatorio en el runner. Nunca un secreto de Supabase ni la clave de CaixaBank.
- **Qué NO corre en CI**: nada contra Supabase, ninguna llamada real a ESPN, ningún `db:reset`.
- **Protección de rama**: `static` bloqueante siempre; `db` bloqueante en PR.

Umbrales de cobertura **solo sobre `src/modules/**/domain/**`, `lib/**` y `config/**`** (~90%), nunca sobre `app/` ni `components/`: un porcentaje global obliga a testear JSX decorativo y convierte la cobertura en una métrica que se persigue en vez de una red de seguridad.

---

## Fase 4 — Documentación profesional

Los 13 `.md` históricos de la raíz se mueven a `docs/historico/` **con `git mv` y sin editar** (preservan historia y siguen siendo material citable), con un `README.md` en esa carpeta que avise de que describen el esquema de entornos anterior al renombrado. La raíz queda con `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE` y `MASTER_IA.md`.

**`README.md` reescrito** — descripción, stack con versiones, requisitos, instalación, **la tabla de entornos y cómo arrancar cada uno**, variables corregidas (fuera el `file:./dev.db`), tests, estructura, arquitectura con diagrama, funcionalidades cliente y admin, tabla de roles, despliegue, y badges de CI y cobertura.

**`CHANGELOG.md`** — derivado del `git log`: 72 commits desde el 2026-01-27, 70 con prefijo convencional (27 `fix:`, 23 `feat:`, 9 `docs:`, 4 `chore:`, 3 `ci:`, 2 `security:`). Agrupado por mes y por tipo, en formato Keep a Changelog. No hay que inventarlo, se genera y se repasa a mano; cuenta muy bien ocho meses de proyecto para la defensa.

**`LICENSE`** — propietaria a nombre de Ramón Cavero, todos los derechos reservados. El software está cedido en uso a la propietaria del bar, no es open source y poner un MIT sería falso.

**`docs/`:**

- `arquitectura.md` — capas, módulos por dominio, flujo de datos, y **diagramas Mermaid**: contexto del sistema, secuencia completa del pago con webhook y fallback, y máquina de estados de `Reservation`.
- `modelo-de-datos.md` — los 7 modelos con sus campos, el diagrama entidad-relación, los invariantes (incluido el `CHECK` de importes y el `@@unique([eventId, seatId])`), el desglose congelado en la reserva, y los campos vestigiales (`Seat.zone/row/number`) con el porqué de que sigan ahí.
- `entornos.md` — los cuatro entornos, la tabla de ficheros `.env`, la convención de scripts, el guard `DB_ENV`, y el procedimiento de migración a producción.
- `testing.md` — estrategia y pirámide, cómo levantar Docker, cómo se simula Redsys, cómo leer la cobertura.
- `seguridad.md` — modelo de amenazas, autenticación de doble capa (middleware + `requireAuth`), rate limiting, verificación de firma HMAC, por qué el recibo no es server action, y el cierre de la auditoría de abril de 2026.
- `adr/` — **seis decisiones reales ya tomadas**, no inventadas: (1) Redsys en modo redirección; (2) importes en céntimos enteros con desglose congelado y `CHECK` en BD; (3) el recibo solo lo escriben webhook y ruta de retorno, y `paymentDateTime` es texto y no `DateTime`; (4) `/api/payments/return/[orderId]` con 303 en vez de `page.tsx`; (5) escudos servidos en local en lugar de hotlink a ESPN; (6) entornos con base de datos separada por rama.
- `desarrollo-asistido-por-ia.md` — **el eje diferencial**: planificar antes de ejecutar (los `PLAN_*.md` versionados son la evidencia), `CLAUDE.md` como contrato de arquitectura legible por la IA, los scripts de verificación previos a cada migración (`verify-management-fee.ts`, `sync-verify.ts`, `db-whoami.ts`) como red frente a cambios generados, qué se validó a mano y por qué, y qué salió mal — el incidente de agotamiento del pool de julio de 2026 está documentado y sirve de caso real.

**`CONTRIBUTING.md`** — flujo de ramas, convención de commits y cómo correr los tests.

---

## Fase 5 — Presentación

Deck de ~20 diapositivas 16:9 publicado como Artifact (enlace propio, navegable y descargable; de ahí se puede llevar a Google Slides o Canva si el máster exige un formato concreto), en dos bloques:

- **Producto, sin tecnicismos** (~8): el problema real del bar, a quién sirve, el flujo del cliente en tres pantallas con capturas, el panel de administración, y qué ha cambiado desde que está en producción.
- **Técnico** (~12): arquitectura y decisiones (2-3 ADRs con su porqué), el flujo de pago con su diagrama de secuencia, la estrategia de tests con la pirámide y la cobertura conseguida, el CI, el bloque de desarrollo asistido por IA, y aprendizajes — incluyendo la carrera encontrada al escribir los tests, que es la mejor prueba de que la suite sirve para algo.

Antes de montarlo hay que capturar pantallas de la app desplegada en `academic`.

---

## Orden de ejecución

Las fases 1 a 3 se trocean así, y **el orden importa más que el contenido**: la caracterización va antes que el refactor, o no hay forma de demostrar que el refactor no cambió nada.

| Paso | Qué | Riesgo |
|---|---|---|
| **P0** | Fase −1 y Fase 0 completas: docstrings, Node, renombrado de entornos, esquema `academic`, backup, rama, Vercel, GitHub. | Bajo, pero es donde se toca producción |
| **P1** | Andamiaje: devDeps, `vitest.config.ts`, `tests/setup/*`, Docker Compose, scripts, ESLint, y un test trivial que valide la tubería en Windows. **Cero cambios en `src/`.** | Nulo |
| **P2** | Tests de caracterización sobre lo que ya es puro. Después, las exportaciones triviales. | Bajo |
| **P3** | Integración con BD real, **todavía sin refactor**: aquí se captura el comportamiento que P4 no puede cambiar. | Bajo |
| **P4** | Extracción de dominio, **un módulo por commit, de menor a mayor riesgo**: `overlap` → `expiry` → `availability` → `report-months` → `title` → borrar `createReservation` → **`amount` (dinero)** → **`apply-payment-outcome` (dinero)** → borrar el resto del código muerto. | Alto en los dos últimos |
| **P5** | E2E: los `data-testid` en un commit aislado, luego config y escenarios, luego el job de CI. | Bajo |
| **P6** | Umbrales de cobertura y cierre. | Bajo |

**La documentación (fase 4) y la presentación (fase 5) van en paralelo a partir de P3**: no dependen del refactor, y conviene escribirlas mientras el contexto está fresco en lugar de dejarlas para el final, que es cuando se entregan a medias.

---

## Verificación

1. `npm run ci:local` — lint, typecheck, unitarios, componentes e integración. Limpio.
2. `npm run test:integration` **dos veces seguidas** — que pase dos veces es lo que demuestra el aislamiento entre tests.
3. **Probar el guard a propósito, una vez**: lanzar la integración con `.env.production` cargado debe **abortar** por `DB_ENV`. Si no aborta, parar todo y arreglarlo antes de seguir.
4. `npm run test:coverage` — la capa de dominio por encima del umbral.
5. `npm run e2e` — en verde; revisar el reporte HTML.
6. CI verde en el primer push a `academic`, y un despliegue de preview vacío en P0 para confirmar que Vercel sigue construyendo antes de acumular cambios.
7. `git diff testing...academic -- src/` revisado entero: ni un cambio de comportamiento no intencionado.

### Lo que hay que verificar a mano, sin excusa

1. **Un pago real en el TPV de pruebas, antes y después** de las dos extracciones de dinero. Comparar `totalPrice`, `seatPriceCents` y `managementFeeCents` de las dos reservas, y que `verify-management-fee.ts report` siga dando lo mismo.
2. Que el recibo sigue imprimiendo el código de autorización tras extraer `apply-payment-outcome`.
3. Que `cleanup` sigue expirando a los **5** minutos y no a los 30: el paso que renombra la variable mentirosa es justo donde podría colarse el error.
4. Que `/` sigue bloqueando los eventos a >48 h y <4 h **en un móvil real**.
5. Que el plano de `/admin/asientos` no se ha movido ni un píxel tras el commit de `data-testid`.
6. Que `db:whoami:prod` sigue imprimiendo lo mismo al final de todo que al principio.

---

## Riesgos

| Riesgo | Por qué existe | Mitigación |
|---|---|---|
| El pooler de Supabase ignora el `search_path` | Modo transacción es restrictivo con los parámetros de conexión | **La prueba de humo del paso 7 de la Fase 0**, antes de construir nada encima. Plan B: tercer proyecto Supabase, nunca la conexión directa para la app |
| Un `migrate` o `TRUNCATE` contra **producción** | Había un defecto implícito que apuntaba a producción | Invertir el defecto (`.env` = local), `DB_ENV` en cada fichero, `requireDbEnv()` en los scripts destructivos, y el entorno siempre en el nombre del script |
| El refactor de importes mueve un céntimo | Es dinero, con reservas reales ya cobradas | Caracterización antes de mover; diff literal de la expresión; invariante `totalPrice*100 = (seat+fee)*n`; pago real de prueba antes y después |
| Se "unifican" los `where` de confirmar y cancelar | Parecen iguales y no lo son | El escenario 8 de integración |
| **La carrera de asientos es un bug real de producción** | El chequeo va fuera de la transacción | Arreglarlo en `academic` es correcto, pero decidir **aparte** si se porta a `main` como hotfix: afecta a clientes reales |
| Tests dependientes del huso horario | `monthRange` usa constructores de fecha locales | `TZ` fijado en el config de Vitest, en el workflow y en Playwright |
| El `Map` de `rate-limit` filtra entre tests | Estado de módulo compartido en el proceso | `vi.resetModules()` + import dinámico por test |
| El E2E se cuelga en `/admin/asientos` | `window.alert` nativo bloqueante | `page.on("dialog", …)` **antes** del clic |
| `src/generated/prisma` no existe en CI | Está gitignoreado | `npx prisma generate` en los dos jobs |
| Las previews de Vercel están protegidas | Deployment Protection activada por defecto en algunos planes | Comprobarlo en el paso 15 de la Fase 0: si no, Redsys no puede llamar al webhook |
| Docker Desktop parado | Está instalado pero el daemon no corre | El script hace `docker info` primero y falla con un mensaje claro. En CI no aplica |
| Mover 13 `.md` genera un diff enorme | `git mv` masivo | Commit propio y separado |
