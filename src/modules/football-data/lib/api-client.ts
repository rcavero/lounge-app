import type {
  EspnScoreboardResponse,
  EspnTeamsResponse,
  EspnTeam,
  EspnEvent,
} from "../types";

const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer";

// La API de ESPN no exige clave ni impone cuota diaria. Medido el 14/08/2026:
// 12 peticiones consecutivas en 5 s sin un solo fallo. Por eso no hay espera
// previa entre peticiones, a diferencia del cliente anterior de football-data
// (que dormía 6,1 s por petición para respetar su límite de 10/min).
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

class EspnApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EspnApiError";
  }
}

/**
 * GET contra la API de ESPN con timeout y reintentos.
 *
 * Devuelve null cuando el recurso no existe (slug inválido → ESPN responde
 * `{ "code": 404 }` con HTTP 200), para que quien llama pueda saltárselo sin
 * abortar el resto de competiciones.
 */
async function fetchApi<T extends { code?: number }>(path: string): Promise<T | null> {
  const url = `${BASE_URL}${path}`;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });

      if (response.status === 404) return null;

      if (response.status === 429 || response.status >= 500) {
        // Transitorio: merece reintento con backoff.
        throw new EspnApiError(`ESPN respondió ${response.status}`);
      }

      if (!response.ok) {
        throw new EspnApiError(`ESPN respondió ${response.status} para ${path}`);
      }

      const body = (await response.json()) as T;

      // ESPN señala "no existe" con un 200 y `{ "code": 404 }` en el cuerpo.
      if (body?.code === 404) return null;

      return body;
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === MAX_RETRIES;
      if (isLastAttempt) break;
      // Backoff: 500 ms, 1500 ms
      await new Promise((r) => setTimeout(r, 500 * (attempt * 2 + 1)));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new EspnApiError(
    `Fallo al pedir ${path}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Meses (YYYYMM) que hay que pedir para cubrir la ventana [from, to].
 *
 * Se añade un día de margen a cada lado a propósito: ESPN agrupa por su propio
 * día (huso de EE. UU.), así que un partido a las 01:00 UTC del día 1 de un mes
 * aparece listado en el mes anterior. El margen cuesta como mucho una petición
 * más y elimina el caso de borde.
 */
export function espnMonths(from: Date, to: Date): string[] {
  const months: string[] = [];
  const cursor = new Date(from.getTime() - DAY_MS);
  const last = new Date(to.getTime() + DAY_MS);

  cursor.setUTCDate(1);
  while (cursor.getTime() <= last.getTime()) {
    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${year}${month}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

/**
 * Partidos de una competición dentro de los próximos N días.
 *
 * @param code Slug de ESPN (p.ej. "esp.1" para La Liga)
 * @param days Días hacia delante
 *
 * IMPORTANTE — no volver a usar `dates=YYYYMMDD-YYYYMMDD`.
 * Desde el 17/09/2026 ESPN responde 400 `{"code":400,"message":"Failed to get
 * events endpoint."}` a CUALQUIER rango con guion, sea de dos días o de una
 * semana. No es cuestión de amplitud ni de nuestros slugs: es un cambio global
 * de ESPN, que devuelve lo mismo en /football/nfl y /basketball/nba. Sí siguen
 * funcionando el día suelto (`20260917`), el mes (`202609`) y el año (`2026`).
 *
 * Por eso se pide el mes —o los dos meses que toque la ventana— y se filtra
 * aquí: el mes devuelve exactamente la misma forma de respuesta que el rango,
 * así que el mapeo de toSuggestion y los tipos no cambian.
 */
export async function getScheduledMatches(
  code: string,
  days: number = 14,
): Promise<EspnScoreboardResponse | null> {
  const from = new Date();
  const to = new Date(from.getTime() + days * DAY_MS);

  const responses = await Promise.all(
    espnMonths(from, to).map((month) =>
      fetchApi<EspnScoreboardResponse>(`/${code}/scoreboard?dates=${month}`),
    ),
  );

  const found = responses.filter((r): r is EspnScoreboardResponse => r !== null);
  // Ningún mes existe: el slug no está en ESPN. Se conserva el null para que
  // quien llama se salte esta competición sin abortar el resto.
  if (found.length === 0) return null;

  // Un partido puede venir en dos meses distintos por el margen de un día.
  const byId = new Map<string, EspnEvent>();
  for (const response of found) {
    for (const event of response.events ?? []) {
      const time = new Date(event.date).getTime();
      if (Number.isNaN(time)) continue;
      if (time < from.getTime() || time > to.getTime()) continue;
      byId.set(event.id, event);
    }
  }

  return { leagues: found[0].leagues, events: [...byId.values()] };
}

/**
 * Plantilla completa de una competición.
 * Solo devuelve datos útiles en ligas domésticas; en copas ESPN suele
 * responder con una lista vacía.
 */
export async function getCompetitionTeams(code: string): Promise<EspnTeam[]> {
  const response = await fetchApi<EspnTeamsResponse>(`/${code}/teams`);
  if (!response) return [];

  const teams = response.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return teams.map((entry) => entry.team).filter(Boolean);
}

/** Normaliza el escudo de un equipo: ESPN lo expone en `logo` o en `logos[0].href`. */
export function getTeamLogo(team: EspnTeam): string | null {
  return team.logo ?? team.logos?.[0]?.href ?? null;
}
