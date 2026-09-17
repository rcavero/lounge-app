"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { getScheduledMatches } from "../lib/api-client";
import { syncTeams, slugify } from "../lib/team-sync";
import { toSuggestion } from "../lib/suggestions";
import { COMPETITIONS, COMPETITION_BY_CODE } from "../config/competitions";
import type { SyncResult, MatchSuggestion } from "../types";

/**
 * Sincroniza los equipos desde la API externa.
 *
 * Envuelve el núcleo de lib/team-sync añadiendo la comprobación de sesión. El
 * cron NO usa esta función: se autentica con CRON_SECRET y llama a syncTeams()
 * directamente, porque no tiene sesión de usuario.
 */
export async function syncTeamsFromAPI(): Promise<SyncResult> {
  await requireAuth();
  return syncTeams();
}

/**
 * Sugerencias de partidos de una competición, o de todas si no se indica ninguna.
 *
 * ESPN no impone cuota ni límite por minuto, así que las competiciones se piden
 * en paralelo: las 17 (más sus fases previas) tardan ~1 s en total.
 */
export async function getMatchSuggestions(
  competitionCode?: string
): Promise<MatchSuggestion[]> {
  await requireAuth();

  const competitions = competitionCode
    ? [COMPETITION_BY_CODE[competitionCode]].filter(Boolean)
    : COMPETITIONS;

  // Mapa externalId -> Team.id para marcar qué equipos ya están en BD.
  const dbTeams = await prisma.team.findMany({
    where: { externalId: { not: null } },
    select: { id: true, externalId: true },
  });
  const teamMap = new Map(dbTeams.map((t) => [t.externalId!, t.id]));

  // Cada competición puede tener además un slug de fase previa (UEFA).
  const fetches = competitions.flatMap((competition) => {
    const codes = [competition.code];
    if (competition.qualifyingCode) codes.push(competition.qualifyingCode);
    return codes.map(async (code) => {
      const response = await getScheduledMatches(code);
      return { competition, events: response?.events ?? [] };
    });
  });

  const settled = await Promise.allSettled(fetches);

  const suggestions: MatchSuggestion[] = [];
  const seen = new Set<number>();
  let rejected = 0;

  for (const outcome of settled) {
    if (outcome.status === "rejected") {
      rejected++;
      console.error("[suggestions] Error al obtener partidos:", outcome.reason);
      continue;
    }
    const { competition, events } = outcome.value;
    for (const event of events) {
      const suggestion = toSuggestion(event, competition, teamMap);
      // Un mismo partido puede aparecer en la fase principal y en la previa.
      if (suggestion && !seen.has(suggestion.externalMatchId)) {
        seen.add(suggestion.externalMatchId);
        suggestions.push(suggestion);
      }
    }
  }

  // Si no respondió NI UNA, es una caída de ESPN, no una semana sin partidos:
  // hay que lanzar. Devolver [] pinta el estado vacío "Buscar partidos
  // programados", indistinguible de "no hay nada esta semana" — que es
  // exactamente cómo se manifestó el 400 de ESPN del 17/09/2026. El catch de
  // client.tsx ya muestra el banner de error.
  if (rejected > 0 && rejected === settled.length) {
    throw new Error(
      `ESPN no respondió a ninguna de las ${settled.length} peticiones`
    );
  }

  // Orden de competición según el array de configuración, luego por fecha.
  const order = new Map(COMPETITIONS.map((c, i) => [c.code, i]));
  suggestions.sort((a, b) => {
    const orderA = order.get(a.competitionCode) ?? 999;
    const orderB = order.get(b.competitionCode) ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime();
  });

  return suggestions;
}

/**
 * Garantiza que el equipo existe en BD y devuelve su Team.id.
 * Los datos vienen de la propia sugerencia, así que no hace falta llamar a la API.
 */
async function ensureTeam(
  team: MatchSuggestion["homeTeam"],
  league: string
): Promise<string> {
  if (team.dbTeamId) {
    const existing = await prisma.team.findUnique({ where: { id: team.dbTeamId } });
    if (existing) return existing.id;
  }

  const byExternalId = await prisma.team.findUnique({
    where: { externalId: team.externalId },
  });
  if (byExternalId) return byExternalId.id;

  const slug = slugify(team.shortName) || `team-${team.externalId}`;
  const slugTaken = await prisma.team.findUnique({ where: { id: slug } });

  const created = await prisma.team.create({
    data: {
      id: slugTaken ? `${slug}-${team.externalId}` : slug,
      externalId: team.externalId,
      name: team.name,
      shortName: team.shortName,
      league,
      // Sin copia local todavía: apunta a ESPN hasta que se ejecute
      // scripts/download-crests.ts. logoSource guarda siempre la procedencia.
      logo: team.crest || null,
      logoSource: team.crest || null,
    },
  });
  return created.id;
}

/**
 * Crea un evento a partir de una sugerencia.
 *
 * Es idempotente: Event.externalMatchId es único, así que intentar crear dos
 * veces el mismo partido devuelve un error legible en lugar de duplicarlo.
 */
export async function createEventFromSuggestion(
  suggestion: MatchSuggestion,
  screens: string[]
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  await requireAuth();

  try {
    const existing = await prisma.event.findUnique({
      where: { externalMatchId: suggestion.externalMatchId },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: "Este partido ya tiene un evento creado" };
    }

    const league = suggestion.competition;
    const homeTeamId = await ensureTeam(suggestion.homeTeam, league);
    const awayTeamId = await ensureTeam(suggestion.awayTeam, league);

    const [homeTeam, awayTeam] = await Promise.all([
      prisma.team.findUnique({ where: { id: homeTeamId } }),
      prisma.team.findUnique({ where: { id: awayTeamId } }),
    ]);

    if (!homeTeam || !awayTeam) {
      return { success: false, error: "Equipo no encontrado en la base de datos" };
    }

    const seats = await prisma.seat.findMany({ select: { id: true } });

    // Evento y asientos en una sola transacción: sin ella, un fallo al crear los
    // SeatStatus dejaría un evento sin asientos y por tanto no reservable.
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          title: `${homeTeam.shortName} vs ${awayTeam.shortName}`,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          eventDate: new Date(suggestion.utcDate),
          competition: suggestion.competition,
          externalMatchId: suggestion.externalMatchId,
          screens: screens.join(","),
          status: "UPCOMING",
        },
      });

      if (seats.length > 0) {
        await tx.seatStatus.createMany({
          data: seats.map((seat) => ({
            eventId: created.id,
            seatId: seat.id,
            status: "AVAILABLE" as const,
          })),
        });
      }

      return created;
    });

    return { success: true, eventId: event.id };
  } catch (error) {
    // P2002 = violación de índice único; aquí solo puede ser externalMatchId,
    // por una doble creación simultánea.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return { success: false, error: "Este partido ya tiene un evento creado" };
    }
    console.error("Error al crear el evento desde la sugerencia:", error);
    return { success: false, error: "Error al crear el evento" };
  }
}
