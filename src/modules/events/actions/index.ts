"use server";

import prisma from "@/lib/prisma";
import type { EventWithTeams } from "../types";
import { isManualSport, isMotorSport } from "@/modules/football-data/config/competitions";

export async function getUpcomingEvents(): Promise<EventWithTeams[]> {
  const events = await prisma.event.findMany({
    where: {
      status: {
        in: ["UPCOMING", "LIVE"],
      },
      eventDate: {
        gte: new Date(),
      },
    },
    include: {
      homeTeam: true,
      awayTeam: true,
    },
    orderBy: {
      eventDate: "asc",
    },
  });

  return events as EventWithTeams[];
}

export async function getEventById(id: string): Promise<EventWithTeams | null> {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
    },
  });

  if (!event) return null;

  return event as EventWithTeams;
}

export async function getAllEvents(): Promise<EventWithTeams[]> {
  const events = await prisma.event.findMany({
    include: {
      homeTeam: true,
      awayTeam: true,
    },
    orderBy: {
      eventDate: "desc",
    },
  });

  return events as EventWithTeams[];
}

// Get all teams for selection
export async function getAllTeams() {
  const teams = await prisma.team.findMany({
    orderBy: {
      name: "asc",
    },
  });

  return teams;
}

// Create a new event
export async function createEvent(data: {
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  eventDate: Date;
  screens: string[];
  competition?: string;
  pricePerSeat?: number;
  durationMinutes?: number;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    let title: string;
    let homeTeamIdFinal: string | null = null;
    let awayTeamIdFinal: string | null = null;
    let homeTeamNameFinal: string | null = null;
    let awayTeamNameFinal: string | null = null;

    if (isManualSport(data.competition)) {
      // Deporte manual: sin equipos en BD
      if (isMotorSport(data.competition)) {
        const gpName = data.homeTeamName?.trim() || "";
        title = gpName || data.competition || "Gran Premio";
        homeTeamNameFinal = gpName || null;
      } else {
        const home = data.homeTeamName?.trim() || "";
        const away = data.awayTeamName?.trim() || "";
        title = `${home} vs ${away}`;
        homeTeamNameFinal = home || null;
        awayTeamNameFinal = away || null;
      }
    } else {
      // Fútbol: buscar equipos en BD
      const homeTeam = await prisma.team.findUnique({ where: { id: data.homeTeamId! } });
      const awayTeam = await prisma.team.findUnique({ where: { id: data.awayTeamId! } });

      if (!homeTeam || !awayTeam) {
        return { success: false, error: "Equipo no encontrado" };
      }

      title = `${homeTeam.shortName} vs ${awayTeam.shortName}`;
      homeTeamIdFinal = data.homeTeamId!;
      awayTeamIdFinal = data.awayTeamId!;
    }

    const event = await prisma.event.create({
      data: {
        title,
        homeTeamId: homeTeamIdFinal,
        awayTeamId: awayTeamIdFinal,
        homeTeamName: homeTeamNameFinal,
        awayTeamName: awayTeamNameFinal,
        eventDate: data.eventDate,
        competition: data.competition || "Liga",
        screens: data.screens.join(","),
        status: "UPCOMING",
        pricePerSeat: data.pricePerSeat ?? 10,
        durationMinutes: data.durationMinutes ?? 120,
      },
    });

    // Initialize seat statuses for this event
    const seats = await prisma.seat.findMany();
    await prisma.seatStatus.createMany({
      data: seats.map((seat) => ({
        eventId: event.id,
        seatId: seat.id,
        status: "AVAILABLE" as const,
      })),
    });

    return { success: true, eventId: event.id };
  } catch (error) {
    console.error("Error creating event:", error);
    return { success: false, error: "Error al crear el evento" };
  }
}

// Update an existing event
export async function updateEvent(
  id: string,
  data: {
    homeTeamId?: string;
    awayTeamId?: string;
    homeTeamName?: string;
    awayTeamName?: string;
    eventDate: Date;
    screens: string[];
    competition?: string;
    pricePerSeat?: number;
    durationMinutes?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    let title: string;
    let homeTeamIdFinal: string | null = null;
    let awayTeamIdFinal: string | null = null;
    let homeTeamNameFinal: string | null = null;
    let awayTeamNameFinal: string | null = null;

    if (isManualSport(data.competition)) {
      // Deporte manual
      if (isMotorSport(data.competition)) {
        const gpName = data.homeTeamName?.trim() || "";
        title = gpName || data.competition || "Gran Premio";
        homeTeamNameFinal = gpName || null;
      } else {
        const home = data.homeTeamName?.trim() || "";
        const away = data.awayTeamName?.trim() || "";
        title = `${home} vs ${away}`;
        homeTeamNameFinal = home || null;
        awayTeamNameFinal = away || null;
      }
    } else {
      // Fútbol
      const homeTeam = await prisma.team.findUnique({ where: { id: data.homeTeamId! } });
      const awayTeam = await prisma.team.findUnique({ where: { id: data.awayTeamId! } });

      if (!homeTeam || !awayTeam) {
        return { success: false, error: "Equipo no encontrado" };
      }

      title = `${homeTeam.shortName} vs ${awayTeam.shortName}`;
      homeTeamIdFinal = data.homeTeamId!;
      awayTeamIdFinal = data.awayTeamId!;
    }

    await prisma.event.update({
      where: { id },
      data: {
        title,
        homeTeamId: homeTeamIdFinal,
        awayTeamId: awayTeamIdFinal,
        homeTeamName: homeTeamNameFinal,
        awayTeamName: awayTeamNameFinal,
        eventDate: data.eventDate,
        competition: data.competition || "Liga",
        screens: data.screens.join(","),
        pricePerSeat: data.pricePerSeat ?? 10,
        durationMinutes: data.durationMinutes ?? 120,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating event:", error);
    return { success: false, error: "Error al actualizar el evento" };
  }
}

// Delete an event
export async function deleteEvent(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    // First delete related seat statuses
    await prisma.seatStatus.deleteMany({
      where: { eventId: id },
    });

    // Then delete the event
    await prisma.event.delete({
      where: { id },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting event:", error);
    return { success: false, error: "Error al eliminar el evento" };
  }
}
