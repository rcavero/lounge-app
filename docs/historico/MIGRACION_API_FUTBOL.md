# Migración del proveedor de datos de fútbol

**Creado:** 22 de Abril de 2026 (plan original, hacia API-Football)
**Revisado:** 14 de Agosto de 2026 — plan corregido y **proveedor cambiado a ESPN**
**Estado:** Implementado en la rama `testing`, pendiente de soak y de paso a producción

---

## 1. Por qué se migra

El free tier de football-data.org cubre 12 competiciones y faltan siete que interesan al negocio:
**Europa League, Conference League, La Liga 2, Copa del Rey, Supercopa de España, Copa América y
Nations League**.

### El coste real de quedarse (dato corregido)

El plan de abril afirmaba que «el tier 2 cuesta €12/mes y añadiría Europa League y Copa del Rey».
**Es falso.** Verificado en football-data.org/pricing y /coverage el 14/08/2026:

| Tier | Precio | Competiciones |
|---|---|---|
| Free | €0 | 12 |
| Free w/ Livescores | €12/mes | **12** (solo añade livescores) |
| Free + Deep Data | €29/mes | **12** |
| **Standard** | **€49/mes** | **30** ← primer tier con competiciones nuevas |

Las siete competiciones que faltan entran todas de golpe en **Standard: €49/mes = €588/año**.
No hay escalón barato intermedio.

---

## 2. Proveedores evaluados

### ❌ API-Football (api-sports.io) — descartado

Era el proveedor propuesto en el plan de abril. Se creó una cuenta gratuita y se ejecutó
`scripts/spike-api-football.mjs` antes de escribir ninguna línea de código. Resultado:

```
GET /fixtures?league=140&season=2026&next=5
{"plan":"Free plans do not have access to this season, try from 2022 to 2024."}
```

**El plan gratuito solo sirve las temporadas 2022-2024.** La temporada actual aparece en
`/leagues` (con `coverage.fixtures.events = false`) pero la API deniega sus partidos. Inservible.

El gate ahorró un día entero de implementación. Merece la pena conservar el script: si algún día
API-Football amplía su free tier, basta con volver a ejecutarlo.

> Detalle técnico anotado durante la prueba: **API-Football devuelve HTTP 200 en los errores**,
> con el fallo dentro de `body.errors`. Un cliente que solo mire `response.ok` fallaría en silencio.

### ❌ TheSportsDB gratuito — descartado

Cubre las competiciones y tiene datos de la temporada actual, pero el tier gratuito
**devuelve un solo partido por competición** (medido, no documentado). Inservible para una página
de sugerencias. Su tier Premium ($9/mes) sí serviría y queda como plan B si ESPN falla.

### ✅ ESPN (site.api.espn.com) — elegido

Cubre **las 17 competiciones**, sin clave, sin registro y sin cuota diaria. Medido el 14/08/2026:
12 peticiones consecutivas en 5 s sin un solo fallo.

**El pero, asumido conscientemente:** es una API **no documentada** — la que alimenta la web de
ESPN. No hay contrato ni SLA y podría cambiar sin aviso. La mitigación es que el módulo queda
aislado tras `MatchSuggestion`, así que saltar a TheSportsDB Premium sería cuestión de un día.
El `scripts/espn-smoke-test.ts` existe justamente para detectar pronto un cambio de forma.

### Copia local de escudos y emblemas (15/08/2026)

Quedaba un punto en el que ESPN **sí** daba la cara al cliente final: los escudos se enlazaban
directamente contra `a.espncdn.com` (y `<Image unoptimized>` desactiva el proxy de Next, así que la
petición salía del navegador del cliente). Un bloqueo de hotlinking rompía todos los escudos de la
web pública, y la base de datos solo guardaba punteros con los que no se podía recuperar nada.

Ahora las imágenes se descargan a `public/escudos/{Team.id}.png` y `public/competiciones/{slug}.png`,
versionadas en git y servidas desde el propio dominio. **ESPN pasa a ser solo la fuente en el momento
del sync**, no una dependencia en tiempo de ejecución.

- `Team.logo` = lo que se renderiza · `Team.logoSource` = URL remota de origen.
- El sync **nunca** sobrescribe un `logo` que empiece por `/escudos/` (`LOCAL_LOGO_PREFIX`). Sin ese
  guardarraíl, el primer cron deshacía la descarga entera.
- Vercel no puede escribir en `public/`: los equipos que crea el cron apuntan a ESPN hasta que se
  ejecuta `scripts/download-crests.ts` en local y se hace commit. Degrada bien — la UI pinta
  indistintamente ruta local o URL remota.
