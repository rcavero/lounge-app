# Migración de football-data.org a API-Football

**Creado:** 22 de Abril de 2026  
**Estado:** Pendiente de implementación

---

## 1. Diagnóstico

### Qué cubre football-data.org (free tier)

El free tier tiene exactamente 12 competiciones y no se puede ampliar sin pagar:

| Competición | ¿Queremos mantenerla? | Estado actual |
|---|---|---|
| Champions League | ✅ | Sincronizando |
| La Liga | ✅ | Sincronizando |
| Premier League | ✅ | Sincronizando |
| Serie A | ✅ | Sincronizando |
| Ligue 1 | ✅ | Sincronizando |
| Bundesliga | ✅ | Sincronizando |
| Primeira Liga | ✅ | Sincronizando |
| Eredivisie | ✅ | Sincronizando |
| World Cup | ✅ | Sincronizando |
| European Championship | ✅ | Sincronizando |
| Championship | ❌ | Sincronizando (a eliminar) |
| Brasileirão | ❌ | Sincronizando (a eliminar) |
| **Europa League** | ✅ | ❌ No disponible en free |
| **Conference League** | ✅ | ❌ No disponible en free |
| **La Liga 2** | ✅ | ❌ No disponible en free |
| **Copa del Rey** | ✅ | ❌ No disponible en free |
| **Supercopa de España** | ✅ | ❌ No disponible en free |
| **Copa América** | ✅ | ❌ No disponible en free |
| **Nations League** | ✅ | ❌ No disponible en free |

Tier 2 de football-data.org cuesta €12/mes y solo añadiría Europa League y Copa del Rey — Conference League, Copa América y Nations League seguirían sin estar disponibles.

---

## 2. Solución elegida: API-Football (api-sports.io)

### Por qué API-Football

- **Gratuito** (100 requests/día, sin tarjeta de crédito, para siempre)
- **Cubre todas las competiciones** que necesitamos
- Los IDs de equipos son enteros (`Int`) — compatible con el campo `externalId` actual en BD
- Una sola API para mantener en lugar de mezclar dos fuentes
- Logos de equipos y competiciones incluidos en las respuestas
- Acceso directo sin intermediarios (sin RapidAPI)

### Formas de acceso — se elige la directa

Existen dos formas de usar esta API. Usaremos la **directa** (sin RapidAPI) por ser más sencilla:

| | Vía api-sports.io (elegida) | Vía RapidAPI (descartada) |
|---|---|---|
| Registro | dashboard.api-sports.io | rapidapi.com |
| Header auth | `x-apisports-key: TU_KEY` | `x-rapidapi-key` + `x-rapidapi-host` |
| Base URL | `https://v3.football.api-sports.io` | `https://api-football-v1.p.rapidapi.com/v3` |
| Límite free | 100 req/día | 100 req/día |
| Tarjeta crédito | No requerida | No requerida |

### Límite de requests

100 req/día es suficiente. El cron diario necesita:
- ~17 requests para sincronizar equipos (1 por competición)
- ~17 requests para partidos de sugerencias (1 por competición cuando se consultan)

Total: ~34 requests/día en uso normal, sobra margen.

### IDs de competición en API-Football

Los IDs marcados con ✅ han sido verificados por múltiples fuentes externas.
Los marcados con ⚠️ deben confirmarse con el endpoint `/leagues` tras crear la cuenta.

| Competición | ID | Estado |
|---|---|---|
| Champions League | 2 | ✅ Verificado |
| Europa League | 3 | ✅ Verificado |
| Conference League | 848 | ✅ Verificado |
| La Liga | 140 | ✅ Verificado |
| La Liga 2 | 141 | ✅ Verificado |
| Premier League | 39 | ✅ Verificado |
| Serie A | 135 | ✅ Verificado |
| Bundesliga | 78 | ✅ Verificado |
| Ligue 1 | 61 | ✅ Verificado |
| Primeira Liga | 94 | ✅ Verificado |
| Eredivisie | 88 | ✅ Verificado |
| World Cup | 1 | ✅ Verificado |
| European Championship | 4 | ✅ Verificado |
| Copa del Rey | ❓ (143 o 300) | ⚠️ Verificar tras crear cuenta |
| Supercopa de España | ❓ (556 o 383) | ⚠️ Verificar tras crear cuenta |
| Copa América | ❓ (9) | ⚠️ Verificar tras crear cuenta |
| UEFA Nations League | ❓ (5) | ⚠️ Verificar tras crear cuenta |

### Cómo verificar los IDs tras crear la cuenta

Llamar al endpoint de ligas filtrando por país o nombre:

