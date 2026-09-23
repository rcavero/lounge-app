// Competiciones servidas por la API pública de ESPN (site.api.espn.com)
//
// `code` es el slug de ESPN y se mantiene como string: así COMPETITION_BY_CODE,
// MatchSuggestion.competitionCode y los value de los <select> no cambian de tipo.
//
// IMPORTANTE — `name` y `league` son claves ajenas de facto:
//   · `name`   se persiste en Event.competition y es la clave de COMPETITION_EMBLEM
//              en 13 ficheros de UI.
//   · `league` se persiste en Team.league y lo lee COMPETITION_LEAGUES para filtrar
//              el desplegable de equipos del formulario de evento.
// Cambiar cualquiera de los dos rompe la UI en silencio, sin lanzar ningún error.

export interface Competition {
  code: string; // Slug de ESPN, p.ej. "esp.1"
  name: string; // Nombre visible
  league: string; // Se corresponde con Team.league
  /**
   * Ruta LOCAL del emblema, servida desde public/. Es lo que renderiza la UI.
   * Vale también como nombre de fichero para scripts/download-crests.ts, que
   * escribe en `public${emblem}` — así la ruta que pinta el navegador y la que
   * genera el script no pueden desincronizarse.
   */
  emblem: string;
  /** URL remota de origen. Solo la lee el script de descarga. */
  emblemSource: string;
  /** Slug adicional para la fase previa (competiciones UEFA). */
  qualifyingCode?: string;
  /** Las ligas domésticas se sincronizan primero para que sus equipos reciban la liga correcta. */
  isDomestic: boolean;
}

export const COMPETITIONS: Competition[] = [
  {
    code: "uefa.champions",
    name: "Champions League",
    league: "Champions League",
    emblem: "/competiciones/champions-league.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
    qualifyingCode: "uefa.champions_qual",
    isDomestic: false,
  },
  {
    code: "uefa.europa",
    name: "Europa League",
    league: "Europa League",
    emblem: "/competiciones/europa-league.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/2310.png",
    qualifyingCode: "uefa.europa_qual",
    isDomestic: false,
  },
  {
    code: "uefa.europa.conf",
    name: "Conference League",
    league: "Conference League",
    emblem: "/competiciones/conference-league.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/20296.png",
    qualifyingCode: "uefa.europa.conf_qual",
    isDomestic: false,
  },
  {
    code: "esp.1",
    name: "La Liga",
    league: "La Liga",
    emblem: "/competiciones/la-liga.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png",
    isDomestic: true,
  },
  {
    code: "esp.2",
    name: "La Liga 2",
    league: "La Liga 2",
    emblem: "/competiciones/la-liga-2.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/107.png",
    isDomestic: true,
  },
  {
    code: "eng.1",
    name: "Premier League",
    league: "Premier League",
    emblem: "/competiciones/premier-league.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",
    isDomestic: true,
  },
  {
    code: "ita.1",
    name: "Serie A",
    league: "Serie A",
    emblem: "/competiciones/serie-a.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png",
    isDomestic: true,
  },
  {
    code: "ger.1",
    name: "Bundesliga",
    league: "Bundesliga",
    emblem: "/competiciones/bundesliga.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png",
    isDomestic: true,
  },
  {
    code: "fra.1",
    name: "Ligue 1",
    league: "Ligue 1",
    emblem: "/competiciones/ligue-1.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png",
    isDomestic: true,
  },
  {
    code: "por.1",
    name: "Primeira Liga",
    league: "Primeira Liga",
    emblem: "/competiciones/primeira-liga.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/14.png",
    isDomestic: true,
  },
  {
    code: "ned.1",
    name: "Eredivisie",
    league: "Eredivisie",
    emblem: "/competiciones/eredivisie.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/11.png",
    isDomestic: true,
  },
  {
    code: "esp.copa_del_rey",
    name: "Copa del Rey",
    league: "Copa del Rey",
    emblem: "/competiciones/copa-del-rey.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/80.png",
    isDomestic: false,
  },
  {
    code: "esp.super_cup",
    name: "Supercopa de España",
    league: "Supercopa de España",
    emblem: "/competiciones/supercopa-de-espana.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/431.png",
    isDomestic: false,
  },
  {
    code: "conmebol.america",
    name: "Copa América",
    league: "Copa América",
    emblem: "/competiciones/copa-america.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/83.png",
    isDomestic: false,
  },
  {
    code: "uefa.nations",
    name: "Nations League",
    league: "Nations League",
    emblem: "/competiciones/nations-league.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/2395.png",
    isDomestic: false,
  },
  {
    code: "fifa.world",
    name: "World Cup",
    league: "World Cup",
    emblem: "/competiciones/world-cup.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
    isDomestic: false,
  },
  {
    code: "uefa.euro",
    name: "European Championship",
    league: "European Championship",
    emblem: "/competiciones/european-championship.png",
    emblemSource: "https://a.espncdn.com/i/leaguelogos/soccer/500/74.png",
    isDomestic: false,
  },
];

// Nombres de competición para el desplegable
export const COMPETITION_NAMES = COMPETITIONS.map((c) => c.name);

// Mapa de código de competición a objeto Competition
export const COMPETITION_BY_CODE = Object.fromEntries(
  COMPETITIONS.map((c) => [c.code, c]),
) as Record<string, Competition>;

// Mapa de nombre visible a objeto Competition
export const COMPETITION_BY_NAME = Object.fromEntries(
  COMPETITIONS.map((c) => [c.name, c]),
) as Record<string, Competition>;

