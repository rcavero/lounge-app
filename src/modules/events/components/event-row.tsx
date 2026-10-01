"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, Lock } from "lucide-react";
import type { EventWithTeams } from "../types";
import { TeamLogo } from "./team-logo";
import { CompetitionEmblem } from "./competition-emblem";
import { getSportEmoji, isMotorSport } from "@/modules/football-data/config/competitions";
import { LinkPendingIndicator, PRESSABLE } from "@/shared/components/link-pending";
import { useIsSpanish } from "@/shared/hooks/use-is-spanish";
import { bookingWindowReason } from "../domain/booking-window";
import { BOOKING_CLOSED_MESSAGES } from "./booking-messages";

interface EventRowProps {
  event: EventWithTeams;
  href?: string;
  checkAvailability?: boolean;
}

function getActiveScreens(event: EventWithTeams): string[] {
  if (!event.screens) return [];
  return event.screens.split(",").filter(Boolean);
}

const screenColors: Record<string, string> = {
  TV3: "bg-[#D4AF37] text-black",
  TV1: "bg-[#b91c1c] text-white",
  TV2: "bg-[#3b82f6] text-white",
};

export function EventRow({ event, href, checkAvailability = false }: EventRowProps) {
  const eventDate = new Date(event.eventDate);
  const activeScreens = getActiveScreens(event);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const isSpanish = useIsSpanish();
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * El reloj se lee UNA vez, al montar, y no en cada render: `Date.now()` en el cuerpo
   * del componente es impuro (`react-hooks/purity`), y dos renders podían decidir
   * distinto si el evento está en ventana. Con el inicializador perezoso de `useState`,
   * lo que se ve al abrir la portada no cambia hasta recargarla.
   */
  const [now] = useState(() => Date.now());

  useEffect(() => {
    return () => {
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    };
  }, []);

  // Format: "Mié 15 Ene"
  const dayName = format(eventDate, "EEE", { locale: es });
  const dayNumber = format(eventDate, "d");
  const monthName = format(eventDate, "MMM", { locale: es });
  const time = format(eventDate, "HH:mm");
  const formattedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // La misma regla que aplican la página del evento y el servidor (RCA-277).
  const closedReason = checkAvailability
    ? bookingWindowReason(eventDate, new Date(now))
    : null;
  const isLocked = closedReason !== null;

  const handleLockedClick = () => {
    if (!closedReason) return;
    setTooltip(BOOKING_CLOSED_MESSAGES[isSpanish ? "es" : "en"][closedReason]);
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => setTooltip(null), 3000);
  };

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

  const cardContent = (
    <div
      className={`bg-[#1a1a1a] rounded-2xl px-4 py-4 flex items-center justify-between transition-colors relative
        ${isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-[#222]"}`}
    >
      <CompetitionEmblem
        competition={event.competition}
        className="absolute top-2 left-2"
      />
      {closedReason === "too-early" && (
        <Clock className="absolute top-2 right-2 w-3.5 h-3.5 text-white/40" />
      )}
      {closedReason === "too-late" && (
        <Lock className="absolute top-2 right-2 w-3.5 h-3.5 text-white/40" />
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

      {/* Tooltip */}
      {tooltip && (
        <div className="absolute inset-0 flex items-center justify-center z-10 rounded-2xl">
          <div
            data-testid="event-row-tooltip"
            className="bg-[#111] text-white text-xs rounded-lg px-4 py-2.5 text-center max-w-[85%] shadow-xl"
          >
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );

  if (isLocked) {
    return (
      <div
        data-testid="event-row"
        data-event-id={event.id}
        data-locked="true"
        className="relative"
        onClick={handleLockedClick}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      data-testid="event-row"
      data-event-id={event.id}
      data-locked="false"
      href={href || `/eventos/${event.id}`}
      className={`block relative ${PRESSABLE}`}
    >
      {cardContent}
      <LinkPendingIndicator />
    </Link>
  );
}