```
GET https://v3.football.api-sports.io/leagues?name=Copa+del+Rey&country=Spain
GET https://v3.football.api-sports.io/leagues?name=Super+Cup&country=Spain
GET https://v3.football.api-sports.io/leagues?name=Copa+America
GET https://v3.football.api-sports.io/leagues?name=UEFA+Nations+League
```

Cada respuesta incluye el `id` numérico correcto. Actualizar la tabla anterior con los valores reales antes de implementar.

---

## 3. Análisis de impacto

### Archivos que cambian

| Archivo | Cambio |
|---|---|
| `src/modules/football-data/lib/api-client.ts` | Cliente HTTP completamente nuevo (headers, base URL, rate limiting adaptado) |
| `src/modules/football-data/types/index.ts` | Nuevos tipos para el formato de respuesta de API-Football |
| `src/modules/football-data/config/competitions.ts` | Nuevos códigos (IDs numéricos), nuevas competiciones, nuevas URLs de emblemas |
| `src/modules/football-data/actions/index.ts` | Adaptar `syncTeams` y `getMatchSuggestions` al nuevo formato |
| `.env.local` / Vercel env vars | Añadir `RAPIDAPI_KEY`, eliminar `FOOTBALL_DATA_API_KEY` |
| `DEVELOPMENT.md` | Actualizar referencias a la API |

### Archivos que NO cambian

- `prisma/schema.prisma` — el modelo `Team` (con `externalId Int?`) es compatible
- Todo el módulo de eventos, reservas, asientos y pagos
- Toda la UI
- Los deportes manuales (Baloncesto, F1, etc.)
- El middleware y la autenticación
- El resto de cron jobs

### Riesgo principal: equipos existentes en BD

Los equipos actuales tienen `externalId` de football-data.org. Tras la migración, el sync usará IDs de API-Football. Si simplemente insertamos los nuevos equipos, se crearán duplicados (ej: "Real Madrid" aparecería dos veces con distintos `externalId`).

**Solución elegida:** durante el sync, buscar por nombre antes de insertar. Si existe un equipo con el mismo nombre, actualizar su `externalId` y `logo` en lugar de crear uno nuevo. Así los eventos existentes que referencian equipos por ID siguen funcionando.

---

## 4. Diferencias de formato de respuesta

### football-data.org (actual)
```json
// GET /competitions/{code}/teams
{
  "teams": [
    { "id": 86, "name": "Real Madrid CF", "shortName": "Real Madrid", "crest": "https://..." }
  ]
}

// GET /competitions/{code}/matches?status=SCHEDULED
{
  "matches": [
    {
      "id": 12345,
      "utcDate": "2026-05-10T19:00:00Z",
      "homeTeam": { "id": 86, "name": "Real Madrid CF", "crest": "https://..." },
      "awayTeam": { "id": 81, "name": "FC Barcelona", "crest": "https://..." },
      "competition": { "name": "La Liga", "emblem": "https://..." }
    }
  ]
}
```

### API-Football (nuevo)
```json
// GET /teams?league=140&season=2025
{
  "response": [
    {
      "team": { "id": 541, "name": "Real Madrid", "code": "REA", "logo": "https://..." },
      "venue": { ... }
    }
  ]
}

// GET /fixtures?league=140&season=2025&next=20
{
  "response": [
    {
      "fixture": { "id": 9999, "date": "2026-05-10T19:00:00+00:00", "status": { "short": "NS" } },
      "league": { "id": 140, "name": "La Liga", "logo": "https://..." },
      "teams": {
        "home": { "id": 541, "name": "Real Madrid", "logo": "https://..." },
        "away": { "id": 529, "name": "FC Barcelona", "logo": "https://..." }
      }
    }
  ]
}
```

---

## 5. Plan de implementación — Fase 1 (entorno testing)

Implementar y probar todo en la rama `testing` antes de tocar `main`.

### Paso 1 — Crear cuenta y obtener API key

1. Ir a https://dashboard.api-sports.io/register y crear cuenta gratuita (no requiere tarjeta)
2. Confirmar el email de verificación
3. En el dashboard, ir a **My Account → API Key** y copiar la key
4. Verificar los IDs de competiciones inciertos con las llamadas al endpoint `/leagues` descritas en la sección 2
5. Actualizar la tabla de IDs del documento antes de continuar

### Paso 2 — Añadir la variable de entorno

**En local (`.env.local`):**
```env
APISPORTS_KEY="tu_key_aqui"
```

**En Vercel (para testing):**
- Vercel → Settings → Environment Variables
- Añadir `APISPORTS_KEY` solo en entorno **Preview** (rama testing)
- La variable `FOOTBALL_DATA_API_KEY` puede quedarse — no se usará pero no rompe nada hasta la limpieza final

