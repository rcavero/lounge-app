"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import type { Team } from "../types";

interface TeamLogoProps {
  team: Team;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-14 h-14",
};

const sizePx = {
  sm: 32,
  md: 48,
  lg: 56,
};

// Team logo URLs mapping (Wikimedia Commons)
const TEAM_LOGOS: Record<string, string> = {
  // La Liga
  "real-madrid": "https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg",
  "barcelona": "https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg",
  "atletico-madrid": "https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg",
  "athletic-bilbao": "https://upload.wikimedia.org/wikipedia/en/9/98/Club_Athletic_Bilbao_logo.svg",
  "real-sociedad": "https://upload.wikimedia.org/wikipedia/en/f/f1/Real_Sociedad_logo.svg",
  "real-betis": "https://upload.wikimedia.org/wikipedia/en/1/13/Real_betis_logo.svg",
  "villarreal": "https://upload.wikimedia.org/wikipedia/en/7/70/Villarreal_CF_logo.svg",
  "sevilla": "https://upload.wikimedia.org/wikipedia/en/3/3b/Sevilla_FC_logo.svg",
  "valencia": "https://upload.wikimedia.org/wikipedia/en/c/ce/Valenciacf.svg",
  "girona": "https://upload.wikimedia.org/wikipedia/en/9/90/Girona_FC_New_Logo.svg",
  "celta-vigo": "https://upload.wikimedia.org/wikipedia/en/1/12/RC_Celta_de_Vigo_logo.svg",
  "osasuna": "https://upload.wikimedia.org/wikipedia/en/d/db/CA_Osasuna_logo.svg",
  "rayo-vallecano": "https://upload.wikimedia.org/wikipedia/en/1/12/Rayo_Vallecano_logo.svg",
  "mallorca": "https://upload.wikimedia.org/wikipedia/en/e/e0/RCD_Mallorca.svg",
  "getafe": "https://upload.wikimedia.org/wikipedia/en/4/46/Getafe_logo.svg",
  "alaves": "https://upload.wikimedia.org/wikipedia/en/f/f8/Deportivo_Alav%C3%A9s_logo_%282020%29.svg",
  "las-palmas": "https://upload.wikimedia.org/wikipedia/en/1/1e/UD_Las_Palmas_logo.svg",
  "espanyol": "https://upload.wikimedia.org/wikipedia/en/d/d5/RCD_Espanyol_logo.svg",
  "real-valladolid": "https://upload.wikimedia.org/wikipedia/en/6/6e/Real_Valladolid_Logo.svg",
  "leganes": "https://upload.wikimedia.org/wikipedia/en/6/69/CD_Legan%C3%A9s_logo.svg",
  // Premier League
  "manchester-city": "https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg",
  "liverpool": "https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg",
  "arsenal": "https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg",
  "chelsea": "https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg",
  "manchester-united": "https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg",
  "tottenham": "https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg",
  "newcastle": "https://upload.wikimedia.org/wikipedia/en/5/56/Newcastle_United_Logo.svg",
  "aston-villa": "https://upload.wikimedia.org/wikipedia/en/f/f9/Aston_Villa_FC_crest_%282016%29.svg",
  "brighton": "https://upload.wikimedia.org/wikipedia/en/f/fd/Brighton_%26_Hove_Albion_logo.svg",
  "west-ham": "https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg",
  "bournemouth": "https://upload.wikimedia.org/wikipedia/en/e/e5/AFC_Bournemouth_%282013%29.svg",
  "crystal-palace": "https://upload.wikimedia.org/wikipedia/en/a/a2/Crystal_Palace_FC_logo_%282022%29.svg",
  "fulham": "https://upload.wikimedia.org/wikipedia/en/e/eb/Fulham_FC_%28shield%29.svg",
  "wolverhampton": "https://upload.wikimedia.org/wikipedia/en/f/fc/Wolverhampton_Wanderers.svg",
  "everton": "https://upload.wikimedia.org/wikipedia/en/7/7c/Everton_FC_logo.svg",
  "brentford": "https://upload.wikimedia.org/wikipedia/en/2/2a/Brentford_FC_crest.svg",
  "nottingham-forest": "https://upload.wikimedia.org/wikipedia/en/e/e5/Nottingham_Forest_F.C._logo.svg",
  "ipswich": "https://upload.wikimedia.org/wikipedia/en/4/43/Ipswich_Town.svg",
  "leicester": "https://upload.wikimedia.org/wikipedia/en/2/2d/Leicester_City_crest.svg",
  "southampton": "https://upload.wikimedia.org/wikipedia/en/c/c9/FC_Southampton.svg",
  // Other European teams
  "bayern-munich": "https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg",
  "psg": "https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg",
};

export function TeamLogo({ team, size = "md", className }: TeamLogoProps) {
  const logoUrl = team.logo || TEAM_LOGOS[team.id];

  if (logoUrl) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center",
          sizeClasses[size],
          className
        )}
      >
        <Image
          src={logoUrl}
          alt={`Escudo de ${team.name}`}
          width={sizePx[size]}
          height={sizePx[size]}
          className="w-full h-full object-contain"
          unoptimized
        />
      </div>
    );
  }

  // Fallback: Display initials in a circle
  const initials = team.shortName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .substring(0, 3)
    .toUpperCase();

  return (
    <div
      className={cn(
        "rounded-full bg-[#2a2a2a] flex items-center justify-center font-bold text-[#D4AF37] text-sm",
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
