"use server";

import prisma from "@/lib/prisma";
import { getCompetitionTeams, getScheduledMatches } from "../lib/api-client";
import { COMPETITIONS, COMPETITION_BY_CODE } from "../config/competitions";
import type { SyncResult, MatchSuggestion } from "../types";

/**
 * Sync teams from football-data.org API into the database.
 * Iterates through all free-tier competitions and upserts each team by externalId.
 */
export async function syncTeamsFromAPI(): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, errors: [] };

  // Sync all competitions except CL (Champions League teams already come from their leagues)
  const syncCompetitions = COMPETITIONS.filter(
    (c) => c.code !== "CL"
  );

  for (const competition of syncCompetitions) {
    try {
      console.log(`[sync] Fetching teams for ${competition.name} (${competition.code})`);
      const response = await getCompetitionTeams(competition.code);

      for (const apiTeam of response.teams) {
        try {
          // 1. Try to find by externalId (already synced before)
          const existingByExtId = await prisma.team.findUnique({
            where: { externalId: apiTeam.id },
          });

          if (existingByExtId) {
            await prisma.team.update({
              where: { externalId: apiTeam.id },
              data: {
                name: apiTeam.name,
                shortName: apiTeam.shortName || apiTeam.tla,
                logo: apiTeam.crest || existingByExtId.logo,
              },
            });
            result.updated++;
            continue;
          }

          // 2. Try to match existing seed team by slug ID
          const slug = (apiTeam.shortName || apiTeam.tla)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");

          const existingBySlug = await prisma.team.findUnique({
            where: { id: slug },
          });

          if (existingBySlug) {
            // Link seed team to API by setting externalId
            await prisma.team.update({
              where: { id: slug },
              data: {
                externalId: apiTeam.id,
                name: apiTeam.name,
                shortName: apiTeam.shortName || existingBySlug.shortName,
                logo: apiTeam.crest || existingBySlug.logo,
              },
            });
            result.updated++;
            continue;
          }

          // 3. Team doesn't exist at all — create new
          await prisma.team.create({
            data: {
              id: slug,
              externalId: apiTeam.id,
              name: apiTeam.name,
              shortName: apiTeam.shortName || apiTeam.tla,
              league: competition.league,
              logo: apiTeam.crest || null,
            },
          });
          result.created++;
        } catch (teamError) {
          const msg = `Error syncing team ${apiTeam.name}: ${teamError}`;
          console.error(`[sync] ${msg}`);
          result.errors.push(msg);
        }
      }
    } catch (compError) {
      const msg = `Error fetching ${competition.name}: ${compError}`;
      console.error(`[sync] ${msg}`);
      result.errors.push(msg);
    }
  }

  console.log(
    `[sync] Done. Created: ${result.created}, Updated: ${result.updated}, Errors: ${result.errors.length}`
  );
  return result;
}

/**
 * Get match suggestions from the API for a specific competition or all competitions.
 * Maps teams to existing DB records.
 */
export async function getMatchSuggestions(
  competitionCode?: string
): Promise<MatchSuggestion[]> {
  const codes = competitionCode
    ? [competitionCode]
    : COMPETITIONS.map((c) => c.code);

  // Build a map of externalId -> dbTeamId for quick lookup
  const dbTeams = await prisma.team.findMany({
    where: { externalId: { not: null } },
    select: { id: true, externalId: true },
  });
  const teamMap = new Map(
    dbTeams.map((t) => [t.externalId!, t.id])
  );

  const suggestions: MatchSuggestion[] = [];

  for (const code of codes) {
    try {
      const competition = COMPETITION_BY_CODE[code];
      if (!competition) continue;

      console.log(`[suggestions] Fetching matches for ${competition.name}`);
      const response = await getScheduledMatches(code);

      for (const match of response.matches) {
        const homeDbId = teamMap.get(match.homeTeam.id) ?? null;
        const awayDbId = teamMap.get(match.awayTeam.id) ?? null;

        suggestions.push({
          externalMatchId: match.id,
          competition: competition.name,
          competitionCode: code,
          homeTeam: {
            externalId: match.homeTeam.id,
            name: match.homeTeam.name,
            shortName: match.homeTeam.shortName,
            crest: match.homeTeam.crest,
            dbTeamId: homeDbId,
          },
          awayTeam: {
            externalId: match.awayTeam.id,
            name: match.awayTeam.name,
            shortName: match.awayTeam.shortName,
            crest: match.awayTeam.crest,
            dbTeamId: awayDbId,
          },
          utcDate: match.utcDate,
          matchday: match.matchday,
          canCreate: homeDbId !== null && awayDbId !== null,
        });
      }
    } catch (error) {
      console.error(`[suggestions] Error fetching matches for ${code}:`, error);
    }
  }

  // Sort by competition order first, then by date within each competition
  const competitionOrder = new Map(COMPETITIONS.map((c, i) => [c.code, i]));
  suggestions.sort((a, b) => {
    const orderA = competitionOrder.get(a.competitionCode) ?? 999;
    const orderB = competitionOrder.get(b.competitionCode) ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime();
  });

  return suggestions;
}

/**
 * Create an event from a match suggestion.
 * Reuses the same logic as createEvent from the events module.
 */
export async function createEventFromSuggestion(
  suggestion: MatchSuggestion,
  screens: string[]
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    if (!suggestion.homeTeam.dbTeamId || !suggestion.awayTeam.dbTeamId) {
      return {
        success: false,
        error: "Ambos equipos deben estar sincronizados en la base de datos",
      };
    }

    const homeTeam = await prisma.team.findUnique({
      where: { id: suggestion.homeTeam.dbTeamId },
    });
    const awayTeam = await prisma.team.findUnique({
      where: { id: suggestion.awayTeam.dbTeamId },
    });

    if (!homeTeam || !awayTeam) {
      return { success: false, error: "Equipo no encontrado en la base de datos" };
    }

    const event = await prisma.event.create({
      data: {
        title: `${homeTeam.shortName} vs ${awayTeam.shortName}`,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        eventDate: new Date(suggestion.utcDate),
        competition: suggestion.competition,
        screens: screens.join(","),
        status: "UPCOMING",
      },
    });

    // Initialize seat statuses for this event
    const seats = await prisma.seat.findMany();
    if (seats.length > 0) {
      await prisma.seatStatus.createMany({
        data: seats.map((seat) => ({
          eventId: event.id,
          seatId: seat.id,
          status: "AVAILABLE" as const,
        })),
      });
    }

    return { success: true, eventId: event.id };
  } catch (error) {
    console.error("Error creating event from suggestion:", error);
    return { success: false, error: "Error al crear el evento" };
  }
}