### Paso 3 — Reescribir `api-client.ts`

Nuevo cliente con:
- Base URL: `https://v3.football.api-sports.io`
- Header: `x-apisports-key: TU_KEY`
- Sin rate limiting agresivo (100/día es más que suficiente, pero añadir un pequeño delay entre requests en el cron para no hacer burst)
- Parámetro `season` calculado dinámicamente (año actual, o año anterior si el mes es antes de agosto — temporada de verano)

### Paso 4 — Actualizar `types/index.ts`

Nuevos tipos que reflejen el formato de respuesta de API-Football (ver ejemplos en sección 4).

### Paso 5 — Actualizar `competitions.ts`

- Eliminar Championship y Brasileirão
- Cambiar los `code` de string a número (o mantener string con el ID como valor: `"140"`)
- Añadir todas las nuevas competiciones (Europa League, Conference League, Copa del Rey, Supercopa, Copa América, Nations League, La Liga 2)
- Actualizar los `emblem` con las URLs que devuelva la API (o usar las de API-Football directamente desde la respuesta)
- Actualizar `COMPETITION_LEAGUES` para los nuevos mapeos de equipos por competición

### Paso 6 — Adaptar `actions/index.ts`

#### `syncTeams`
- Iterar sobre las nuevas competiciones
- Para cada competición, llamar a `/teams?league={id}&season={season}`
- **Lógica upsert por nombre:** buscar si ya existe un team con ese nombre → si existe, actualizar `externalId` y `logo`; si no, crear nuevo
- Guardar el campo `league` con el nombre de la competición principal del equipo

#### `getMatchSuggestions`
- Llamar a `/fixtures?league={id}&season={season}&next=20`
- Filtrar solo partidos con status `NS` (Not Started)
- Mapear al formato `MatchSuggestion` que espera la UI

### Paso 7 — Probar en local antes de hacer push a testing

```bash
# Verificar que el build no tiene errores de tipos
npm run build

# Iniciar dev server y probar manualmente:
# 1. Ir a /admin/eventos/sugerencias → deben aparecer partidos de las nuevas competiciones
# 2. Ir a /admin/eventos/nuevo → el dropdown debe mostrar las nuevas competiciones y ya no Championship/Brasileirão
# 3. Seleccionar un partido de sugerencias y crear un evento → verificar que los equipos se guardan correctamente
```

### Paso 8 — Forzar sync de equipos en testing

Tras el despliegue en Vercel Preview, ejecutar el cron manualmente para poblar los equipos nuevos:

```bash
# Llamar al endpoint de sync desde el navegador o curl (con el CRON_SECRET correcto):
curl -H "Authorization: Bearer TU_CRON_SECRET" https://lounge-app-titanium.vercel.app/api/cron/sync-teams
```

Verificar en Prisma Studio (o en la página de sugerencias) que los equipos se han sincronizado correctamente y sin duplicados.

### Paso 9 — Pruebas funcionales en testing

Verificar punto por punto:

- [ ] La página `/admin/eventos/sugerencias` carga partidos de todas las competiciones nuevas
- [ ] El dropdown de competición en el formulario de evento muestra las nuevas competiciones y no muestra Championship ni Brasileirão
- [ ] Crear un evento desde una sugerencia de Europa League → el evento se guarda con los equipos correctos
- [ ] Crear un evento desde una sugerencia de Copa del Rey → ídem
- [ ] Los logos de equipos se muestran correctamente en las tarjetas de eventos
- [ ] Los emblemas de competición se muestran correctamente
- [ ] Los equipos existentes en BD (los de football-data.org) no se han duplicado
- [ ] El flujo completo de reserva sigue funcionando (no debería verse afectado, pero verificar)
- [ ] El cron de sync-teams completa sin errores y sin superar el límite de 100 req/día

---

## 6. Plan de implementación — Fase 2 (aplicar a main y dev)

Solo cuando todas las pruebas de la Fase 1 estén en verde.

### Aplicar a `main` (producción)

1. Añadir `RAPIDAPI_KEY` en Vercel → Environment Variables → **Production**
2. Cherry-pick o merge de los commits de testing a main
3. Push a main → Vercel despliega automáticamente
4. Ejecutar el cron de sync-teams manualmente para poblar los nuevos equipos en producción
5. Verificar en producción que todo funciona

### Aplicar a `dev` (local)

1. Cherry-pick o merge a la rama dev
2. La variable ya está en `.env.local`

### Limpieza final (opcional, tras confirmar que todo funciona en producción)

- Eliminar `FOOTBALL_DATA_API_KEY` de `.env.local` y de Vercel
- Eliminar la variable del `DEVELOPMENT.md`

