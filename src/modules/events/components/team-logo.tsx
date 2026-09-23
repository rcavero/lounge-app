"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { useState } from "react";
import type { Team } from "../types";

interface TeamLogoProps {
  team?: Team | null;
  emoji?: string | null; // override para deportes manuales
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

export function TeamLogo({ team, emoji, size = "md", className }: TeamLogoProps) {
  // Se guarda la ruta que ha fallado, no un booleano: así, si el equipo cambia
  // (listas reutilizadas por React) o si el escudo se corrige, el error se
  // resetea solo en vez de dejar las iniciales pegadas.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // Emoji override (deporte manual)
  if (emoji) {
    return (
      <div
        className={cn("flex items-center justify-center", sizeClasses[size], className)}
      >
        <span style={{ fontSize: `${Math.round(sizePx[size] * 0.65)}px`, lineHeight: 1 }}>
          {emoji}
        </span>
      </div>
    );
  }

  // Sin equipo → placeholder vacío (no lanza error)
  if (!team) {
    return <div className={cn(sizeClasses[size], className)} />;
  }

  // Escudo: ruta local (/escudos/...) o URL remota, indistintamente.
  // Si la imagen no carga, se cae a las iniciales en vez de dejar el icono de
  // imagen rota — es lo que hace que un fichero perdido o una URL caducada
  // degraden bien en la web pública.
  if (team.logo && failedSrc !== team.logo) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center",
          sizeClasses[size],
          className,
        )}
      >
        <Image
          src={team.logo}
          alt={`Escudo de ${team.name}`}
          width={sizePx[size]}
          height={sizePx[size]}
          className="w-full h-full object-contain"
          unoptimized
          onError={() => setFailedSrc(team.logo ?? null)}
        />
      </div>
    );
  }

  // Fallback: iniciales
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
        className,
      )}
    >
      {initials}
    </div>
  );
}
