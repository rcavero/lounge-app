import type {
  ApiCompetitionTeamsResponse,
  ApiMatchesResponse,
} from "../types";

const BASE_URL = "https://api.football-data.org/v4";

// Rate limiting: max 10 requests per minute on free tier → 6.1s between requests
const MIN_REQUEST_INTERVAL_MS = 6100;
let lastRequestTime = 0;

async function waitForRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - elapsed;
    console.log(`[football-data] Rate limit: waiting ${waitTime}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
}

async function fetchApi<T>(endpoint: string): Promise<T> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("FOOTBALL_DATA_API_KEY is not set");
  }

  await waitForRateLimit();

  const url = `${BASE_URL}${endpoint}`;
  console.log(`[football-data] GET ${url}`);

  lastRequestTime = Date.now();
  const response = await fetch(url, {
    headers: {
      "X-Auth-Token": apiKey,
    },
    // No cache for server actions
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `football-data API error ${response.status}: ${text.substring(0, 200)}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Get all teams for a competition.
 * @param code Competition code (e.g., "PD" for La Liga)
 */
export async function getCompetitionTeams(
  code: string
): Promise<ApiCompetitionTeamsResponse> {
  return fetchApi<ApiCompetitionTeamsResponse>(
    `/competitions/${code}/teams`
  );
}

/**
 * Get scheduled matches for a competition within the next N days.
 * @param code Competition code (e.g., "PD" for La Liga)
 * @param days Number of days ahead to fetch (default 7)
 */
export async function getScheduledMatches(
  code: string,
  days: number = 7
): Promise<ApiMatchesResponse> {
  const today = new Date();
  const dateFrom = today.toISOString().split("T")[0];
  const dateTo = new Date(today.getTime() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return fetchApi<ApiMatchesResponse>(
    `/competitions/${code}/matches?status=SCHEDULED,TIMED&dateFrom=${dateFrom}&dateTo=${dateTo}`
  );
}
