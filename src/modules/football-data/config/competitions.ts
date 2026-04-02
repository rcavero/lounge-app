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
  { code: "CL", name: "Champions League", league: "Champions League", emblem: `${EMBLEM_BASE}/CL.png` },
  { code: "PD", name: "La Liga", league: "La Liga", emblem: `${EMBLEM_BASE}/PD.png` },
  { code: "PL", name: "Premier League", league: "Premier League", emblem: `${EMBLEM_BASE}/PL.png` },
  { code: "SA", name: "Serie A", league: "Serie A", emblem: `${EMBLEM_BASE}/SA.png` },
  { code: "FL1", name: "Ligue 1", league: "Ligue 1", emblem: `${EMBLEM_BASE}/FL1.png` },
  { code: "BL1", name: "Bundesliga", league: "Bundesliga", emblem: `${EMBLEM_BASE}/BL1.png` },
  { code: "PPL", name: "Primeira Liga", league: "Primeira Liga", emblem: `${EMBLEM_BASE}/PPL.png` },
  { code: "DED", name: "Eredivisie", league: "Eredivisie", emblem: `${EMBLEM_BASE}/DED.png` },
  { code: "WC", name: "World Cup", league: "World Cup", emblem: `${EMBLEM_BASE}/WC.png` },
  { code: "EC", name: "European Championship", league: "European Championship", emblem: `${EMBLEM_BASE}/EC.png` },
  { code: "ELC", name: "Championship", league: "Championship", emblem: `${EMBLEM_BASE}/ELC.png` },
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
// ─── Deportes manuales (sin API — se crean a mano en el formulario) ────────────

export interface ManualSport {
  name: string;
  emoji: string;
  isMotorSport?: boolean; // Moto GP y Fórmula 1: un único campo "Gran Premio"
}

export const MANUAL_SPORTS: ManualSport[] = [
  { name: "Baloncesto", emoji: "🏀" },
  { name: "Rugby",      emoji: "🏉" },
  { name: "Tenis",      emoji: "🎾" },
  { name: "Moto GP",    emoji: "🏍️", isMotorSport: true },
  { name: "Fórmula 1",  emoji: "🏎️", isMotorSport: true },
  { name: "Billar",     emoji: "🎱" },
  { name: "Dardos",     emoji: "🎯" },
  { name: "Hockey",     emoji: "🏒" },
  { name: "Ciclismo",   emoji: "🚴" },
  { name: "Boxeo",      emoji: "🥊" },
  { name: "Otros",      emoji: "🏅" },
];

export const MANUAL_SPORT_NAMES = MANUAL_SPORTS.map((s) => s.name);

export const MANUAL_SPORT_BY_NAME = Object.fromEntries(
  MANUAL_SPORTS.map((s) => [s.name, s])
) as Record<string, ManualSport>;

/** Devuelve true si la competición es un deporte manual (no fútbol). */
export function isManualSport(competition: string | null | undefined): boolean {
  return !!competition && !!MANUAL_SPORT_BY_NAME[competition];
}

/** Devuelve true si es motor sport (Moto GP / Fórmula 1): un solo campo de Gran Premio. */
export function isMotorSport(competition: string | null | undefined): boolean {
  return !!competition && !!MANUAL_SPORT_BY_NAME[competition]?.isMotorSport;
}

/** Devuelve el emoji del deporte, o null si es fútbol u otro deporte desconocido. */
export function getSportEmoji(competition: string | null | undefined): string | null {
  if (!competition) return null;
  return MANUAL_SPORT_BY_NAME[competition]?.emoji ?? null;
}

// ─── Ligas por competición de fútbol ────────────────────────────────────────

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