/**
 * Puente entre los nombres cortos de ESPN y los nombres oficiales que guardaba
 * el proveedor anterior, para los equipos que el emparejado automático no
 * reconoce por sí solo.
 *
 * Clave: nombre tal como lo devuelve ESPN. Valor: nombre tal como está en BD.
 *
 * Se hace con un mapa explícito, y no con emparejado difuso por nombre parcial,
 * porque este último se probó y emparejaba mal: el "Rangers" de ESPN (Glasgow)
 * se llevaba la ficha del "Queens Park Rangers". Un duplicado se detecta con
 * scripts/sync-verify.ts; un emparejado erróneo reasigna en silencio los
 * eventos históricos al equipo equivocado.
 *
 * Para ampliarlo: ejecutar `npx tsx scripts/sync-verify.ts report` tras el sync
 * y añadir aquí los equipos que aparezcan como huérfanos con eventos asociados.
 */
export const TEAM_NAME_ALIASES: Record<string, string> = {
  Lyon: "Olympique Lyonnais",
  Benfica: "Sport Lisboa e Benfica",
};

// Competiciones retiradas del sync que siguen apareciendo en eventos históricos.
// Sin estas entradas, esos eventos dejarían de mostrar su escudo.
export const LEGACY_COMPETITION_EMBLEM: Record<string, string> = {
  Championship: "/competiciones/championship.png",
  Brasileirão: "/competiciones/brasileirao.png",
};

// URLs remotas de origen de los emblemas retirados. Solo las lee
// scripts/download-crests.ts.
//
// Apuntaban al proveedor anterior (crests.football-data.org), pero al descargar
// se comprobó que la de Brasileirão ya devuelve 404: ese emblema llevaba roto en
// producción desde antes de esta migración. Se toman de ESPN, que sí sirve ambas
// competiciones aunque no estén en el sync (bra.1 → 85, eng.2 → 24).
export const LEGACY_COMPETITION_EMBLEM_SOURCE: Record<string, string> = {
  Championship: "https://a.espncdn.com/i/leaguelogos/soccer/500/24.png",
  Brasileirão: "https://a.espncdn.com/i/leaguelogos/soccer/500/85.png",
};

// Mapa de nombre visible a ruta del emblema (incluye las retiradas)
export const COMPETITION_EMBLEM = {
  ...LEGACY_COMPETITION_EMBLEM,
  ...Object.fromEntries(COMPETITIONS.map((c) => [c.name, c.emblem])),
} as Record<string, string>;

// Mapa de ruta local → URL remota de origen, para el script de descarga.
export const EMBLEM_SOURCES: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(LEGACY_COMPETITION_EMBLEM).map(([name, path]) => [
      path,
      LEGACY_COMPETITION_EMBLEM_SOURCE[name],
    ]),
  ),
  ...Object.fromEntries(COMPETITIONS.map((c) => [c.emblem, c.emblemSource])),
};

// ─── Deportes manuales (sin API — se crean a mano en el formulario) ────────────

export interface ManualSport {
  name: string;
  emoji: string;
  isMotorSport?: boolean; // Moto GP y Fórmula 1: un único campo "Gran Premio"
}

export const MANUAL_SPORTS: ManualSport[] = [
  { name: "Baloncesto", emoji: "🏀" },
  { name: "Rugby", emoji: "🏉" },
  { name: "Tenis", emoji: "🎾" },
  { name: "Moto GP", emoji: "🏍️", isMotorSport: true },
  { name: "Fórmula 1", emoji: "🏎️", isMotorSport: true },
  { name: "Billar", emoji: "🎱" },
  { name: "Dardos", emoji: "🎯" },
  { name: "Hockey", emoji: "🏒" },
  { name: "Ciclismo", emoji: "🚴" },
  { name: "Boxeo", emoji: "🥊" },
  { name: "Otros", emoji: "🏅" },
];

export const MANUAL_SPORT_NAMES = MANUAL_SPORTS.map((s) => s.name);

export const MANUAL_SPORT_BY_NAME = Object.fromEntries(
  MANUAL_SPORTS.map((s) => [s.name, s]),
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
// Filtra el desplegable de equipos del formulario de evento: para cada
// competición, qué valores de Team.league mostrar.

const DOMESTIC_LEAGUES = [
  "La Liga",
  "La Liga 2",
  "Premier League",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Primeira Liga",
  "Eredivisie",
];

export const COMPETITION_LEAGUES: Record<string, string[]> = {
  // Ligas domésticas: solo sus propios equipos
  "La Liga": ["La Liga"],
  "La Liga 2": ["La Liga 2"],
  "Premier League": ["Premier League"],
  "Serie A": ["Serie A"],
  Bundesliga: ["Bundesliga"],
  "Ligue 1": ["Ligue 1"],
  "Primeira Liga": ["Primeira Liga"],
  Eredivisie: ["Eredivisie"],

  // Competiciones UEFA de clubes: equipos de las ligas domésticas más los
  // clubes de ligas menores que solo entran en BD vía la propia competición.
  "Champions League": [...DOMESTIC_LEAGUES, "Champions League"],
  "Europa League": [...DOMESTIC_LEAGUES, "Europa League"],
  "Conference League": [...DOMESTIC_LEAGUES, "Conference League"],

  // Copas españolas: primera, segunda y los clubes de categorías inferiores
  // que ESPN devuelve en la plantilla de la propia copa.
  "Copa del Rey": ["La Liga", "La Liga 2", "Copa del Rey"],
  "Supercopa de España": ["La Liga", "La Liga 2", "Supercopa de España"],

  // Competiciones de selecciones: sus participantes son países, no clubes.
  "World Cup": ["World Cup"],
  "European Championship": ["European Championship"],
  "Copa América": ["Copa América"],
  "Nations League": ["Nations League"],

  // Retiradas del sync: se conservan para poder editar eventos históricos.
  Championship: ["Championship"],
  Brasileirão: ["Brasileirão"],
};
