# Plan: preparar `lounge-app` como entrega de máster

> **Plan original: 21 de septiembre de 2026.**
>
> **Ejecutado: las fases −1, 0 y 1, y los pasos P2** (tests de caracterización), **P3** (tests de integración), **P4** (extracción de dominio), **P5** (E2E con Playwright) **y P6** (CI y cobertura). Esas secciones
> describen **lo que realmente se hizo**, que en varios puntos no fue lo planeado. El resto del
> texto es el plan tal como se concibió.
>
> **Numeración.** Las «Fase N» de este documento agrupan por **tema**; Linear numera por
> **orden de ejecución**, y por eso su «Fase 2» es la caracterización y no la capa de dominio.
> Para no mezclarlas, aquí el orden se cita siempre como **P0–P10**, y la tabla de
> [Orden de ejecución](#orden-de-ejecución) da la tarjeta de Linear de cada paso.
>
> El detalle de cada desvío, con su porqué y su verificación, está en las tarjetas del proyecto
> **"Máster desarrollo software IA"** en Linear.
>
> **Rama de trabajo:** `academic`. **`main` y `testing` no se tocan.**

---

## Contexto

`lounge-app` es una aplicación real en producción: reservas de asientos para un bar deportivo en Valencia, con cobro real por Redsys. Hay que entregarla como proyecto de un máster de desarrollo de software con IA, lo que exige tres cosas que no existían: suite de tests, documentación profesional y una presentación.

Estado de partida el 21 de septiembre, verificado entonces:

- **Cero tests, cero CI, cero `data-testid`.** `package.json` solo tenía `dev`, `build`, `start`, `lint` y los `db:*`.
- La lógica de negocio vive dentro de server actions `"use server"`, mezclada con Prisma, con **duplicaciones literales** (importes, solape de eventos, títulos, resultado del pago).
- 17 `.md` en la raíz (5.653 líneas), mezcla de documentación viva y planes ya ejecutados.
- 72 commits desde el 2026-01-27, 70 de ellos con prefijo convencional.

**Hallazgos de partida y su estado actual:**

| Hallazgo | Estado |
|---|---|
| `initializePayment` comprueba la disponibilidad **fuera** de la transacción y el `updateMany` no filtra por `AVAILABLE`: dos clientes simultáneos sobre el mismo asiento pasan los dos | **Abierto.** Bug real en producción |
| `cron/cleanup`: la variable `thirtyMinutesAgo` calcula 5 minutos | **Resuelto en P4**: el plazo vive en `reservations/domain/expiry.ts`, con nombre, y vale lo mismo |
| Ventana de reservas: el código usa **48h–4h**, la documentación dice 48h–5h | Abierto, se corrige al reescribir el README (Fase 4). Desde P2, un test fija las dos fronteras al minuto |
| Código muerto: `seat.tsx`, `seat-map.tsx`, `header.tsx`, `footer.tsx`, `createReservation` | **Resuelto en P4**, junto con `getSeatsByZone` |

**Hallazgos nuevos, aparecidos durante la ejecución:**

- **`npm run lint` fallaba con 533 errores y 1761 avisos**, igual en `main`. **Resuelto en 1.4**: estaban todos en el cliente generado por Prisma, que nunca debió entrar en el lint. La deuda real eran 3 errores, **arreglados en P6**: `npm run lint` está a cero.
- **Dos fugas de seguridad en el repositorio**, ya resueltas (ver 0.6).
- **Una tercera, que la auditoría de 0.6 no vio**: `prisma/seed.ts` crea un admin con el email real y la contraseña `12345678`, en claro y en todo el historial. **Abierta (RCA-275, urgente)**: hay que comprobar que ninguna cuenta viva la usa **antes de publicar el repositorio**. Ver P2.4.
- **Un pago que llega después de expirar la reserva se cobra sin asientos.** Bug de producción que sacó a la luz la integración. **Abierto (RCA-276, alta)**. Ver P3.4.
- **`initializePayment` no comprueba en servidor la ventana de reserva ni el estado del evento**: la ventana solo la aplica la portada, y por enlace directo se puede comprar un partido que empieza en una hora. **Abierto (RCA-277, media)**. Ver P3.4.

---

## Los tres entornos — regla dura

| Rama | Base de datos | Vercel | Redsys | Quién la toca |
|---|---|---|---|---|
| `main` | Supabase producción | Production → `lounge-app-neon.vercel.app` | **producción (real)** | Nadie durante la entrega |
| `testing` | Supabase testing | Preview → `lounge-app-titanium.vercel.app` | sandbox | Nadie durante la entrega |
| `academic` | **la misma de testing** | Preview → `lounge-app-academic.vercel.app` | sandbox | **La única rama que se toca** |
| local | Postgres en Docker (`lounge_dev`) | — | sandbox | Desarrollo |
| tests | Postgres en Docker (`lounge_test`) | — | sandbox | Vitest y Playwright |

> **`academic` y `testing` comparten base de datos, y eso es deliberado.** El plan original le
> daba a `academic` su propio esquema (`?schema=academic`). La puerta de la Fase 0.2 lo tumbó:
> ver 0.4.
>
> Consecuencia: **no existe `DB_ENV=academic`**. Hay un nombre de entorno por base de datos, no
> por despliegue, porque si no un script destructivo lanzado "contra academic" escribiría en
> testing sin avisar. Para trabajar en local contra esa base se usa `npm run dev:testing`, se
> llame como se llame la rama activa.
>
> Consecuencia operativa: **`academic` no se siembra**. Nada de `db:seed` contra esa base —
> crearía un usuario admin con contraseña conocida en un entorno compartido. Los eventos, las
> reservas y los usuarios (ADMIN y WORKER) los crea Ramón a mano desde testing, y los renueva
> periódicamente para que el proyecto tenga actividad cuando lo revisen.

- `academic` **no sustituye** a `testing` en Vercel: cada rama genera su propio Preview con su propia URL. Conviven.
- **Nunca** se mergea `academic` hacia `testing` ni `main` mientras dure la entrega.
- Protección de rama en GitHub para `main` y `testing`.
- En `academic` **jamás** entran las credenciales reales de CaixaBank, solo sandbox.
- Vercel **no ejecuta crons en Preview**: en `academic` se llaman a mano con `CRON_SECRET`.

---

## Fase −1 — Poner en orden `main` y `testing` · EJECUTADA

Los ficheros `.env*` están gitignorados: hay **un solo sistema de ficheros y no tienen rama**. En cuanto se renombrara `.env`, la realidad dejaría de coincidir con las docstrings de las tres ramas a la vez. No se podía "renombrar solo en academic", así que esto fue lo primero.

El daño real, medido antes de actuar: **dos líneas de comentario en dos ficheros**, `scripts/backup-prod.ts:14` y `scripts/rename-seats.ts:18`. Todo lo demás que mencionaba `.env` eran documentos históricos o lecturas de `process.env.X`, que no dependen del nombre del fichero.

**Lo que se hizo.** Las docstrings dejaron de afirmar qué contiene cada fichero —que es lo que se queda obsoleto— y pasaron a apuntar al único gate que no miente: la primera línea de salida de esos scripts, que imprime el ref del proyecto Supabase realmente conectado.

Desvío respecto al borrador: en `rename-seats.ts` **no se nombra ningún fichero**, porque ese script se usa contra los tres entornos. Su docstring ya no afirma nada que un renombrado pueda invalidar.

Commit en `main`, cherry-pick sobre `testing`, push de las dos. **Única excepción a "no se tocan", y fue un commit de solo comentarios.**

**Verificado:** el diff no contenía ni una línea de código, `npm run build` seguía pasando en `main`, y `db-whoami` contra producción imprimía su ref y sus conteos de siempre.

**Los documentos históricos no se tocaron.** Los `PLAN_*.md` y `MIGRACION_*.md` siguen como estaban: son el registro de lo que era cierto cuando se escribieron.

---

## Fase 0 — Entornos aislados · EJECUTADA

### 0.1 Node — se fue a la 24, no a la 22

**El plan estaba equivocado en su premisa.** Proponía subir a la Node 22 LTS por higiene. Al preguntar por la configuración de Vercel apareció que el proyecto **llevaba desde el principio en Node 24.x**, mientras la máquina de desarrollo corría 22.11: todo el proyecto se había escrito en una versión mayor distinta de la que sirve a los clientes.

El ajuste que se iba a aplicar (`engines: ">=22.12.0 <23"`) habría **bajado producción de Node 24 a Node 22** en el siguiente despliegue de `main`. Se detuvo a tiempo.

**Lo que se hizo:** alinear local hacia arriba a **24.21.0**, no Vercel hacia abajo. `.nvmrc` con `24.21.0`, `engines.node` a `"24.x"` —que dice literalmente lo mismo que el panel de Vercel— y `@types/node` a `^24`. Un rango abierto como `">=22.12.0"` resolvía al mayor disponible: acertaba por accidente, sin decirlo.

Tras el cambio de versión mayor (ABI 127 → 137) se hizo `npm ci` limpio. Verificado: build, typecheck, los tres entornos y el servidor sirviendo contra la base local.

### 0.2 Los entornos renombrados

El problema de fondo no era la incantación `set -a && . ./.env.testing && set +a`, sino que **`.env` apuntaba a producción y se cargaba solo**: `prisma.config.ts` hace `import "dotenv/config"` y Next lo lee en cada `next dev`. El caso por defecto era el peligroso. Se invirtió:

| Fichero | Apunta a | `DB_ENV` |
|---|---|---|
| `.env` | Docker local, base `lounge_dev` | `local` |
| `.env.test` | Docker local, base `lounge_test` | `test` |
| `.env.testing` | Supabase testing *(sin tocar)* | `testing` |
| `.env.production` | Supabase producción *(el `.env` de antes)* | `production` |

**Son cuatro, no cinco.** No hay `.env.academic`: comparte base con testing.

**El guard**: `scripts/lib/require-db-env.ts` expone `requireDbEnv(...)`, que aborta si el entorno cargado no es uno de los esperados. **Falla cerrado**: sin `DB_ENV` declarado también aborta. Probado con los tres casos.

Lo llama `rename-seats.ts apply`. **`sync-reset.ts` no lo usa a propósito**: su `--confirm <project-ref>` ya obliga a teclear el proyecto concreto al que estás conectado, que es una comprobación más fuerte. Ponerle las dos habría sido sobreingeniería.

`backup-prod.ts` pasó a `backup-db.ts` —sirve para cualquier entorno, el nombre mentía— y el volcado va ahora a `backups/<DB_ENV>-<fecha>.json`.

`db-whoami` imprime ahora el `DB_ENV` autodeclarado primero y el destino real debajo: con una URL local decía "(ref no reconocido)", que era ruido justo en la herramienta que usas para no equivocarte de base.

**`.gitignore`**: no hizo falta añadir nada para los entornos, ya tenía `.env*` con excepción de `.env.example`. Sí se amplió `backups/*.json` a **`backups/*`**: un `pg_dump` se llama `.dump` y la regla antigua no lo cubría — de hecho estuvo a punto de colarse uno en un commit.

### 0.3 Docker local

Un solo `docker-compose.yml` con `postgres:17-alpine` en el puerto **5433**, volumen persistente y un `initdb` de una línea que crea la segunda base. Dos bases en el mismo contenedor: `lounge_dev` para desarrollar y `lounge_test` para los tests, separadas para que la suite no borre los datos de trabajo.

**Confirmado empíricamente lo que el plan avisaba**: la base local se crea con `prisma migrate deploy` y **tiene la restricción `reservation_total_matches_breakdown`**. Ese `CHECK` vive como SQL crudo dentro de una migración y no está en `schema.prisma`, así que con `db push` no existiría y los tests de dinero pasarían en falso.

### 0.4 La puerta que tumbó el aislamiento por esquema

El plan daba a `academic` su propio esquema dentro del proyecto Supabase de testing, con una prueba de humo previa para confirmar que el `search_path` se respetaba. **La prueba falló, y falló rompiendo testing.**

Supavisor en modo transacción (puerto 6543) reutiliza conexiones de backend entre clientes. El `SET search_path` que Prisma emite al conectar con `?schema=academic` **persiste en ese backend**, y el pooler se lo entrega después a un cliente que no pidió ningún esquema. Una conexión de testing acabó con `search_path = {academic}` —un esquema vacío— y testing dejó de responder con `42P01 relation "_prisma_migrations" does not exist`.

Detalle que despistó: por `psql` el pool se veía limpio, 20 de 20. Supavisor segrega pools por parámetros de arranque, así que `psql` y Prisma caen en pools distintos. **Hay que medir con el mismo cliente que sufre el problema.**

**Resolución:** esquema eliminado, `.env.academic` borrado, pool de Prisma saneado con 150 `SET search_path` sobre 25 conexiones en paralelo. Testing verificado 8 de 8 con sus conteos intactos. **Sin pérdida de datos**: el esquema nunca llegó a tener tablas. Producción nunca estuvo en riesgo — es otro proyecto, con su propio pooler.

**Decisión final:** `academic` comparte la base de testing, sin parámetro `schema`. Precisamente por no mezclar esquemas, la filtración no puede repetirse.

### 0.5 Scripts de `package.json`

**Sin sufijo = local. Con sufijo = remoto y explícito.** Nada remoto es nunca el defecto.

```
dev  dev:testing
typecheck  lint  build  start
db:up  db:down                                      → Docker
db:migrate  db:deploy  db:push  db:seed  db:studio  → local
db:whoami          + :testing  :prod
db:deploy:testing    :prod
db:studio:testing
db:backup:testing    :prod
```

No hay variantes `:academic`: serían un segundo nombre para la misma base de datos. Los scripts de test llegan en la Fase 1, junto con Vitest y Playwright.

### 0.6 Las dos fugas de seguridad que aparecieron al auditar

Antes de considerar publicar el repositorio se auditaron los 72 commits. Aparecieron dos cosas, **ninguna introducida por este trabajo**:

1. **El `AUTH_SECRET` de producción, en texto plano**, en `MIGRACION_SUPABASE.md` y `MIGRACION_SUPABASE_3_ENTORNOS.md`, commiteado desde marzo. Por comparación exacta, era **el valor vivo** de testing y producción: permitía forjar una cookie de sesión de administrador sin conocer ninguna contraseña. Y testing y producción **compartían el mismo valor**.
2. **`backups/dev.db.backup.20260202_232141`**, SQLite con 14 correos y 4 hashes bcrypt, trackeado desde febrero.

El resto salió limpio: sin JWT ni claves de Supabase, sin claves PEM, y todas las URLs de Postgres con `[PASSWORD]` de marcador.

**Resolución.** Una pasada de `git filter-repo`: el secreto sustituido por `***REMOVED***` en todos los commits —conservando los documentos íntegros como registro de decisiones— y el backup SQLite purgado entero. Force-push a las **cuatro** ramas (`main`, `testing`, `academic`, `dev`; `dev` se escapó en el primer intento y lo pilló la verificación). Después se **rotó el `AUTH_SECRET`**, con valores independientes para testing y producción.

**Todos los SHA desde `b46f5ba` (30 de marzo) cambiaron.** Cualquier hash de commit citado en documentos anteriores ya no existe.

Queda un residual anotado: un force-push no borra los objetos de GitHub de inmediato, así que los commits viejos pueden seguir sirviéndose por su SHA directo hasta que pase el recolector. Con el secreto rotado ya no abre ninguna puerta, pero conviene resolverlo antes de hacer público el repositorio.

### 0.7 Verificación de cierre

| Comprobación | Resultado |
|---|---|
| Los tres entornos con destinos distintos | local `lounge_dev` · testing `tdkiretm…` · producción `vxfvfuqm…` |
| `BASE_URL` de cada despliegue | cada uno devuelve a su propio dominio |
| `academic`: home, `/admin`, cron sin secreto | 200 · 307 a login · **401** |
| Acceso público a la preview | sí, sin login de Vercel |
| **Pago completo en `academic`** | `CONFIRMED`/`COMPLETED`, invariante del dinero OK, recibo con autorización y fecha, asientos en `OCCUPIED` |

Ese último cierra el camino que **no se puede probar en local**, porque Redsys no alcanza `localhost`: navegador → Redsys → notificación firmada → webhook → confirmación y ocupación de asientos en una transacción → recibo.

De paso quedó comprobado que **el recibo lleva funcionando en producción desde principios de septiembre**: 7 de 111 reservas confirmadas lo tienen completo, las demás son anteriores al despliegue de la funcionalidad. Los códigos de autorización reales llegan **alfanuméricos** (`U6N2PG`), no solo numéricos como en el sandbox.

---

## Fase 1 — Tooling de calidad · EJECUTADA

Fase de riesgo cero por diseño: **no cambia una sola línea de `src/`**. Solo añade ficheros de test y el andamiaje que los ejecuta. Tres commits: `f3093bb`, `3a9e7ac`, `308f1df`.

### 1.1 Los tres proyectos de Vitest

`vitest.config.mts` — con extensión `.mts` y no `.ts`, porque Vite avisa de que carga el config como CommonJS y este proyecto no es `"type": "module"`.

| Proyecto | Entorno | Qué recoge |
|---|---|---|
| `unit` | node | `src/**/*.test.ts` y `tests/unit/**` |
| `ui` | jsdom | `src/**/*.test.tsx` |
| `integration` | node | `tests/integration/**`, contra Postgres de verdad |

Se mantuvo del plan:

- **Ningún test bajo `src/app/`.** El App Router escanea ese árbol para descubrir rutas, así que un `page.test.tsx` suelto se convertiría en una ruta de la aplicación. Los tests de handlers van en `tests/integration/`, importando la ruta.
- **Alias `@/` escrito a mano**, dos líneas, sin `vite-tsconfig-paths`. Y sin `@vitejs/plugin-react`: Vite ya transforma `.tsx` con esbuild respetando el `tsconfig`, y lo único que aportaría el plugin es Fast Refresh.
- Imports explícitos desde `vitest`, sin `globals`.

Cambió al ejecutarlo:

- **`TZ` se fija sin condición**, no con `??=`. Madrid no es una preferencia de quien ejecuta los tests, es el huso del negocio; con `??=` la suite daría resultados distintos en cada máquina y la aserción que lo comprueba no podría existir. El motivo de fondo sigue siendo el mismo: `monthRange` construye los límites del mes con constructores **locales** de `Date`, y en UTC —como corre CI— el informe de enero se comería la última hora de diciembre.
- **`singleFork` ya no existe**: `poolOptions` desapareció en Vitest 4. El equivalente es `maxWorkers: 1` más `fileParallelism: false`. `isolate` se deja en su valor por defecto, así que cada fichero estrena proceso y cliente de Prisma: más lento y más determinista.

### 1.2 El entorno de los tests

**Comprobado: Vitest 5 no lee ficheros `.env` por su cuenta.** Al worker le llega un `process.env` pelado, y eso rompe antes de empezar porque `src/lib/redsys.ts` valida sus tres variables **en tiempo de import**. Cualquier test que arrastre ese import revienta aunque no toque la pasarela. Por eso `tests/setup/env.ts` las carga explícitamente.

Precedencia, de más fuerte a más débil: lo que ya venga en `process.env` (lo que inyecta CI) → `.env.test` si existe → los valores por defecto del propio fichero.

Los defectos cubren las credenciales **públicas** del sandbox de Redsys y los secretos de usar y tirar, para que la suite arranque en un clon limpio. **`DB_ENV` y `DATABASE_URL` se quedan sin defecto a propósito**: son las dos que deciden qué base de datos se vacía, y un valor por defecto las convertiría en algo que "ya funciona" sin que nadie lo haya dicho.

### 1.3 Aislamiento de la base de tests

`TRUNCATE ... RESTART IDENTITY CASCADE` antes de cada test, y no una transacción que se deshace: el código bajo prueba abre **sus propias** transacciones (`prisma.$transaction` en el flujo de pago) y envolverlo en una externa cambiaría lo que se está midiendo. El precio es que la suite va en serie.

La lista de tablas se le pregunta al catálogo de Postgres. Una lista escrita a mano se queda vieja en la primera migración, y el síntoma sería un test fallando por datos que creía borrados.

**`requireDbEnv("test")` se repite en dos sitios**: `db-global.ts` (proceso principal) y `db-each.ts` (worker). La comprobación va donde está el daño. Probado: con `DB_ENV=testing` aborta con código de salida 1.

### 1.4 Los 533 errores de lint eran del cliente de Prisma

El hallazgo que desbloquea la 3.5. `npm run lint` fallaba con **533 errores y 1761 avisos**, y estaban **todos** en `src/generated/prisma`: código que no escribimos, que no podemos arreglar, que está gitignorado y que se regenera en cada build. Nunca debió entrar en el lint.

Con `src/generated/**` en los ignores, la deuda real es de **3 errores y 5 avisos**:

```
src/app/eventos/[id]/client.tsx:67               react-hooks/set-state-in-effect
src/shared/components/info-banner.tsx:17         react-hooks/set-state-in-effect
src/modules/events/components/event-row.tsx:64   react-hooks/purity
```

No se tocan aquí, que esta fase no cambia `src/`. El tercero lo arregla sola la extracción de dominio (P4), al meter el reloj como parámetro en lugar de llamar a `new Date()` dentro del render.

> **Corrección posterior (P5):** P4 no tocó `event-row.tsx`, así que el tercero no se arregló. En P5, el primero y el tercero se silenciaron con `eslint-disable-next-line` para poder commitear esos ficheros; los tres se arreglan en P6, antes del lint bloqueante (RCA-273). Ver P5.3.

**Consecuencia: el `lint` bloqueante de CI (3.5) vuelve a ser viable**, sin baseline ni deuda congelada.

### 1.5 Prettier, husky y lint-staged

El repositorio tenía dos estilos conviviendo: lo generado por shadcn sin punto y coma, el resto con él.

**Adopción gradual**: el pre-commit formatea **lo que se toca**, no el repositorio entero. Así el ruido de formato aparece solo en ficheros que ya iban a salir en el diff, y `academic` no se separa de `main` por un reformateo masivo.

`printWidth: 90` es el único valor que se aparta del defecto, y por un motivo medible: de las 10.700 líneas de `src/`, 661 pasan de 80 columnas pero solo 265 pasan de 90.

El pre-commit corre `lint-staged` —Prettier primero y ESLint después, en ese orden, porque al revés ESLint arreglaría cosas que Prettier volvería a tocar— y `typecheck`. **No corre la suite**: un hook que tarda un minuto se acaba saltando con `--no-verify`, y un hook que se salta no protege nada. Los tests son trabajo de CI.

### 1.6 Verificación de cierre

| Comprobación | Resultado |
|---|---|
| `npm test` (unit + ui) | 15 tests en verde, 0,9 s |
| `npm run test:integration` | 7 tests en verde contra `lounge_test`, 1,5 s |
| Migraciones en la base de tests | las 5, incluido el `CHECK` que vive en SQL crudo |
| `npm run typecheck` | limpio |
| `npm run build` | limpio, y **la lista de rutas no cambia** |
| Puerta de la base de datos con `DB_ENV=testing` | aborta, código de salida 1 |
| `npm run lint` | los 3 errores preexistentes, ninguno nuevo |

**Queda fuera, para la 3.4**: `@playwright/test` está instalado pero sin configurar, y no hay script `e2e` todavía. Un script que apunta a un config que no existe solo sirve para confundir.

---

## Paso P2 — Tests de caracterización · EJECUTADO

Tests sobre el código que **ya era puro**, antes de refactorizar nada: son la red que permitirá demostrar que la extracción de dominio (P4) no cambió el comportamiento. Ejecuta la parte de 3.1 y 3.2 que no depende de extraer nada, y las exportaciones triviales de la Fase 2. En Linear, «05 · Fase 2». 15 commits, de `3f3005c` a `87a93cb`.

### P2.1 Qué quedó cubierto

| Módulo | Fichero de test | Tests |
|---|---|---|
| Nombre del cliente | `payments/lib/customer-name.test.ts` | 34 |
| Gastos de gestión | `events/config/pricing.test.ts` | 31 |
| Competiciones y su configuración | `football-data/config/competitions.test.ts` | 20 |
| `toSuggestion` | `football-data/lib/suggestions.test.ts` | 15 |
| Helpers de `team-sync` | `football-data/lib/team-sync.test.ts` | 24 |
| Emparejado de equipos (`planTeam`, `planCreate`) | `football-data/lib/team-sync.plan.test.ts` | 25 |
| `espnMonths`, `getTeamLogo` | `football-data/lib/api-client.test.ts` | 9 |
| Rate limit del login | `lib/rate-limit.test.ts` | 9 |
| `BASE_URL` | `lib/base-url.test.ts` | 5 |
| Asientos sembrados | `tests/unit/seats.test.ts` | 7 |
| `EventRow` (ventana de reservas) | `events/components/event-row.test.tsx` | 12 |
| `FloorPlanMap` | `seating/components/floor-plan-map.test.tsx` | 10 |

**201 tests nuevos**; con los 15 de la Fase 1, la suite `npm test` suma **216 en 2,6 s**.

Del 3.1 quedan fuera, a propósito, los importes, el solape de eventos, el resultado del pago, `resolveEventNaming`, `report-months` y `availability`: todavía no son funciones puras. Nacen en P4, y hasta entonces su red es la integración de P3.

### P2.2 Lo que sí tocó `src/` — sin cambio de comportamiento

1. **`safeManagementFeeCents` se movió a `events/config/pricing.ts`** (`3f3005c`), adelantando un punto de la Fase 2. Era interna de un fichero `"use server"`, donde no se puede exportar una función síncrona: sin moverla no había forma de testearla.
2. **Exportaciones de `football-data`** (`dbc03ea`): `espnMonths`, `planTeam`, `planCreate` y sus tipos, y `loadTeamIndex` partida en la consulta más un `buildTeamIndex(rows)` puro. Va precedida de un commit **solo de formato** (`1ddadd7`) para que este diff se pudiera revisar línea a línea: el cuerpo de `buildTeamIndex` es el bucle original, sin tocar.
3. **`prisma/seats.ts`** (`6814b1e`, el refactor previo de 3.3): el seed ya no declara los 47 asientos, los importa. El fichero se **generó con un script a partir de las líneas del seed**, no a mano, y se comprobó con `isDeepStrictEqual` que el array es idéntico al de antes. Ojo para el E2E: son los **códigos anteriores al renombrado** (`T1-A1`), no los del local (`A7.2`).

### P2.3 Cómo se comprobó que los tests sirven

Un test de caracterización que pasa a la primera no demuestra nada por sí solo. Los que protegen reglas caras se validaron **rompiendo el código a propósito** y viendo fallar el test correcto:

| Mutación | Qué falla |
|---|---|
| `safeManagementFeeCents` reescrita como `value \|\| DEFAULT` | solo el test del `0` |
| Sin la guarda del escudo local (`isLocal = false`) | 4 tests de `planTeam` |
| `planTeam` compara contra la fila ya mutada en memoria | solo el test del `externalId` pendiente |
| Frontera de 48 h inclusiva | solo el test de las 48 h |
| Frontera de 4 h inclusiva, o de vuelta a las 5 h de la documentación | solo el test de las 4 h |
| El plano deshabilita por estado sin mirar la selección | solo el test del asiento seleccionado que otro cogió |

Y una que **no** falló, anotada tal cual: quitar `vi.resetModules()` de los tests de `rate-limit` no rompe ninguno, porque todos arrancan en el mismo instante y lo que se filtra entre tests caduca a la vez. El reset se queda por higiene, pero hoy no está demostrado que haga falta.

### P2.4 Hallazgos

- **RCA-275, urgente — contraseña de admin en claro en `prisma/seed.ts`.** Email real y `12345678`, en todos los commits. La auditoría de 0.6 buscó secretos, claves y bases de datos, no credenciales de aplicación. Si alguna cuenta de producción o de testing se creó con ese seed y nunca cambió de contraseña, publicar el repositorio publica la llave del panel, y `academic` es una preview pública sobre la base de testing. **Antes de publicar**: comprobar con `bcrypt.compare`, en solo lectura, que ningún `AdminUser` vivo la usa, y sacarla del seed.
- **RCA-274, baja — los mapas por nombre aceptan claves del prototipo.** `isManualSport("constructor") === true`. Solo lo alcanza un admin autenticado mandando el valor a mano.
- **Comportamientos actuales, documentados como tales** en tests titulados `COMPORTAMIENTO ACTUAL:` —que tienen que cambiar de signo el día que se arreglen—: un evento ya empezado no se bloquea en `EventRow`; `toIntId("83abc") === 83`; las letras que NFD no descompone (`ø`, `ß`) desaparecen al normalizar nombres de equipo; y nada quita la barra final de `NEXT_PUBLIC_BASE_URL`. Ninguno falla con los datos reales, así que no llevan tarjeta.

La regla del plan se aplicó igual que con el `"Boxeo vs "`: **un fallo encontrado al caracterizar se documenta y se abre, no se arregla dentro de un commit de tests**.

### P2.5 Unicode oculto en el código

El test de nombres necesita caracteres invisibles y marcas bidireccionales. Escritos como secuencias de escape de JavaScript en la herramienta de edición, **acabaron literales en el fichero**: invisibles al leerlo y justo lo que GitHub marca como *hidden bidirectional Unicode*. Los tests pasaban igual, así que nada avisó. Se reescribieron con `String.fromCodePoint(0x…)` en constantes con nombre, y antes de cerrar se barrieron los 19 ficheros tocados en P2: **cero caracteres ocultos**.

### P2.6 Verificación de cierre

| Comprobación | Resultado |
|---|---|
| `npm test` (unit + ui) | 216 tests en verde, 2,6 s |
| `npm run typecheck` | limpio |
| `npm run lint` | los 3 errores y 5 avisos heredados. Hubo un sexto aviso, `lint-staged.config.mjs` de la Fase 1, corregido en `87a93cb` |
| `npm run build` | limpio, las mismas 24 rutas |
| Caracteres ocultos en los ficheros de P2 | 0 |

**No se ejecutó la integración**: Docker estaba parado, y P2 no toca nada de lo que prueba.

---

## Paso P3 — Tests de integración · EJECUTADO

Los caminos del dinero contra un PostgreSQL de verdad (`lounge_test` en Docker), **todavía sin refactorizar**: esto es lo que la extracción de dominio (P4) no puede cambiar. Ejecuta la 3.3 de este documento; en Linear, «06 · Fase 3». 8 commits, de `4326db7` a `c3be79f`. **`src/` no se tocó.**

### P3.1 Qué quedó cubierto

| Fichero | Qué prueba | Tests |
|---|---|---|
| `payments-initialize.test.ts` | Escenarios 1 a 6: camino feliz, asientos no disponibles, solape, entradas inválidas sin escrituras, congelación del desglose y el `CHECK` | 32 |
| `payments-confirm-cancel.test.ts` | Escenarios 7 y 8: el respaldo local de confirmar y cancelar | 12 |
| `payments-notify.test.ts` | Escenarios 9 y 10: webhook, recibo, y además la ruta de retorno `/api/payments/return/[orderId]` | 19 |
| `seating.test.ts` | Escenario 11: bloqueos, expiración al leer, el plano con eventos solapados | 18 |
| `cron-cleanup.test.ts` | Escenario 12: autorización, expiración y borrado en cascada | 12 |

**93 tests nuevos**; con los 7 del andamiaje de la Fase 1, la integración suma **100 en unos 6 s**.

Cosas que se miden en filas, no en valores devueltos:

- **Lo que va firmado hacia el banco.** Se decodifica `Ds_MerchantParameters` y se compara con lo guardado: `DS_MERCHANT_AMOUNT` es el mismo total en céntimos, `DS_MERCHANT_ORDER` es el `paymentId`, y las URL de vuelta apuntan a la ruta de retorno. Incluye un importe no redondo (3 × 10,50 € = `"3150"`) y un evento sin gastos de gestión.
- **"Cero escrituras"** se comprueba con una foto de reservas y `SeatStatus` antes y después, no contando filas: un `RESERVED` que se colara en un asiento libre también rompe la foto.
- **Las notificaciones se firman de verdad** con el sandbox y la ruta las verifica igual que en producción. Una firma con otra clave, o unos parámetros de OK pegados a la firma de un KO, devuelven 200 y no tocan nada.

### P3.2 Qué se desvió del plan

1. **La firma de notificaciones se extrajo ya** a `scripts/lib/redsys-notification.ts` (`33c27f8`). El plan lo tenía para el E2E (3.4), pero la integración la necesitaba antes. El script `simulate-redsys-notify.ts` la usa ahora, y se comprobó que **la firma sale idéntica byte a byte** a la de antes, en OK y en KO. Va precedido de un commit solo de formato (`4326db7`), como en P2.
2. **El reloj se congela, pero solo `Date`.** `freezeClock()` fija `Date` en `TEST_NOW`, así que "hace 6 minutos" significa lo mismo para la factory y para el código que expira. Los temporizadores siguen siendo reales, porque Prisma los necesita. Consecuencia útil: con el reloj congelado, `generateOrderId()` es determinista y el test comprueba el `paymentId` exacto.
3. **Sin `makeAdmin`.** Ningún test de P3 hace login: `requireAuth` se mockea, y que la action lo exige se comprueba con ese mock. La factory llega en P5, con el primer test que la use.
4. **Se añadió la ruta de retorno**, que no estaba entre los 12 escenarios: es la que anota el recibo desde el navegador, y la que compara el pedido de la URL con el firmado. Tiene cuatro tests.

### P3.3 El plan se equivocaba en una de las «tres trampas»

La trampa 1 de la Fase 2 decía que los `where` de confirmar y cancelar no se podían unificar porque cancelar liberaba también un `SeatStatus` cuyo `reservationId` ya fuera nulo. **No es así, y un test lo demuestra**: cancelar saca la lista de `seatId` de la relación `reservation.seatStatuses`, que va precisamente por `reservationId`. Un asiento sin vínculo no entra en la lista y se queda `RESERVED`.

En secuencia, los dos `where` tocan las mismas filas. Solo se distinguen con concurrencia: si entre leer la reserva y abrir la transacción otra reserva se queda el asiento, cancelar por `seatId` se lo quitaría. El test que el plan pedía se escribió al revés, como `COMPORTAMIENTO ACTUAL`, y la trampa está corregida más abajo. Es un buen ejemplo de por qué la integración va antes del refactor: la regla venía de leer el código, no de ejecutarlo.

### P3.4 Hallazgos

- **RCA-276, alta — un pago que llega después de expirar la reserva se cobra sin asientos.** Una reserva `PENDING` caduca a los 5 minutos, y la expira `getSeatsForEvent` en cuanto alguien abre la página del evento, soltando el vínculo con los asientos. Si el cliente tarda más que eso en la pasarela y paga, el webhook —que actúa sin filtro de estado— confirma la reserva, pero ocupar los asientos va por `reservationId` y ya no hay ninguno. **Se cobra, los asientos siguen a la venta y el ticket sale vacío.** Bug de producción; como la carrera de asientos, arreglarlo en `main` es una decisión aparte.
- **RCA-277, media — `initializePayment` confía en el cliente.** No comprueba la ventana de 48 h – 4 h ni el estado del evento, y la página `/eventos/[id]` tampoco: **por enlace directo se compra un partido que empieza en una hora, o uno cancelado.** Además, un asiento repetido se cobra dos veces y uno inexistente se cobra sin apartar nada, aunque esos dos solo los alcanza quien manipula la llamada y solo le perjudican a él.
- **Comportamientos actuales, fijados como tales**: un KO del webhook sobre una reserva `CONFIRMED` la cancela; un KO también anota recibo, sin código de autorización; y un pedido desconocido responde `{ ok: true }` en JSON en lugar del `OK` en texto que manda el resto de la ruta. Redsys solo mira el 200.

### P3.5 Cómo se comprobó que los tests sirven

Trece mutaciones sobre `src/`, aplicadas de una en una por un script que ejecuta el fichero afectado y restaura con `git checkout`. **Las trece matan al menos un test.**

| Mutación | Tests que fallan |
|---|---|
| Importe sin gastos de gestión | 17 |
| Sin validar el nombre | 4 |
| Confirmar sin la guarda de `PENDING` | 3 |
| Solape con `<=` (dos partidos pegados se solapan) | 2 |
| El KO del webhook no libera los asientos | 2 |
| Cancelar pisa una reserva `CONFIRMED` · recibo sin el cerrojo de `paymentDateTime` · ruta de retorno sin comparar el pedido firmado · expirar a los 30 minutos · bloquear pisa `RESERVED`/`OCCUPIED` · el solapado pisa un `BLOCKED` · el cron borra a los 89 días · el cron sin comprobar que hay secreto | 1 cada una |

La última **sobrevivió en la primera pasada**. El test ponía `CRON_SECRET=""` y mandaba `Bearer ` con espacio final, pero las cabeceras HTTP se recortan y ese espacio no llega nunca: el test pasaba por otro motivo. El caso peligroso de verdad es la variable **sin definir**, donde la cadena esperada sería literalmente `Bearer undefined`. Se reescribió así, y ahora muere.

### P3.6 Verificación de cierre

| Comprobación | Resultado |
|---|---|
| `npm run test:integration`, **dos veces seguidas** | 100 y 100, en verde |
| **Puerta RCA-225**: integración con `.env.production` cargado | **aborta** con `el entorno cargado es "production"`, código de salida 1, antes de migrar ni conectar |
| `npm test` (unit + ui) | 216, en verde |
| `npm run typecheck` · `eslint` sobre lo nuevo | limpios |
| Caracteres ocultos en los ficheros de P3 | 0 |

La puerta se probó **sin poder hacer daño aunque fallara**: `DATABASE_URL` y `DIRECT_URL` se fijaron antes en la shell a un puerto local inexistente, y `dotenv-cli` no pisa lo ya definido. De producción solo entró `DB_ENV`, que era lo que se probaba.

---

## Paso P4 — Extracción de capa de dominio · EJECUTADO

La Fase 2 de este documento: las reglas de negocio salen de las server actions a módulos `domain/*.ts` planos, y las actions quedan como adaptadores. En Linear, «07 · Fase 4». 13 commits, de `bfc423c` a `15b9b3a`. **Es el primer paso que cambia `src/`, y no cambia ningún comportamiento**: todos los tests de P2 y P3 pasan igual antes y después de cada commit.

### P4.1 Los módulos

| Módulo | Qué sustituye | Tests unitarios |
|---|---|---|
| `events/domain/overlap.ts` | Las dos copias del solape (`payments/actions` y `seating/actions`) | 17 |
| `reservations/domain/expiry.ts` | Los plazos escritos a mano; muere `thirtyMinutesAgo`, que calculaba 5 minutos | 7 |
| `seating/domain/availability.ts` | "Libre aquí pero vendido en un solapado = ocupado, salvo `BLOCKED`" | 10 |
| `reservations/domain/report-months.ts` | El agrupado por mes y el rango del informe, en hora local | 10 |
| `events/domain/title.ts` | El bloque copiado en `createEvent` y `updateEvent` | 11 |
| 💰 `payments/domain/amount.ts` | La fórmula del importe en `initializePayment`, el webhook y el store del cliente | 17 |
| 💰 `payments/domain/outcome.ts` + `lib/apply-payment-outcome.ts` | La transacción del resultado del pago, que estaba en cuatro sitios | 4 |
| — | Primer test del store del cliente (`use-reservation-store`) | 5 |

**81 tests unitarios nuevos**: `npm test` suma **297**. Y 27 de integración escritos **antes** de mover nada (`bfc423c`), porque el alta de eventos y los informes no tenían ninguno: la integración suma **127**.

Borrados: `createReservation` —una server action viva que creaba reservas `CONFIRMED` sin pasar por la pasarela—, `seat.tsx`, `seat-map.tsx`, `header.tsx`, `footer.tsx`, los tipos que solo usaban ellos, y `getSeatsByZone`, que el plan no listaba: una server action sin llamadas y sin `requireAuth`.

### P4.2 Cómo se hizo

- **Un commit de formato primero** (`fa9ee45`), con los cinco ficheros que iba a tocar la extracción, para que cada diff de P4 se pudiera revisar línea a línea. Que era solo formato se comprobó con el compilador de TypeScript: el árbol sintáctico es el mismo antes y después.
- **Las expresiones se movieron sin reescribir.** En las de dinero, el mensaje del commit cita cada expresión que sale y entra. La única diferencia de fondo en todo P4: `applyOverlapOccupancy` devuelve un mapa nuevo en vez de mutar el de entrada.
- **El dominio no conoce Prisma.** Donde hace falta la base de datos, entra como función: `resolveEventNaming` recibe `findTeam`, y así los dos `await` siguen en secuencia, como exige el plan.
- **El total del carrito sale de la misma función que el importe cobrado.** Un test compara cliente y servidor en 1.155 combinaciones.

### P4.3 Qué se desvió del plan

1. **El código muerto se borró antes que el dinero**, no al final: no toca importes, y así todo lo seguro salió en un único push antes del pago de "antes".
2. **`outcome.ts` no tiene el "CONFIRMED + KO = no hacer nada" que pedía la 3.1.** Contradecía la trampa 2: el webhook no tiene esa guarda, y meterla en el dominio le habría cambiado el comportamiento. El dominio decide **qué** se escribe; **si** se escribe lo decide cada caller.
3. **`overlappingEventIds` no excluye el propio evento.** Lo hace la consulta, igual que el filtro de estado, y un test documenta que un evento se solapa consigo mismo.
4. **Dos tests unitarios estaban mal planteados**, y los corrigió la ejecución, no el código. Uno suponía que una ventana de duración cero no se solapa con nada, y sí se solapa si cae dentro. El otro ponía `23.45 * 100` como ejemplo de descuadre en coma flotante, y da exactamente 2345; el ejemplo bueno es `19.99`.

### P4.4 Cómo se comprobó que los tests sirven

**Módulos sin dinero: 10 mutaciones, las 10 mueren en las dos capas**, en los unitarios y en la integración. Lo segundo importa: demuestra que los callers usan de verdad el dominio y no una copia olvidada.

**Módulos de dinero: 8 mutaciones, 6 mueren.** Las dos que sobreviven lo hacen por un motivo concreto:

| Mutación | Resultado |
|---|---|
| Importe sin gastos de gestión | 6 unitarios y 17 de integración |
| Importe a Redsys con decimales | 3 y 6 |
| OK deja los asientos `RESERVED` · KO no suelta el vínculo · OK sin `confirmedAt` | 1 y 1-2 cada una |
| Cancelar sin la guarda de `CONFIRMED` | 1 de integración |
| Céntimos esperados con `floor` en lugar de `round` | 1 unitario; **sobrevive en integración** |
| Unificar los dos `where` de confirmar y cancelar | **sobrevive** |

- **El `floor`** solo lo distingue un importe como 19,99 €. Con gastos en pasos de 50 céntimos, todo total real es múltiplo de 0,50 €, exacto en binario, y ahí `floor` y `round` coinciden. El redondeo sigue siendo lo correcto, pero hoy no lo exige ningún dato posible.
- **Unificar los `where`** confirma con una mutación lo que P3.3 había razonado: en secuencia tocan las mismas filas. Se mantienen separados porque un refactor no cambia comportamiento, ni siquiera el que solo aparece con concurrencia.

### P4.5 La puerta: pago real antes y después

Las tres extracciones de dinero se commitearon en local y **no se empujaron hasta tener el pago de "antes"**. Dos pagos reales en el TPV de pruebas desde la preview de `academic`, 2 asientos del mismo partido cada uno:

| | Antes (`4747e0c`) | Después (`15b9b3a`) |
|---|---|---|
| Estado | `CONFIRMED` / `COMPLETED` | `CONFIRMED` / `COMPLETED` |
| `totalPrice` · `seatPriceCents` · `managementFeeCents` | 23 € · 1000 · 150 | 23 € · 1000 · 150 |
| Asientos | 2 `OCCUPIED` | 2 `OCCUPIED` |
| Recibo | autorización de 6 cifras, respuesta `0000` | autorización de 6 cifras, respuesta `0000` |
| `verify-management-fee.ts report` | 64 reservas, 0 descuadradas | 65 reservas, 0 descuadradas |

El recibo con código de autorización demuestra que en los dos casos **la notificación firmada de Redsys llegó al webhook de la preview**, así que el "después" ejercitó el camino que cambió, `applyPaymentOutcome`, y no solo el respaldo de la página. Las lecturas en testing fueron de solo lectura, con un script que aborta si `DB_ENV` no es `testing`.

### P4.6 Verificación de cierre

| Comprobación | Resultado |
|---|---|
| `npm test` (unit + ui) | 297, en verde |
| `npm run test:integration`, dos veces seguidas | 127 y 127, en verde |
| `npm run typecheck` | limpio |
| `npm run lint` | los 3 errores y 5 avisos heredados; el sexto que apareció a mitad de P4 era mío y está corregido (`4747e0c`) |
| `npm run build` | limpio, las mismas 24 rutas |
| Puerta RCA-237 | pasada |

**Queda sin verificar a mano**: que el cron sigue expirando a los 5 minutos en el despliegue real (punto 3 de "Lo que hay que verificar a mano"). Los tests lo fijan en las dos capas, pero la verificación en vivo exige esperar al cron nocturno o dejar caducar una reserva a propósito.

Linear se quedó sin cupo de issues del plan gratuito a mitad de P4, así que el bug del título `"Velada vs "`, que el plan mandaba abrir aparte, se anotó primero en la tarjeta de su paso (RCA-230). Al liberar cupo se abrió su propia tarjeta: RCA-279.

---

## Paso P5 — E2E con Playwright · EJECUTADO

La 3.4 de este documento. En Linear, «08 · Fase 5». Seis commits, de `92f9cb6` a `075b2d5`. **El job de CI no entra aquí**: en Linear vive en «09 · Fase 6», y va con él.

### P5.1 Qué quedó cubierto

**20 tests**: los 4 del setup y 16 de escenario, en 8 specs. `npm run e2e` los pasa en unos 15 segundos con el servidor ya construido, y la build añade un par de minutos.

| Escenario | Spec | Proyecto |
|---|---|---|
| 1. Compra completa, con comprobación en BD, y ocupación en el evento solapado | `public/purchase.spec.ts` | `public` (Pixel 7) |
| 2. Pago rechazado: `CANCELLED` y asientos libres | `public/payment-rejected.spec.ts` | `public` |
| 3. Webhook firmado, OK y firma corrupta, sin navegador | `public/webhook.spec.ts` | `public` |
| 4. Login, rate limit por IP y roles | `admin/auth.spec.ts` | `admin` (escritorio) |
| 5. Alta de fútbol y de Fórmula 1, y cambio de gastos de gestión visto en el plano público | `admin/events.spec.ts` | `admin` |
| 6. Bloquear y desbloquear tres asientos | `admin/seat-blocking.spec.ts` | `admin` |
| 7. Ticket, recibo e informe mensual en PDF (`@slow`) | `public/ticket-pdf.spec.ts`, `admin/report-pdf.spec.ts` | los dos |

Soporte en `tests/e2e/support/`: `db.ts` (siembra), `auth.ts` (login por rol), `redsys.ts` (los dos caminos de la pasarela), `flows.ts` (pasos del flujo público) y `pdf.ts`. Y `makeAdmin` en las factories, la que P3 aplazó.

### P5.2 Los `data-testid`

Tres commits, como pedía el plan, para que ninguno mezcle cosas:

1. **`92f9cb6`, solo formato**, de los 9 componentes que iban a llevar atributos. Esta vez el comparador de AST de P4 no bastaba: Prettier pone y quita paréntesis alrededor del JSX y reparte el texto en varias líneas. El nuevo aplica la regla de React para el texto JSX (se recortan las líneas y se unen con un espacio), que es lo que ve el navegador. **Antes de fiarse de él, se le metieron cuatro cambios a propósito**, uno de ellos un solo espacio en un texto visible, y los detectó todos.
2. **`5684239`, los atributos del plan.** Mismo AST que antes ignorando solo los `data-*`; sin ignorarlos, los 10 ficheros difieren, así que la comparación sí los ve.
3. **`55d46db`, los del formulario de evento**, que el plan no preveía (ver P5.3).

`data-seat-state` vale `AVAILABLE`, `RESERVED`, `OCCUPIED`, `BLOCKED` o `SELECTED`, en el plano público y en el de bloqueo.

### P5.3 Qué se desvió del plan

1. **Dos errores de lint silenciados.** Dos de los tres errores heredados (1.4) están en `event-row.tsx` y en la página del evento, y el hook de pre-commit no deja commitear un fichero con errores: P5 no podía tocarlos. **Decisión de Ramón: silenciarlos con `eslint-disable-next-line` y su motivo, y arreglarlos antes del lint bloqueante de CI** (RCA-273). La 1.4 decía que el de `event-row` lo arreglaría P4, y no fue así, porque P4 no tocó ese componente.
2. **Más `data-testid` en el formulario de evento.** Ningún `<label>` está asociado a su campo, así que los selects y las fechas no tienen nombre accesible y solo se encontrarían por posición. Es el caso que el criterio del plan reserva para un `data-testid`. Asociar los labels sería lo correcto para accesibilidad, pero cambia el DOM de producción y no es de esta fase.
3. **Una puerta más: el canario.** `requireDbEnv("test")` protege el proceso de Playwright, pero quien escribe al pagar es el servidor Next, y ese puede estar leyendo otra base: Next carga `.env.production` al arrancar, y en local `reuseExistingServer` aprovecha cualquier servidor que ya esté en el 3100. El setup siembra un evento con un id único y aborta si la portada no lo muestra. **Se probó a propósito** con un servidor contra `lounge_dev`: el canario falla y no corre ningún escenario.
4. **Cada spec resiembra**, en vez de sembrar una vez en el setup. Los escenarios compran, bloquean y crean eventos, y así ninguno depende del orden. Los ids son fijos: la cookie de iron-session guarda el `adminId`, y el `storageState` del setup tiene que seguir valiendo tras resembrar.
5. **`"a"` no da error: deshabilita PAGAR.** El plan esperaba un mensaje; la app no deja ni pulsar. El error se prueba con un carácter fuera de la lista blanca (`"Ana <3"`).
6. **Los PDF que se abren en otra pestaña no se esperan como pestaña.** En Chromium headless no hay visor de PDF: abrir uno lo descarga, y la pestaña no termina de cargar nunca. `support/pdf.ts` sustituye `window.open` por uno que apunta la URL, y el blob se lee desde la página que lo creó.
7. **El editor del plano (`/admin/asientos`) no tiene escenario.** Guardar exige arrastrar asientos, y el plan lo mencionaba solo por el `window.alert`. `save-positions` queda puesto para cuando se escriba.
8. **`retries: 0`, también en CI.** Un test que pasa a la segunda es un test inestable, y un reintento automático lo esconde.

### P5.4 Cómo se comprobó que los tests sirven

Las mismas dos preguntas de siempre, en una capa donde cada mutación exige reconstruir la app.

**El propio test, primero.** La primera versión del rate limit pasaba en falso: la aserción del bucle veía el mensaje de error del intento **anterior**, y algún clic se perdía mientras el anterior seguía pendiente. Ahora cada intento espera la respuesta de la server action.

**Después, la app.** 10 mutaciones en 4 builds, agrupadas para que ninguna tape a otra. **Mueren las 10**, y cada una en el test que le toca:

| Mutación | Test que cae |
|---|---|
| La portada abre la ventana a 80 h en vez de a 48 | la portada bloquea los eventos fuera de ventana |
| El OK deja los asientos `RESERVED` | el webhook OK (y la compra) |
| El KO no libera los asientos | pago rechazado |
| Guardar bloqueos no bloquea | bloquear y desbloquear |
| El panel enseña «Configurar eventos» a un WORKER | WORKER solo ve reservas |
| Un asiento vendido en el evento solapado sale libre | la compra, en su último paso |
| El rate limit deja 6 intentos en vez de 5 | 5 fallos bloquean la IP |
| El carrito ignora los gastos de gestión | cambiar los gastos cambia el precio (y la compra) |
| `createEvent` crea 46 `SeatStatus` en vez de 47 | las dos altas |
| Se firma un céntimo de más para el banco | la compra |

Esta capa cubre lo que las otras dos no ven: la **ocupación en el evento solapado** solo la había probado la integración con la función de dominio, y aquí cae con el plano que ve el cliente; y el **importe firmado para Redsys** sale del cuerpo del POST que el navegador manda a la pasarela.

### P5.5 Verificación de cierre

| Comprobación | Resultado |
|---|---|
| `npm run e2e`, dos veces seguidas, con build limpia | 20 y 20, en verde |
| `npm test` (unit + ui) | 297, en verde |
| `npm run test:integration`, dos veces seguidas | 127 y 127, en verde |
| `npm run typecheck` | limpio |
| `npm run lint` | 1 error y 5 avisos: los heredados, con dos errores silenciados (P5.3) |
| `npm run build` | limpio, las mismas 24 rutas |
| Unicode oculto en los 28 ficheros tocados | ninguno |

**Verificado a mano el 23 de septiembre** (punto 5 de "Lo que hay que verificar a mano"): Ramón abrió `/admin/asientos` en la preview de `academic` con los `data-testid` ya desplegados, y los 47 asientos siguen en sus posiciones habituales.

---

## Paso P6 — CI y cobertura · EJECUTADO

La 3.5 de este documento. En Linear, «09 · Fase 6». De `cb13a09` a `030d333`.

### P6.1 Qué quedó

- **`.github/workflows/ci.yml`**, con dos jobs en cada push y cada PR:
  - `static`: sin base de datos; lint, tipos, formato, unitarios y componentes. **1 min 22 s**.
  - `db`: Postgres 17 como servicio del runner; migraciones, la suite entera con cobertura y umbrales, y el E2E con Chromium. Sube los informes de cobertura y de Playwright como artefactos, también cuando falla. **2 min 52 s**.
- **Verde a la primera ejecución**, con las mismas cifras que en local: 319 tests en `static`, 450 más los 20 E2E en `db`.
- **Umbrales de cobertura solo sobre dominio, `lib/` y `config/`**: 95 % de líneas, sentencias y funciones en dominio y config, 90 % en `lib/`, y 90 % de ramas en las tres. Se comprobó en los dos sentidos: con la suite completa pasan, y quitando solo los tests nuevos del cliente de ESPN, `lib/` cae al 81 % y el comando falla nombrando la capa y el umbral.
- **Lint a cero, sin exclusiones.** Los tres errores heredados de la 1.4 están arreglados, y los dos `eslint-disable` de P5 ya no existen (RCA-273).
- **Cero secretos reales en CI.** La base es un contenedor efímero; Redsys usa el sandbox público, que ya cargaba `tests/setup/env.ts`; `AUTH_SECRET` se genera en cada ejecución. El workflow no conoce ninguna URL de producción ni de testing, y solo tiene permiso de lectura sobre el repositorio.

### P6.2 Los tres errores de lint

Los dos `set-state-in-effect` y un tercer componente, `event-row`, repetían el mismo patrón: un `useEffect` que al montar hacía `setIsSpanish(navigator.language…)`. Ahora los tres usan un hook compartido, `useIsSpanish`, con `useSyncExternalStore`, que es la forma que da React de leer un valor que solo existe en el navegador. **Se comporta igual**: en el servidor y al hidratar vale "español", que era el valor inicial, y justo después lee el idioma. El `purity` de `event-row` (`Date.now()` en el render) pasa a leerse una vez al montar. La única diferencia observable es que un re-render ya no vuelve a leer el reloj.

El banner de la portada no tenía ningún test; ahora tiene 4. Una mutación que deja el hook siempre en español la detectan ese test y el de `event-row`.

### P6.3 Qué se desvió del plan

1. **Un commit de formato de todo el repositorio** (`cb13a09`, 51 ficheros). El `format:check` de CI no podía pasar con la adopción gradual que eligió la Fase 1. **Decisión de Ramón.** Se comprobó con el comparador de AST de P5. Solo apareció una diferencia aparente: Prettier quita las comillas que sobran en las claves de objeto (`"Bundesliga":` pasa a `Bundesliga:`), que en JavaScript es la misma propiedad. El comparador aprendió esa equivalencia, y se probó que sigue detectando una clave renombrada. El commit está en `.git-blame-ignore-revs`.
2. **`endOfLine: "auto"` en Prettier.** En Windows, con `core.autocrlf`, `format:check` marcaba todos los ficheros por el salto de línea, y en el runner de Linux no. Ahora dice lo mismo en las dos máquinas.
3. **La cobertura se mide en el job `db`, no en `static`.** Parte de `lib/` solo la ejercita la integración (`receipt.ts` y `apply-payment-outcome.ts` escriben en la base), y sin base no llegaría al umbral.
4. **22 tests nuevos para llegar al umbral de `lib/`, en vez de excluir ficheros.** Los huecos estaban justo donde el código habla con la red, con la base y con la cookie: el cliente HTTP de ESPN (reintentos, timeouts, las dos formas de decir "no existe"), `requireAuth` y `requireAdmin`, las banderas de la cookie de sesión, y el sync de equipos contra la base. De estos últimos, el más valioso es que **una segunda ejecución sin cambios no escribe nada**, porque lo contrario serían cientos de `UPDATE` cada noche en el cron. `lib/` pasó del 72 % al 97 % de líneas.
5. **Las acciones oficiales, en versiones actuales.** La primera ejecución avisó de que `checkout`, `setup-node`, `cache` y `upload-artifact` en v4 corren sobre Node 20, ya obsoleto. Se subieron a la última versión mayor de cada una, comprobada en su página de releases.
6. **Protección de rama: no aplica a `academic`.** El plan pedía `static` bloqueante siempre y `db` bloqueante en PR. Pero a `academic` se empuja directamente, sin PRs, y la protección de `main` y `testing` no se toca. Queda anotado para cuando haya un flujo de PR.
7. **Insignia de cobertura, pendiente del README (Fase 7).** Sin un servicio externo, como Codecov, que exigiría subir la cobertura de un repositorio privado a un tercero, la única insignia posible sería una cifra escrita a mano que envejecería mal. La insignia de CI sí está puesta.

### P6.4 Verificación de cierre

| Comprobación | Resultado |
|---|---|
| CI #1 (`346d8f9`), primera ejecución | verde: `static` 1 min 22 s, `db` 2 min 52 s |
| CI #2 (`030d333`), con las acciones actualizadas | verde, 2 min 33 s, sin avisos de Node 20 |
| `npm run lint` | 0 errores y 0 avisos |
| `npm run typecheck` | limpio |
| `npm run format:check` | todo el repositorio |
| `npm test` (unit + ui) | 319, en verde |
| `npm run test:coverage` (unit + ui + integración) | 450, en verde y con los umbrales cumplidos |
| `npm run e2e` | 20, en verde |
| `npm run build` | limpio, las mismas 24 rutas |
| Unicode oculto en los 67 ficheros tocados | ninguno |

Queda **una nota informativa** en cada ejecución: `ubuntu-latest` pasará a Ubuntu 26 a partir del 19 de octubre de 2026. No pide ningún cambio ahora; si ese día algo falla, se fija la versión del runner.

---

## Fase 2 — Extracción de capa de dominio

> **Ejecutada en P4**, con los desvíos de P4.3. La trampa 1 está corregida desde P3.

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

1. **Los `where` de confirmar y cancelar son distintos y NO se unifican en P4.** Confirmar usa `where: { reservationId }`; cancelar usa `where: { seatId: { in }, eventId }`. ~~Unificarlos cambia el comportamiento: dejaría de tocar un `SeatStatus` cuyo `reservationId` ya fuera nulo.~~ **Corregido en P3 (ver P3.3):** ese motivo era falso, porque los `seatId` de cancelar salen de la propia relación por `reservationId`. En secuencia tocan las mismas filas y solo difieren con concurrencia. Se mantienen igual porque un refactor no cambia comportamiento, ni siquiera el que solo se ve en una carrera.
2. **Las guardas de estado se quedan en cada caller.** Son tres y son diferentes: `confirmReservationByOrderId` solo actúa sobre `PENDING`; `cancelReservationByOrderId` sale si ya está `CONFIRMED` (el pago manda); el webhook actúa **sin filtro de estado**.
3. **`recordPaymentReceipt` se queda fuera de la transacción**, como hoy: si falla el recibo, la reserva tiene que confirmarse igual.

En `overlap.ts`, el filtro `status: { in: ["UPCOMING","LIVE"] }` se queda en la query de Prisma: duplicarlo en los dos callers sería peor que dejarlo donde está.

### Exportaciones y borrados

~~Sin mover código (riesgo ~0): exportar `espnMonths`, `planTeam` y `planCreate`, partir `loadTeamIndex()` en un `buildTeamIndex(rows)` puro más la query, y mover `safeManagementFeeCents` a `events/config/pricing.ts`.~~ **Hecho en P2** (ver P2.2): hacía falta para poder testearlas.

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

> **Hechos en P2:** el 2, el 4, el 6 y del 7 `toSuggestion`, `espnMonths`, `rate-limit` y `base-url`. **Hechos en P4:** el 1, el 3, el 5 (sin el "CONFIRMED + ko", ver P4.3) y el resto del 7.

Por riesgo, empezando por el dinero:

1. **Importes** — tabla sobre `computeReservationAmount`: precios 0–30 €, los 11 valores de `MANAGEMENT_FEE_OPTIONS_CENTS`, 1–47 asientos. Casos nombrados: base (10 €/150/1), fee cero, fee máximo, precio no redondo, aforo completo. Y los invariantes recorriendo toda la matriz: `Number.isInteger(totalCents)`, la regla del `CHECK` de la BD, y **`expectedCentsFromTotalPrice(totalPriceEuros) === totalCents`**, que demuestra que la traza de descuadre del webhook no puede dar un falso positivo. Es el test más valioso de la suite.
2. **Nombre del cliente** — 1 y 2 caracteres, 24 y 25; tildes y `Müller` pasan (Latin-1); emoji, `@`, `_`, griego y chino fallan con `"chars"`; NFD → NFC; invisibles y marcas bidireccionales se eliminan; comillas tipográficas y guiones largos se sustituyen. Casos puente normalizar→validar (30 caracteres con invisibles que quedan en 24 → válido): es lo que justifica validar **después** de normalizar. `displayCustomerName("Cliente") === "Sin nombre"`.
3. **Solape de eventos** — objetivo 20:00 + 120 min: parcial por cada lado, idéntico, contenido, contiene, y las dos fronteras **back-to-back exactas → no solapan** (`<` estricto), que es lo que decide si un asiento se vende dos veces. Más: excluye el propio id, cruza medianoche y cruza el cambio de hora.
4. **Gastos de gestión** — `isValidManagementFeeCents` con los 11 válidos y con `149`, `501`, `-50`, `1.5`, `"150"`, `null`, `NaN`. Y `safeManagementFeeCents`: `undefined → 150`, **`0 → 0`** (la trampa del falsy: si alguien lo reescribe como `value || DEFAULT`, un evento sin gastos empieza a cobrar 1,50 € por asiento).
5. **Resultado del pago** — `PENDING + ok → CONFIRMED/OCCUPIED`; `PENDING + ko → CANCELLED/AVAILABLE`; `CONFIRMED + ko → no-op`.
6. **Matching de equipos** — `planTeam`: match por `externalId` sin cambios → **cero updates** (la regresión cara: sin esto vuelven cientos de UPDATE por ejecución del cron); match por nombre normalizado, por alias, por slug; **fila con `logo: "/escudos/…"` y API con URL de ESPN → el logo no cambia** (el bug que reescribía 430 escudos). `planCreate`: slug libre, slug ocupado, colisión.
7. **Resto** — `toSuggestion` (partido empezado, competidor ausente, id no parseable, fecha inválida, `dbTeamId` presente y ausente), `espnMonths` (cruza mes y año), `resolveEventNaming` (tres ramas + el bug documentado), `report-months` (febrero bisiesto, diciembre), `availability` (BLOCKED nunca se pisa), `rate-limit` (5 intentos, ventana, aislamiento por IP — con `vi.resetModules()` porque el `Map` es estado de módulo) y `base-url` (la cadena de fallback, con import dinámico porque es constante de módulo).

### 3.2 Componentes (`src/**/*.test.tsx`, jsdom)

> **Hecho en P2**, con los selectores por `title` que había entonces. Los `data-testid` llegaron en P5; pasar estos tests a usarlos es opcional, porque los `title` no han cambiado.

Dos ficheros, solo donde la UI *decide* algo:

- `event-row.test.tsx` — con `vi.setSystemTime`: +24 h navegable, +72 h bloqueado con tooltip, +2 h bloqueado, `checkAvailability: false` siempre navegable, y **evento pasado (−1 h) NO bloqueado** porque la condición exige `hoursUntilEvent >= 0`. Necesita mockear `next/link` y `next/image`.
- `floor-plan-map.test.tsx` — disponible clicable, ocupado y bloqueado `disabled`, y **un asiento seleccionado que pasó a no disponible sigue siendo clicable**. Es lo que blinda los selectores que usa Playwright.

### 3.3 Integración (`tests/integration/`, Postgres real)

> **Hecho en P3**, con los desvíos de P3.2. El escenario 8 se escribió al revés de lo que dice aquí (ver P3.3).

Base `lounge_test` del Docker local; en CI, `services: postgres` de GitHub Actions.

**El esquema se crea con `prisma migrate deploy`, no con `db push`.** El `CHECK` de importes vive como SQL crudo en `prisma/migrations/20260825120000_add_management_fee/migration.sql:34` y **no está en `schema.prisma`**: con `db push` la restricción no existiría y los tests que la verifican pasarían en falso. Como efecto colateral gratis, `deploy` comprueba que las 5 migraciones aplican limpiamente sobre una BD virgen.

**Guard**: el setup exige `DB_ENV=test` y aborta si no. Aislamiento: `TRUNCATE … RESTART IDENTITY CASCADE` en `beforeEach`, y factories en `tests/fixtures/factories.ts` con un `TEST_NOW` fijo del que cuelgan todas las fechas. Descartada una transacción por test con rollback: el código bajo prueba abre sus propias `$transaction` y Prisma no soporta anidarlas.

~~Refactor previo trivial: extraer el array de asientos de `prisma/seed.ts` a `prisma/seats.ts`.~~ **Hecho en P2** (ver P2.2).

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
2. **Notificación firmada de verdad contra `/api/payments/notify`** (camino servidor-servidor). ~~Se extrae `signNotification()` de `scripts/simulate-redsys-notify.ts` a un módulo importable; el script sigue funcionando igual.~~ **Hecho en P3**: `signRedsysNotification()` en `scripts/lib/redsys-notification.ts`.

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

## Revisión de UI/UX — estados de carga

> **Añadida el 24 de septiembre, a petición de Ramón.** Es el paso P8, en Linear «13 · UI/UX» (RCA-280 a RCA-284).

**El problema.** Al pulsar un evento en la portada, la pantalla no cambia durante los 2–3 s que tarda `/eventos/[id]`, y parece que el clic no ha hecho nada. La causa es doble. No hay ni un `loading.tsx` en las 18 páginas de `src/app/`. Y la página del evento hace tres viajes a la base de datos en serie antes de pintar nada: el evento, luego inicializar los asientos, luego los asientos y los carteles. Sin un límite de Suspense, el `<Link>` no da ninguna señal hasta que llega todo. El panel tiene el mismo problema, y los estados de «cargando» que ya existen, en 12 ficheros, son desiguales.

**El enfoque**, el estándar de Next 16 y React 19, sin dependencias nuevas:

- **`loading.tsx` por segmento, con un skeleton que imita la vista de destino.** En producción, `<Link>` precarga el límite de carga de las rutas dinámicas, así que el skeleton aparece en cuanto se pulsa y no hace falta esperar al servidor. Hay un primitivo compartido, `components/ui/skeleton.tsx`, al estilo shadcn. Accesibilidad: `role="status"`, `aria-busy` y un texto oculto «Cargando…».
- **Feedback en el elemento pulsado**, para cuando la precarga aún no ha llegado. Se usa `useLinkStatus` en las filas de evento y las tarjetas del panel, más `active:scale-[0.98]` como respuesta táctil.
- **Botones de acción con una prop `loading`** en `Button`: spinner, `disabled` y `aria-busy`. El mecanismo de navegación posterior no se cambia (punto 4 de `CLAUDE.md`).
- **Animaciones básicas** con `tw-animate-css`, que ya está instalado, siempre bajo `motion-safe:`.

**Lo que se descarta y por qué.**

- `<ViewTransition>` de React sigue siendo experimental en Next 16, y esto acaba en producción.
- Acelerar los tres viajes en serie de `/eventos/[id]` es otro cambio, porque toca el camino de los asientos. Lo que se pide aquí es que la espera se perciba de otra forma, no quitar latencia.

**Cómo se comprueba.**

- Tests de componente de `Button` con `loading`.
- Un E2E que retrasa con `page.route` la petición RSC de `/eventos/[id]` y exige ver el skeleton antes que el plano, y otro igual en el panel.
- Los 20 E2E existentes, en verde.
- A mano, Ramón en el móvil:
  - el skeleton sale al instante al pulsar un evento;
  - el panel se recorre como ADMIN y como WORKER;
  - con «reducir movimiento» activado, no hay animaciones.

---

## Orden de ejecución

Las fases 1 a 3 se trocean así, y **el orden importa más que el contenido**: la caracterización va antes que el refactor, o no hay forma de demostrar que el refactor no cambió nada.

| Paso | Qué | Riesgo | En Linear |
|---|---|---|---|
| ~~**P0**~~ | ~~Fase −1 y Fase 0: docstrings, Node, renombrado de entornos, backup, rama, Vercel, GitHub.~~ **Hecho.** | — | 01 a 03 |
| ~~**P1**~~ | ~~Andamiaje: devDeps, config de Vitest, `tests/setup/*`, scripts, ESLint, y un test que valide la tubería en Windows. **Cero cambios en `src/`.**~~ **Hecho.** Ver Fase 1 | — | 04 · Fase 1 |
| ~~**P2**~~ | ~~Tests de caracterización sobre lo que ya es puro. Después, las exportaciones triviales.~~ **Hecho.** Ver P2 | — | 05 · Fase 2 |
| ~~**P3**~~ | ~~Integración con BD real, **todavía sin refactor**: aquí se captura el comportamiento que P4 no puede cambiar.~~ **Hecho.** Ver P3 | — | 06 · Fase 3 |
| ~~**P4**~~ | ~~Extracción de dominio, **un módulo por commit, de menor a mayor riesgo**: `overlap` → `expiry` → `availability` → `report-months` → `title` → borrar `createReservation` → **`amount` (dinero)** → **`apply-payment-outcome` (dinero)** → borrar el resto del código muerto.~~ **Hecho.** Ver P4 | — | 07 · Fase 4 |
| ~~**P5**~~ | ~~E2E: los `data-testid` en un commit aislado, luego config y escenarios.~~ **Hecho.** Ver P5. El job de CI pasa a P6, que es donde lo tiene Linear | — | 08 · Fase 5 |
| ~~**P6**~~ | ~~Los 3 errores de lint (quitando los dos `eslint-disable` de P5), el workflow de CI con sus dos jobs, umbrales de cobertura y cierre.~~ **Hecho.** Ver P6 | — | 09 · Fase 6 |
| **P7** | Fallos de dinero: carrera de asientos (test que falla primero, luego el `where` con `AVAILABLE` y el `count`), pago tras expirar (RCA-276) y validación en servidor de `initializePayment` (RCA-277). **Una sola puerta de pago real para los tres.** Después, la decisión del hotfix a `main` (RCA-269, de Ramón) y los menores RCA-279 y RCA-274 | **Dinero** | 12 · Carrera, RCA-276, RCA-277 |
| **P8** | Estados de carga, skeletons y animaciones. Ver [Revisión de UI/UX](#revisión-de-uiux--estados-de-carga) | — | 13 · UI/UX |
| **P9** | Documentación. El CHANGELOG, el último | — | 10 · Fase 7 |
| **P10** | Presentación. Las capturas, después de P8 | — | 11 · Fase 8 |

**Cambio de orden del 24 de septiembre, decidido por Ramón.** El plan original ponía la documentación y la presentación en paralelo desde P3. Se retrasan hasta que el producto deje de cambiar: no tiene sentido documentar ni capturar pantallas de una app a la que aún le faltan tres arreglos de dinero y una revisión de UI. Entre los dos bloques que cambian el producto, los fallos de dinero van primero por tres motivos: afectan a cobros reales, la decisión del hotfix necesita el arreglo ya hecho, y los estados de carga se montan así sobre el botón de pago definitivo.

**Antes de publicar el repositorio**, con independencia del orden anterior: RCA-275, la contraseña del seed, que sigue pospuesta hasta que Ramón lo pida, y el punto 6 de la verificación manual.

---

## Verificación

1. `npm run ci:local` — lint, typecheck, unitarios, componentes e integración. Limpio.
2. `npm run test:integration` **dos veces seguidas** — que pase dos veces es lo que demuestra el aislamiento entre tests.
3. **Probar el guard a propósito, una vez**: lanzar la integración con `.env.production` cargado debe **abortar** por `DB_ENV`. Si no aborta, parar todo y arreglarlo antes de seguir.
4. `npm run test:coverage` — la capa de dominio por encima del umbral.
5. `npm run e2e` — en verde; revisar el reporte HTML.
6. CI verde en el primer push a `academic`.
7. `git diff testing...academic -- src/` revisado entero: ni un cambio de comportamiento no intencionado.

### Lo que hay que verificar a mano, sin excusa

1. ~~**Un pago real en el TPV de pruebas, antes y después** de las dos extracciones de dinero. Comparar `totalPrice`, `seatPriceCents` y `managementFeeCents` de las dos reservas, y que `verify-management-fee.ts report` siga dando lo mismo.~~ **Hecho en P4.5.**
2. ~~Que el recibo sigue imprimiendo el código de autorización tras extraer `apply-payment-outcome`.~~ **Hecho en P4.5.**
3. ~~Que `cleanup` sigue expirando a los **5** minutos y no a los 30: el paso que renombra la variable mentirosa es justo donde podría colarse el error.~~ **Hecho el 23 de septiembre**, por el otro camino que usa el mismo plazo: el cron de Vercel solo corre en el despliegue de producción, pero la página del evento caduca las pendientes al abrirse, con la misma `pendingExpiryCutoff`. Ramón abandonó un pago en la pasarela de la preview de `academic`, sin pagar ni cancelar, y el asiento siguió ocupado a los 3-4 minutos y quedó libre a los 5.
4. ~~Que `/` sigue bloqueando los eventos a >48 h y <4 h **en un móvil real**.~~ **Hecho el 23 de septiembre**, en la preview de `academic`.
5. ~~Que el plano de `/admin/asientos` no se ha movido ni un píxel tras el commit de `data-testid`.~~ **Hecho en P5.5.**
6. Que `db:whoami:prod` sigue imprimiendo lo mismo al final de todo que al principio. **Punto de partida tomado el 23 de septiembre, tras P5**, y guardado en la tarjeta de «09 · Fase 6» (RCA-172) y no aquí, porque los conteos de producción son datos del negocio. Las 5 migraciones de producción coinciden con las de `prisma/migrations/`. Al final tienen que coincidir el ref, las migraciones, los 47 asientos y los admins; eventos, reservas y equipos pueden subir, porque el bar sigue funcionando.

---

## Riesgos

| Riesgo | Por qué existe | Mitigación |
|---|---|---|
| Un `migrate` o `TRUNCATE` contra **producción** | Hay cuatro entornos y se eligen a mano | **Ya mitigado en la Fase 0**: `.env` apunta a local, cada fichero declara `DB_ENV`, `requireDbEnv()` aborta en los scripts destructivos y el entorno va siempre en el nombre del script. Mantenerlo así al añadir scripts nuevos |
| El refactor de importes mueve un céntimo | Es dinero, con reservas reales ya cobradas | Caracterización antes de mover; diff literal de la expresión; invariante `totalPrice*100 = (seat+fee)*n`; pago real de prueba antes y después |
| Se "unifican" los `where` de confirmar y cancelar | Parecen iguales y no lo son | El escenario 8 de integración |
| **La carrera de asientos es un bug real de producción** | El chequeo va fuera de la transacción | Arreglarlo en `academic` es correcto, pero decidir **aparte** si se porta a `main` como hotfix: afecta a clientes reales |
| Tests dependientes del huso horario | `monthRange` usa constructores de fecha locales | `TZ` fijado en el config de Vitest, en el workflow y en Playwright |
| El `Map` de `rate-limit` filtra entre tests | Estado de módulo compartido en el proceso | `vi.resetModules()` + import dinámico por test |
| El E2E se cuelga en `/admin/asientos` | `window.alert` nativo bloqueante | `page.on("dialog", …)` **antes** del clic |
| `src/generated/prisma` no existe en CI | Está gitignoreado | `npx prisma generate` en los dos jobs |
| Docker Desktop parado | Los tests de integración y E2E van contra el contenedor local | `npm run db:up` falla con un mensaje claro si el daemon no corre. En CI no aplica: usa `services: postgres` |
| Mover 13 `.md` genera un diff enorme | `git mv` masivo | Commit propio y separado |
