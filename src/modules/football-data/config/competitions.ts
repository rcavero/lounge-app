// Football-data.org free tier competitions (12 total)
// https://docs.football-data.org/general/v4/index.html

export interface Competition {
  code: string; // API code
  name: string; // Display name
  league: string; // Corresponds to Team.league field
  emblem: string; // Competition emblem URL
}

const EMBLEM_BASE = "https://crests.football-data.org";

export const COMPETITIONS: Competition[] = [
  { code: "PD", name: "La Liga", league: "La Liga", emblem: `${EMBLEM_BASE}/PD.png` },
  { code: "PL", name: "Premier League", league: "Premier League", emblem: `${EMBLEM_BASE}/PL.png` },
  { code: "SA", name: "Serie A", league: "Serie A", emblem: `${EMBLEM_BASE}/SA.png` },
  { code: "BL1", name: "Bundesliga", league: "Bundesliga", emblem: `${EMBLEM_BASE}/BL1.png` },
  { code: "FL1", name: "Ligue 1", league: "Ligue 1", emblem: `${EMBLEM_BASE}/FL1.png` },
  { code: "CL", name: "Champions League", league: "Champions League", emblem: `${EMBLEM_BASE}/CL.png` },
  { code: "EC", name: "European Championship", league: "European Championship", emblem: `${EMBLEM_BASE}/EC.png` },
  { code: "WC", name: "World Cup", league: "World Cup", emblem: `${EMBLEM_BASE}/WC.png` },
  { code: "ELC", name: "Championship", league: "Championship", emblem: `${EMBLEM_BASE}/ELC.png` },
  { code: "DED", name: "Eredivisie", league: "Eredivisie", emblem: `${EMBLEM_BASE}/DED.png` },
  { code: "PPL", name: "Primeira Liga", league: "Primeira Liga", emblem: `${EMBLEM_BASE}/PPL.png` },
  { code: "BSA", name: "Brasileirão", league: "Brasileirão", emblem: `${EMBLEM_BASE}/BSA.png` },
];

// Competition names for dropdown display
export const COMPETITION_NAMES = COMPETITIONS.map((c) => c.name);

// Map from competition code to Competition object
export const COMPETITION_BY_CODE = Object.fromEntries(
  COMPETITIONS.map((c) => [c.code, c])
) as Record<string, Competition>;

// Map from competition display name to Competition object
export const COMPETITION_BY_NAME = Object.fromEntries(
  COMPETITIONS.map((c) => [c.name, c])
) as Record<string, Competition>;

// Map from competition display name to emblem URL
export const COMPETITION_EMBLEM = Object.fromEntries(
  COMPETITIONS.map((c) => [c.name, c.emblem])
) as Record<string, string>;

// Mapping from competition name to leagues whose teams participate
// Used in event forms to filter the team dropdown
export const COMPETITION_LEAGUES: Record<string, string[]> = {
  "La Liga": ["La Liga"],
  "Premier League": ["Premier League"],
  "Serie A": ["Serie A"],
  "Bundesliga": ["Bundesliga"],
  "Ligue 1": ["Ligue 1"],
  "Championship": ["Championship"],
  "Eredivisie": ["Eredivisie"],
  "Primeira Liga": ["Primeira Liga"],
  "Brasileirão": ["Brasileirão"],
  "Champions League": [
    "La Liga", "Premier League", "Serie A", "Bundesliga", "Ligue 1",
    "Eredivisie", "Primeira Liga",
  ],
  "Europa League": [
    "La Liga", "Premier League", "Serie A", "Bundesliga", "Ligue 1",
    "Eredivisie", "Primeira Liga",
  ],
  "European Championship": [
    "La Liga", "Premier League", "Serie A", "Bundesliga", "Ligue 1",
    "Championship", "Eredivisie", "Primeira Liga",
  ],
  "World Cup": [
    "La Liga", "Premier League", "Serie A", "Bundesliga", "Ligue 1",
    "Championship", "Eredivisie", "Primeira Liga", "Brasileirão",
  ],
};
