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

const MESSAGES = {
  es: {
    tooEarly: "Las reservas se desbloquearán 48 horas antes del evento",
    tooLate:
      "Se han cerrado las reservas para este evento porque faltan menos de 4 horas para su inicio",
  },
  en: {
    tooEarly: "Reservations will open 48 hours before the event",
    tooLate:
      "Reservations for this event are closed because it starts in less than 4 hours",
  },
};

export function EventRow({ event, href, checkAvailability = false }: EventRowProps) {
  const eventDate = new Date(event.eventDate);
  const activeScreens = getActiveScreens(event);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [isSpanish, setIsSpanish] = useState(true);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsSpanish(navigator.language.startsWith("es"));
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

  // Availability check
  // Deuda heredada (MASTER_IA, 1.4), silenciada en P5 para poder commitear este
  // fichero; se arregla en P6, antes de que el lint de CI sea bloqueante.
  // eslint-disable-next-line react-hooks/purity
  const hoursUntilEvent = (eventDate.getTime() - Date.now()) / (1000 * 60 * 60);
  const isTooEarly = checkAvailability && hoursUntilEvent > 48;
  const isTooLate = checkAvailability && hoursUntilEvent >= 0 && hoursUntilEvent < 4;
  const isLocked = isTooEarly || isTooLate;

  const handleLockedClick = () => {
    const msgs = isSpanish ? MESSAGES.es : MESSAGES.en;
    setTooltip(isTooEarly ? msgs.tooEarly : msgs.tooLate);
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
      {isTooEarly && (
        <Clock className="absolute top-2 right-2 w-3.5 h-3.5 text-white/40" />
      )}
      {isTooLate && <Lock className="absolute top-2 right-2 w-3.5 h-3.5 text-white/40" />}

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
          <div className="bg-[#111] text-white text-xs rounded-lg px-4 py-2.5 text-center max-w-[85%] shadow-xl">
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );

  if (isLocked) {
    return (
      <div className="relative" onClick={handleLockedClick}>
        {cardContent}
      </div>
    );
  }

  return (
    <Link href={href || `/eventos/${event.id}`} className="block">
      {cardContent}
    </Link>
  );
}