- Descubierto al descargar: el emblema del Brasileirão en `crests.football-data.org` ya devolvía
  **404**. Llevaba roto en producción desde antes. Ambos emblemas retirados se toman ahora de ESPN.
- Coste: **18,5 MB** en el repositorio (389 escudos + 19 emblemas). ESPN solo publica el tamaño de
  500px; no hay variante menor.
- 75 de 464 equipos no tienen escudo en origen — todos de categorías bajas de Copa del Rey. Se
  pintan con el círculo de iniciales.

---

## 3. Competiciones y slugs

Verificados uno a uno con `scripts/espn-discover.mjs`. Los 17 slugs existen y todos devuelven emblema.

| Competición | Slug | Fase previa |
|---|---|---|
| Champions League | `uefa.champions` | `uefa.champions_qual` |
| Europa League | `uefa.europa` | `uefa.europa_qual` |
| Conference League | `uefa.europa.conf` | `uefa.europa.conf_qual` |
| La Liga | `esp.1` | |
| La Liga 2 | `esp.2` | |
| Premier League | `eng.1` | |
| Serie A | `ita.1` | |
| Bundesliga | `ger.1` | |
| Ligue 1 | `fra.1` | |
| Primeira Liga | `por.1` | |
| Eredivisie | `ned.1` | |
| Copa del Rey | `esp.copa_del_rey` | |
| Supercopa de España | `esp.super_cup` | |
| Copa América | `conmebol.america` | |
| Nations League | `uefa.nations` | |
| World Cup | `fifa.world` | |
| European Championship | `uefa.euro` | |

Championship y Brasileirão se retiran del sync (ya no interesan), pero sus emblemas se conservan en
`LEGACY_COMPETITION_EMBLEM` para que los eventos históricos sigan renderizando.

**Aviso sobre el parámetro `dates`:** con rangos muy amplios (más de unos meses) ESPN devuelve 0
eventos aunque los haya. La ventana de 7 días que usa la aplicación está muy por debajo de ese umbral.

---

## 4. Mapeo de datos

```
event.id                    → Event.externalMatchId  (llega como string; parseInt)
event.date                  → utcDate                 "2026-08-15T17:30Z"
event.status.type.state     → filtro: solo "pre"
team.id                     → Team.externalId         (string → int)
team.displayName            → Team.name               "Alavés"
team.shortDisplayName       → Team.shortName          "Alavés"
team.logo                   → Team.logo               escudo
leagues[0].logos[0].href    → emblema de competición
```

ESPN **no expone número de jornada**, así que `MatchSuggestion.matchday` es siempre `null`. El campo
se conserva porque forma parte del contrato con la UI, aunque hoy no se renderiza en ningún sitio.

---

## 5. Diseño de la implementación

### 5.1 La costura se mantiene intacta

`MatchSuggestion` y `SyncResult` conservan exactamente su forma, así que la página de sugerencias
no ha necesitado cambios estructurales — solo se han corregido dos mensajes que hablaban de una
API key que ya no existe y del rate limiting que ya no aplica.

### 5.2 Sin rate limiting, con paralelismo

El cliente anterior dormía 6,1 s antes de cada petición para respetar el límite de 10/min de
football-data: 12 competiciones = ~67 s, y con 17 habrían sido ~104 s. Como **no había
`maxDuration` en ningún sitio del repo** y el default de Vercel es 60 s, es muy probable que el
cron diario llevara meses fallando por timeout (confirmar en los logs).

ESPN no impone cuota ni límite por minuto, así que:
- No hay espera previa entre peticiones; solo reintentos con backoff ante 429 y 5xx.
- `getMatchSuggestions` pide **todas las competiciones en paralelo** con `Promise.allSettled`.

Medido con `scripts/espn-smoke-test.ts`: **las 17 competiciones (más fases previas) en ~680 ms.**

### 5.3 Frontera de autenticación: el detalle que rompía el cron

Las tres server actions no comprobaban sesión (todas las de `events/actions` sí lo hacen). Al ser
endpoints POST públicos, cualquiera podía dispararlas. Se les ha añadido `requireAuth()`.

**Pero el cron no tiene sesión de usuario** — se autentica con `CRON_SECRET`. Meter `requireAuth()`
en `syncTeamsFromAPI` habría roto el cron diario. Por eso el núcleo del sync vive en
`lib/team-sync.ts`, sin comprobación de sesión:

