// Tipos de la API pública de ESPN (site.api.espn.com)
//
// Se usa el endpoint `scoreboard` para partidos y `teams` para plantillas.
// No requiere clave ni tiene cuota diaria.
//
// Aviso: es una API no documentada (la que alimenta la web de ESPN). Todos los
// campos se tratan como opcionales al mapear, porque no hay contrato que los
// garantice. Ver MIGRACION_API_FUTBOL.md §2.

/** Todos los identificadores de ESPN llegan como string; se convierten con parseInt. */
export interface EspnTeam {
  id: string;
  displayName: string;
  shortDisplayName?: string;
  abbreviation?: string;
  logo?: string;
  logos?: Array<{ href: string }>;
}

export interface EspnCompetitor {
  homeAway: "home" | "away";
  team: EspnTeam;
}

export interface EspnEvent {
  id: string;
  date: string; // ISO, p.ej. "2026-08-15T17:30Z"
  name?: string;
  shortName?: string;
  status?: {
    type?: {
      name?: string; // STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_FINAL…
      state?: string; // "pre" | "in" | "post"
      completed?: boolean;
    };
  };
  competitions: Array<{
    id: string;
    competitors: EspnCompetitor[];
  }>;
}

export interface EspnLeagueInfo {
  id: string;
  name: string;
  abbreviation?: string;
  slug: string;
  logos?: Array<{ href: string }>;
  season?: { year: number; displayName?: string };
}

/** Respuesta de GET /{slug}/scoreboard */
export interface EspnScoreboardResponse {
  leagues?: EspnLeagueInfo[];
  events?: EspnEvent[];
  /** ESPN devuelve `{ "code": 404 }` cuando el slug no existe. */
  code?: number;
}

/** Respuesta de GET /{slug}/teams */
export interface EspnTeamsResponse {
  sports?: Array<{
    leagues?: Array<{
      teams?: Array<{ team: EspnTeam }>;
    }>;
  }>;
  code?: number;
}

// ─── Tipos internos ────────────────────────────────────────────────────────
// Estos dos son la costura estable del módulo: los consume la página de
// sugerencias. No cambiar su forma sin revisar
// src/app/admin/(dashboard)/eventos/sugerencias/client.tsx

export interface SyncResult {
  created: number;
  updated: number;
  /** Equipos que ya estaban al día y no generaron escritura. */
  skipped: number;
  errors: string[];
}

export interface MatchSuggestion {
  externalMatchId: number;
  competition: string;
  competitionCode: string;
  homeTeam: {
    externalId: number;
    name: string;
    shortName: string;
    crest: string;
    dbTeamId: string | null; // null si el equipo no está en BD
  };
  awayTeam: {
    externalId: number;
    name: string;
    shortName: string;
    crest: string;
    dbTeamId: string | null;
  };
  utcDate: string;
  /** ESPN no expone número de jornada; siempre null. Se conserva por compatibilidad. */
  matchday: number | null;
  canCreate: boolean; // true si ambos equipos existen en BD
}
