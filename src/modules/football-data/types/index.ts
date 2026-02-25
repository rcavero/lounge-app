// football-data.org API v4 response types

export interface ApiTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string; // Three-Letter Abbreviation
  crest: string; // URL to team crest/logo
}

export interface ApiCompetitionTeamsResponse {
  competition: {
    id: number;
    name: string;
    code: string;
  };
  teams: ApiTeam[];
}

export interface ApiMatch {
  id: number;
  competition: {
    id: number;
    name: string;
    code: string;
    emblem: string;
  };
  utcDate: string; // ISO date string
  status: string; // SCHEDULED, TIMED, IN_PLAY, FINISHED, etc.
  matchday: number | null;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
}

export interface ApiMatchesResponse {
  matches: ApiMatch[];
}

// Internal types

export interface SyncResult {
  created: number;
  updated: number;
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
    dbTeamId: string | null; // null if team not in DB
  };
  awayTeam: {
    externalId: number;
    name: string;
    shortName: string;
    crest: string;
    dbTeamId: string | null;
  };
  utcDate: string;
  matchday: number | null;
  canCreate: boolean; // true if both teams exist in DB
}