- `actions/index.ts → syncTeamsFromAPI()` = `requireAuth()` + `syncTeams()` → lo usa la UI
- `api/cron/sync-teams/route.ts` → llama a `syncTeams()` directamente (auth por `CRON_SECRET`)

### 5.4 Identidad de equipos y colisión de `externalId`

`Team.externalId` tiene índice único. Al repoblar con los IDs de ESPN, un ID entrante puede
coincidir con un ID antiguo que todavía pertenece a **otro** equipo, abortando el sync a mitad.
La migración lo evita de raíz:

```sql
UPDATE "Team" SET "externalId" = NULL;
```

No es destructivo: `Team.id`, `name`, `league` y las claves ajenas de `Event` quedan intactas.

Resolución de cada equipo, en orden: `externalId` → **nombre normalizado** (con alias) → slug sobre
`Team.id` → crear nuevo. La normalización quita acentos y stopwords (`FC`, `CF`, `Club`,
`Deportivo`, `de`…).

**Por qué un mapa de alias explícito y no emparejado difuso.** Se implementó y se probó una segunda
pasada que emparejaba cuando todas las palabras del nombre de ESPN estaban contenidas en el de la
base de datos, con guardas de unicidad y dirección. En el ensayo contra testing hizo esto:

```
"Sport Lisboa e Benfica"  -> "Benfica"           ✓ correcto
"FC Internazionale Milano"-> "Internazionale"    ✓ correcto
"Queens Park Rangers FC"  -> "Rangers"           ✗ ¡el Rangers de ESPN es el de Glasgow!
```

Además no resolvía el caso que la motivó («Olympique Lyonnais» / «Lyon», porque *lyonnais* ≠ *lyon*).
Arreglaba uno, rompía otro. **Se descartó** y en su lugar está `TEAM_NAME_ALIASES` en
`config/competitions.ts`: explícito, auditable y sin riesgo de emparejar mal. Un duplicado se
detecta con el informe de verificación; un emparejado erróneo reasigna eventos históricos en
silencio, que es mucho peor.

Para ampliarlo en producción: ejecutar el informe tras el primer sync y añadir al mapa los equipos
que salgan como huérfanos con eventos.

**Verificación** — `npx tsx scripts/sync-verify.ts report` sustituye a la query manual y comprueba
huérfanos, duplicados, desplegables vacíos y resolución de sugerencias de una sola vez.

### 5.5 Vocabulario que no puede cambiar

Dos strings son claves ajenas de facto y romperían la UI en silencio:

- **`Team.league`** — lo escribe el sync y lo lee `COMPETITION_LEAGUES` para filtrar el desplegable
  de equipos. Si cambian los valores, **todos los desplegables se quedan vacíos**.
- **`Event.competition`** — se persiste y es la clave de `COMPETITION_EMBLEM` en 13 ficheros.

Los 10 nombres que ya existían se conservan literalmente.

Además, las ligas domésticas se sincronizan **antes** que las copas: si se procesara antes una copa,
un equipo de La Liga quedaría marcado con `league: "Copa del Rey"` y desaparecería de su desplegable.

### 5.6 Idempotencia al crear eventos

`Event.externalMatchId` es único. Crear dos veces el mismo partido devuelve
«Este partido ya tiene un evento creado» en vez de duplicarlo — antes el único guardarraíl era un
`Set` en el cliente que se perdía al recargar. Además, evento y asientos se crean ahora en una
**transacción**: sin ella, un fallo al crear los `SeatStatus` dejaba un evento sin asientos y por
tanto no reservable.

Los equipos que no estén en BD se crean al vuelo desde los datos de la propia sugerencia, así que
ya no existe el caso «no puedo crear el evento porque falta un equipo».

---

## 6. Ficheros modificados

