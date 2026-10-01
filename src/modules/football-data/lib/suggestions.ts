// Mapeo de eventos de ESPN al tipo MatchSuggestion que consume la UI.
//
// Vive fuera de actions/index.ts para poder probarse de forma aislada contra la
// API real sin necesidad de base de datos ni de sesión
// (ver scripts/espn-smoke-test.ts).

import { getTeamLogo } from "./api-client";
import { toIntId, teamShortName } from "./team-sync";
import type { Competition } from "../config/competitions";
import type { MatchSuggestion, EspnEvent } from "../types";

/**
 * Convierte un evento de ESPN en MatchSuggestion.
 * Devuelve null si el partido ya empezó o si le faltan datos imprescindibles:
 * al ser una API no documentada, ningún campo está garantizado por contrato.
 *
 * @param teamMap externalId -> Team.id, para marcar qué equipos ya están en BD
 */
export function toSuggestion(
  event: EspnEvent,
  competition: Competition,
  teamMap: Map<number, string>,
): MatchSuggestion | null {
  // Solo partidos aún no jugados.
  if (event.status?.type?.state !== "pre") return null;

  const competitors = event.competitions?.[0]?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const externalMatchId = toIntId(event.id);
  const homeId = toIntId(home.team.id);
  const awayId = toIntId(away.team.id);
  if (externalMatchId === null || homeId === null || awayId === null) return null;

  const utcDate = new Date(event.date);
  if (Number.isNaN(utcDate.getTime())) return null;

  return {
    externalMatchId,
    competition: competition.name,
    competitionCode: competition.code,
    homeTeam: {
      externalId: homeId,
      name: home.team.displayName,
      shortName: teamShortName(home.team),
      crest: getTeamLogo(home.team) ?? "",
      dbTeamId: teamMap.get(homeId) ?? null,
    },
    awayTeam: {
      externalId: awayId,
      name: away.team.displayName,
      shortName: teamShortName(away.team),
      crest: getTeamLogo(away.team) ?? "",
      dbTeamId: teamMap.get(awayId) ?? null,
    },
    utcDate: utcDate.toISOString(),
    matchday: null, // ESPN no expone número de jornada
    canCreate: true, // los equipos que falten se crean al vuelo
  };
}
