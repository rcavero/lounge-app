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

export function TeamLogo({ team, size = "md", className }: TeamLogoProps) {
  const logoUrl = team.logo;

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