| Fichero | Cambio |
|---|---|
| `src/modules/football-data/lib/api-client.ts` | Cliente ESPN: timeout, reintentos, sin espera previa |
| `src/modules/football-data/lib/team-sync.ts` | **Nuevo.** Núcleo del sync sin auth (lo usa el cron) |
| `src/modules/football-data/lib/suggestions.ts` | **Nuevo.** Mapeo a `MatchSuggestion`, aislado para poder testearlo |
| `src/modules/football-data/types/index.ts` | Tipos de ESPN. `MatchSuggestion` y `SyncResult` intactos |
| `src/modules/football-data/config/competitions.ts` | 17 competiciones, `LEGACY_COMPETITION_EMBLEM`, `COMPETITION_LEAGUES` ampliado. Deportes manuales sin tocar |
| `src/modules/football-data/actions/index.ts` | `requireAuth()` en las 3, paralelismo, alta de equipos al vuelo, idempotencia |
| `prisma/schema.prisma` + migración | `Event.externalMatchId Int? @unique` + vaciado de `Team.externalId` |
| `src/app/api/cron/sync-teams/route.ts` | `maxDuration`, llama a `syncTeams()`, devuelve los errores completos |
| `src/app/admin/.../sugerencias/client.tsx` | Mensajes obsoletos de API key y rate limiting |
| `next.config.ts` | `a.espncdn.com`; se conserva `crests.football-data.org` para los emblemas legacy |
| `.env.example` | `FOOTBALL_DATA_API_KEY` marcada como obsoleta; ESPN no necesita clave |

**Sin cambios:** eventos, reservas, asientos, pagos, middleware, autenticación, deportes manuales.

### Variables de entorno

**No hay ninguna que añadir.** ESPN no requiere clave. `FOOTBALL_DATA_API_KEY` queda obsoleta y
puede retirarse de `.env`, `.env.testing` y Vercel tras confirmar la estabilidad en producción.

---

## 7. Estado de verificación

Ejecutado el 14/08/2026 contra la base de datos de **testing** (`tdkiretmgyftlnffkeer`):

- ✅ `npx tsc --noEmit` sin errores y `npm run build` correcto
- ✅ `scripts/espn-smoke-test.ts` — 82 sugerencias, **1230 comprobaciones, 0 fallos**, 680 ms
- ✅ Migración aplicada con `prisma migrate deploy`; los 235 `externalId` quedaron a null y los
  29 eventos y 31 reservas intactos
- ✅ Sync completo: **249 equipos creados, 167 actualizados, 0 errores**
- ✅ **0 huérfanos** — todos los equipos con eventos se re-emparejaron
- ✅ **0 desplegables vacíos** en las 19 competiciones (las 17 activas más las dos retiradas)
- ✅ **Idempotente**: la segunda pasada seguida hace 0 escrituras en 1,3 s
- ✅ 48 de 82 sugerencias resuelven con ambos equipos ya en BD; los 41 clubes restantes son de
  rondas previas europeas y se crean al vuelo al crear el evento

### Rendimiento

La primera versión tardaba **130 s**: escribía equipo a equipo, y cada `update` es un viaje a
Supabase. Con planificación en memoria, detección de cambios y escrituras en lotes de 50 dentro de
una transacción:

| | Antes | Ahora |
|---|---|---|
| Primera sincronización | 130 s | **18 s** |
| Sincronizaciones siguientes | 130 s | **1,3 s** (0 escrituras) |

Medido desde local contra Supabase en `eu-west-1`; en Vercel, dentro de la misma región, será
bastante más rápido.

### Los tres duplicados que informa el verificador son falsos positivos

`Andorra` (selección) / `FC Andorra` (club), `Ourense CF` / `UD Ourense` y `SD Logroñés` /
`UD Logroñés` son equipos realmente distintos que el normalizador marca como parecidos. Ninguno
tiene eventos asociados. No hay que hacer nada.

11 de 164 equipos no traen escudo (clubes menores de rondas previas). La UI cae al círculo de
iniciales, así que degrada bien.

### Pendiente de probar a mano en el navegador

El flujo de UI completo: crear evento desde sugerencia, doble creación rechazada, escudos y
emblemas en tarjetas, evento histórico con competición retirada, y flujo de reserva y pago.

---

## 8. Fase 1 — Preparar el entorno de testing

1. **Reactivar el proyecto Supabase `lounge-app-testing`** desde el dashboard (está pausado por
   inactividad). Sin esto no hay dónde probar nada que toque BD.
2. `npx prisma migrate deploy` contra testing, y `npm run db:seed` si la BD volvió vacía.
3. Revisar en los logs de Vercel si el cron `sync-teams` de producción venía fallando por timeout,
   y confirmar si la cuenta es **Hobby o Pro** (`maxDuration = 300` requiere Pro).

No hay variables de entorno que añadir en Vercel.

---

## 9. Fase 2 — Soak de 2 días en testing

Push a `testing` → Vercel despliega en Preview.

> ⚠️ **Vercel no ejecuta cron jobs en deployments de Preview, solo en Production.** El cron no se
> disparará solo en testing. Hay que lanzarlo a mano una vez al día durante dos días:

