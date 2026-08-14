import type {
  EspnScoreboardResponse,
  EspnTeamsResponse,
  EspnTeam,
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
async function fetchApi<T extends { code?: number }>(
  path: string
): Promise<T | null> {
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
        throw new EspnApiError(
          `ESPN respondió ${response.status} para ${path}`
        );
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
    }`
  );
}

/** Devuelve YYYYMMDD, el formato que espera el parámetro `dates` de ESPN. */
function toEspnDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Partidos de una competición dentro de los próximos N días.
 *
 * @param code Slug de ESPN (p.ej. "esp.1" para La Liga)
 * @param days Días hacia delante (por defecto 7, igual que el cliente anterior)
 *
 * Nota: rangos de fechas muy amplios (más de unos meses) hacen que ESPN
 * devuelva 0 eventos aunque los haya. La ventana de 7 días está muy por
 * debajo de ese umbral.
 */
export async function getScheduledMatches(
  code: string,
  days: number = 7
): Promise<EspnScoreboardResponse | null> {
  const today = new Date();
  const from = toEspnDate(today);
  const to = toEspnDate(new Date(today.getTime() + days * 24 * 60 * 60 * 1000));

  return fetchApi<EspnScoreboardResponse>(
    `/${code}/scoreboard?dates=${from}-${to}`
  );
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