---

## 7. Casos especiales a tener en cuenta

### Temporada (parámetro `season`)

API-Football requiere el año de la temporada (ej: `2025` para la temporada 2025-26). La lógica para determinarlo:
- Si el mes actual es agosto o posterior → temporada = año actual
- Si el mes es antes de agosto → temporada = año anterior
- Esto es porque La Liga, Champions, etc. empiezan en agosto

Para competiciones de verano (World Cup, Copa América, Nations League, Eurocopa) que no siguen el ciclo agosto-julio, habrá que detectar si hay datos disponibles para el año actual o el anterior. Lo más sencillo: intentar el año actual y si devuelve 0 equipos, probar con el anterior.

### Equipos duplicados

Si la BD ya tiene equipos de football-data.org, la estrategia upsert por nombre debe ser case-insensitive y tolerar pequeñas diferencias (ej: "FC Barcelona" vs "Barcelona"). Una posible solución: normalizar el nombre quitando prefijos como "FC", "CF", "Real", etc. para la comparación, pero guardar el nombre original de la nueva API.

### Emblemas de competición

Actualmente los emblemas de competición se cargan desde URLs estáticas de `crests.football-data.org`. Con API-Football, los logos de competición vienen en la respuesta de `/fixtures` (campo `league.logo`). Hay dos opciones:
- **Opción A (recomendada):** almacenar la URL del logo en `competitions.ts` directamente después de hacer una primera llamada de prueba y copiar las URLs
- **Opción B:** fetchar el logo dinámicamente desde la respuesta de fixtures (más complejo)

### Copa del Rey y Supercopa — equipos

Estas competiciones tienen equipos de La Liga y La Liga 2. API-Football devuelve los equipos participantes cuando se hace `/teams?league=143&season=2025`. Estos equipos ya deberían estar en BD desde la sync de La Liga/La Liga 2, así que el upsert por nombre los actualizará sin crear duplicados.

### Límite de 100 req/día en el cron

El cron de sync-teams actualmente itera sobre todas las competiciones (pasará de 12 a 17). Con 17 competiciones = 17 requests, estamos muy por debajo del límite. Sin embargo, añadir un pequeño delay (500ms) entre requests para no hacer burst es buena práctica.

### Partidos sin `shortName`

API-Football devuelve `team.code` (3 letras, ej: "REA") en lugar de `shortName`. Usar ese campo como `shortName` del equipo en BD.

---

## 8. Plan de rollback

Si algo falla durante la Fase 1 (testing) y necesitamos revertir:
1. Revertir los commits en la rama testing: `git revert` de los commits de migración
2. No hay cambios en BD que sean irreversibles — los equipos nuevos simplemente quedarían huérfanos pero no romperían nada
3. La variable `FOOTBALL_DATA_API_KEY` sigue en Vercel Preview si no la hemos eliminado

Si algo falla durante la Fase 2 (main):
1. Revertir el commit en main
2. Vercel vuelve a desplegar la versión anterior automáticamente
3. Los eventos existentes en producción no se verán afectados (solo los equipos en la tabla Team cambian)
4. En el peor caso, ejecutar el cron antiguo una vez para re-sincronizar equipos con football-data.org

---

## 9. Variables de entorno — resumen final

### Local (`.env.local`)
```env
# Añadir:
APISPORTS_KEY="tu_key_aqui"

# Eliminar (tras confirmar que todo funciona):
# FOOTBALL_DATA_API_KEY="..."
```

### Vercel — Preview (rama testing)
```
APISPORTS_KEY = tu_key_aqui
```

### Vercel — Production (rama main)
```
APISPORTS_KEY = tu_key_aqui  ← añadir en Fase 2
```

---

## 10. Orden del día para la sesión de implementación

1. [ ] Crear cuenta RapidAPI y obtener `RAPIDAPI_KEY`
2. [ ] Añadir `RAPIDAPI_KEY` a `.env.local` y a Vercel Preview
3. [ ] Implementar cambios en rama `testing` (pasos 3-6 de Fase 1)
4. [ ] Probar en local con `npm run build` y `npm run dev`
5. [ ] Push a `testing` → esperar deploy en Vercel Preview
6. [ ] Ejecutar cron de sync-teams en testing manualmente
7. [ ] Pasar checklist de pruebas funcionales (paso 9 de Fase 1)
8. [ ] Si todo OK → aplicar a `main` (Fase 2)
9. [ ] Ejecutar cron de sync-teams en producción manualmente
10. [ ] Verificar producción
11. [ ] Cherry-pick a `dev`
12. [ ] Limpieza final de variables obsoletas