```bash
curl -H "Authorization: Bearer $CRON_SECRET_TESTING" \
     https://lounge-app-titanium.vercel.app/api/cron/sync-teams
```

### Checklist

- [ ] El sync termina sin timeout — comprobar `durationMs` en la respuesta
- [ ] `errors: []` y cifras de `created`/`updated` coherentes
- [ ] **Cero duplicados** — la query de reconciliación del §5.4 devuelve vacío
- [ ] Sugerencias carga partidos de Europa League, Conference League y La Liga 2
- [ ] El desplegable de competición muestra las 17 y no Championship ni Brasileirão
- [ ] Los desplegables de **equipos no están vacíos** en cada competición (valida el §5.5)
- [ ] Crear evento desde una sugerencia de Europa League → equipos correctos
- [ ] Crear **dos veces** la misma sugerencia → la segunda se rechaza limpiamente
- [ ] Escudos de equipo y emblemas de competición se ven en tarjetas y filas
- [ ] Un evento histórico con Championship o Brasileirão sigue mostrando su emblema
- [ ] El flujo completo de reserva y pago sandbox sigue funcionando
- [ ] Las tres acciones rechazan peticiones sin sesión (valida `requireAuth`)
- [ ] Volver a ejecutar `npx tsx scripts/espn-smoke-test.ts` el segundo día

---

## 10. Fase 3 — Producción

Solo con la checklist en verde.

1. **Snapshot de la BD de producción** desde Supabase
2. Merge `testing` → `main` y push
3. `npx prisma migrate deploy` contra producción (con `.env` apuntando a prod)
4. Disparar el cron a mano una vez y verificar la respuesta
5. Repetir las verificaciones de duplicados y de desplegables no vacíos
6. Merge a `dev`
7. Limpieza tras una semana estable: retirar `FOOTBALL_DATA_API_KEY` de `.env`, `.env.testing` y Vercel

### Rollback

- **Código:** `git revert` del merge; Vercel redespliega la versión anterior automáticamente.
- **Datos:** el único cambio destructivo es el vaciado de `Team.externalId`. Ningún evento se rompe
  (ver §5.4). Para volver atrás basta con que `FOOTBALL_DATA_API_KEY` siga en su sitio.
- **Punto sin retorno:** ninguno hasta la Fase 3, y aun ahí está el snapshot del paso 1.

---

## 11. Scripts auxiliares

Todos los que tocan base de datos leen las credenciales del entorno. **Hay que exportarlas antes**,
porque `.env` apunta a producción:

```bash
set -a && . ./.env.testing && set +a
```

| Script | Para qué |
|---|---|
| `scripts/db-whoami.ts` | A qué base de datos estoy conectado y qué hay dentro. **Ejecutarlo antes de cualquier operación de escritura** |
| `scripts/sync-run.ts` | Lanza el sync (el mismo código que el cron) contra el entorno actual |
| `scripts/sync-verify.ts` | `snapshot` guarda el estado previo; `report` busca huérfanos, duplicados, desplegables vacíos y comprueba que las sugerencias resuelven |
| `scripts/sync-reset.ts` | ⚠️ Destructivo. Deja la tabla Team como el snapshot para repetir el ensayo de la primera sincronización. Exige `--confirm <project-ref>` del proyecto conectado |
| `scripts/espn-smoke-test.ts` | Ejercita el código real contra ESPN en vivo y valida las invariantes, sin necesidad de BD. **Vale la pena repetirlo cada cierto tiempo**: al ser una API no documentada, un cambio de forma se detecta aquí primero |
| `scripts/download-crests.ts` | Descarga escudos y emblemas a `public/` y re-enlaza `Team.logo` a la copia local. Idempotente; `--dry-run` y `--force`. **Ejecutarlo cada cierto tiempo** para recoger los equipos que el cron crea sobre la marcha |
| `scripts/espn-discover.mjs` | Regenera el bloque `COMPETITIONS` de la config. Útil al añadir competiciones |
| `scripts/spike-api-football.mjs` | El gate que descartó API-Football. Re-ejecutable si algún día amplían su free tier |

### Ensayar la primera sincronización tantas veces como haga falta

```bash
set -a && . ./.env.testing && set +a
npx tsx scripts/db-whoami.ts                              # confirmar entorno
npx tsx scripts/sync-verify.ts snapshot                   # estado previo
npx tsx scripts/sync-reset.ts --confirm <project-ref>     # volver al estado previo
npx tsx scripts/sync-run.ts                               # sincronizar
npx tsx scripts/sync-verify.ts report                     # comprobar el resultado
```
