"use client";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import Image from "next/image";
import type { EventWithTeams } from "../types";
import { TeamLogo } from "./team-logo";
import { COMPETITION_EMBLEM, getSportEmoji, isMotorSport } from "@/modules/football-data/config/competitions";

interface EventCardProps {
  event: EventWithTeams;
}

const screenColors: Record<string, string> = {
  PROYECTOR: "bg-[#D4AF37] text-black",
  TV1: "bg-[#b91c1c] text-white",
  TV2: "bg-[#3b82f6] text-white",
};

function getActiveScreens(event: EventWithTeams): string[] {
  if (!event.screens) return [];
  return event.screens.split(",").filter(Boolean);
}

export function EventCard({ event }: EventCardProps) {
  const eventDate = new Date(event.eventDate);
  const isUpcoming = event.status === "UPCOMING";
  const isLive = event.status === "LIVE";
  const activeScreens = getActiveScreens(event);

  const sportEmoji = getSportEmoji(event.competition);
  const isMotor = isMotorSport(event.competition);
  const homeName = event.homeTeam?.shortName ?? event.homeTeamName ?? "";
  const awayName = event.awayTeam?.shortName ?? event.awayTeamName ?? "";

  return (
    <Card className="overflow-hidden bg-card border-border hover:border-primary/50 transition-colors group">
      {/* Competition Badge */}
      <div className="px-4 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {event.competition && (
            <Badge variant="secondary" className="text-xs flex items-center gap-1.5">
              {sportEmoji ? (
                <span>{sportEmoji}</span>
              ) : COMPETITION_EMBLEM[event.competition] ? (
                <Image
                  src={COMPETITION_EMBLEM[event.competition]}
                  alt={event.competition}
                  width={16}
                  height={16}
                  className="object-contain"
                  unoptimized
                />
              ) : null}
              {event.competition}
            </Badge>
          )}
          {activeScreens.map((screen) => (
            <span
              key={screen}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${screenColors[screen]}`}
            >
              {screen}
            </span>
          ))}
        </div>
        {isLive && (
          <Badge className="bg-red-500 text-white animate-pulse">
            EN VIVO
          </Badge>
        )}
      </div>

      <CardContent className="p-4">
        {/* Teams */}
        <div className="flex items-center justify-between gap-4 py-4">
          {/* Home Team / GP name */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamLogo team={event.homeTeam} emoji={sportEmoji} size="lg" />
            <span className="text-sm font-medium text-center line-clamp-2">{homeName}</span>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-muted-foreground">VS</span>
          </div>

          {/* Away Team — empty for motor sports */}
          <div className="flex flex-col items-center gap-2 flex-1">
            {!isMotor && (
              <>
                <TeamLogo team={event.awayTeam} emoji={sportEmoji} size="lg" />
                <span className="text-sm font-medium text-center line-clamp-2">{awayName}</span>
              </>
            )}
          </div>
        </div>

        {/* Event Info */}
        <div className="space-y-2 pt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{format(eventDate, "EEEE, d 'de' MMMM", { locale: es })}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{format(eventDate, "HH:mm")} h</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>The Lounge Beerhouse</span>
          </div>
        </div>

        {/* Price */}
        <div className="mt-4 p-3 bg-secondary/50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-2">Precio por asiento</p>
          <p className="text-xl font-bold text-primary">
            {event.pricePerSeat.toFixed(2)}€
            <span className="text-sm font-normal text-muted-foreground"> /persona</span>
          </p>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button asChild className="w-full" disabled={!isUpcoming && !isLive}>
          <Link href={`/eventos/${event.id}`}>
            {isUpcoming || isLive ? "Reservar Asiento" : "Evento Finalizado"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
