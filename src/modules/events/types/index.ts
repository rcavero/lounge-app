import type { Event, Team, EventStatus } from "@/generated/prisma";

export type { Team, EventStatus };

// Precio fijo por asiento (10€)
export const SEAT_PRICE = 10;

// Event type with team relations (nullable for manual/non-football sports)
export interface EventWithTeams extends Event {
  homeTeam: Team | null;
  awayTeam: Team | null;
}

export interface EventCardProps {
  event: EventWithTeams;
}
