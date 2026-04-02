"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { EventWithReservationCount } from "@/modules/reservations/actions";
import { TeamLogo } from "./team-logo";
import { CompetitionEmblem } from "./competition-emblem";
import { getSportEmoji, isMotorSport } from "@/modules/football-data/config/competitions";

interface EventRowWithBadgeProps {
  event: EventWithReservationCount;
  href?: string;
}

// Get all active screens from event.screens field
function getActiveScreens(event: EventWithReservationCount): string[] {
  if (!event.screens) return [];
  return event.screens.split(",").filter(Boolean);
}

const screenColors: Record<string, string> = {
  PROYECTOR: "bg-[#D4AF37] text-black",
  TV1: "bg-[#b91c1c] text-white",
  TV2: "bg-[#3b82f6] text-white",
};

export function EventRowWithBadge({ event, href }: EventRowWithBadgeProps) {
  const eventDate = new Date(event.eventDate);
  const activeScreens = getActiveScreens(event);
  const reservationCount = event._count.reservations;

  // Format: "Mié 15 Ene"
  const dayName = format(eventDate, "EEE", { locale: es });
  const dayNumber = format(eventDate, "d");
  const monthName = format(eventDate, "MMM", { locale: es });
  const time = format(eventDate, "HH:mm");

  // Capitalize first letter
  const formattedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // Manual sport helpers
  const sportEmoji = getSportEmoji(event.competition);
  const isMotor = isMotorSport(event.competition);
  const homeName = event.homeTeam?.shortName ?? event.homeTeamName ?? "";
  const awayName = event.awayTeam?.shortName ?? event.awayTeamName ?? "";

  const centerSection = (
    <div className="flex flex-col items-center flex-1 px-2">
      <span className="text-white/80 text-xs font-medium">
        {formattedDay} {dayNumber} {formattedMonth}
      </span>
      <span className="text-white text-2xl font-bold">{time}</span>
      <div className="flex gap-1 mt-1 flex-wrap justify-center">
        {activeScreens.map((screen) => (
          <span
            key={screen}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${screenColors[screen]}`}
          >
            {screen}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <Link href={href || `/admin/reservas/${event.id}`} className="block">
      <div className="relative bg-[#1a1a1a] rounded-2xl px-4 py-4 flex items-center justify-between hover:bg-[#222] transition-colors">
        {/* Competition emblem */}
        <CompetitionEmblem competition={event.competition} className="absolute top-2 left-2" />
        {/* Reservation count badge */}
        {reservationCount > 0 && (
          <div className="absolute -top-2 -right-2 bg-[#D4AF37] text-black text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center z-10">
            {reservationCount}
          </div>
        )}

        {/* Home Team / GP name */}
        <div className="flex flex-col items-center w-20">
          <TeamLogo team={event.homeTeam} emoji={sportEmoji} size="lg" />
          <span className="text-[10px] text-white/70 mt-1 text-center line-clamp-1">
            {homeName}
          </span>
        </div>

        {centerSection}

        {/* Away Team — empty for motor sports */}
        <div className="flex flex-col items-center w-20">
          {!isMotor && (
            <>
              <TeamLogo team={event.awayTeam} emoji={sportEmoji} size="lg" />
              <span className="text-[10px] text-white/70 mt-1 text-center line-clamp-1">
                {awayName}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
