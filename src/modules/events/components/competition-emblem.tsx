"use client";

import Image from "next/image";
import { getSportEmoji, COMPETITION_EMBLEM } from "@/modules/football-data/config/competitions";

interface CompetitionEmblemProps {
  competition: string | null | undefined;
  className?: string;
}

export function CompetitionEmblem({ competition, className = "" }: CompetitionEmblemProps) {
  // Manual sport → emoji dentro del mismo círculo blanco que los escudos de fútbol
  const emoji = getSportEmoji(competition);
  if (emoji) {
    return (
      <div className={`bg-white/90 rounded-full p-1 w-7 h-7 flex items-center justify-center ${className}`}>
        <span className="text-sm leading-none">{emoji}</span>
      </div>
    );
  }

  // Football → render emblem image (existing behavior)
  if (!competition || !COMPETITION_EMBLEM[competition]) return null;

  return (
    <div className={`bg-white/90 rounded-full p-1 w-7 h-7 flex items-center justify-center ${className}`}>
      <Image
        src={COMPETITION_EMBLEM[competition]}
        alt={competition}
        width={20}
        height={20}
        className="w-full h-full object-contain"
        unoptimized
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    </div>
  );
}
