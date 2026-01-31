"use client";

import { cn } from "@/lib/utils";
import type { SeatWithStatus } from "../types";

interface SeatProps {
  seat: SeatWithStatus;
  isSelected: boolean;
  onSelect: (seatId: string) => void;
}

export function Seat({ seat, isSelected, onSelect }: SeatProps) {
  const isAvailable = seat.status === "AVAILABLE";
  const isReserved = seat.status === "RESERVED";
  const isOccupied = seat.status === "OCCUPIED";
  const isBlocked = seat.status === "BLOCKED";

  const handleClick = () => {
    if (isAvailable || isSelected) {
      onSelect(seat.id);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!isAvailable && !isSelected}
      className={cn(
        "seat w-10 h-10 md:w-12 md:h-12 rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-all",
        isAvailable && !isSelected && "seat-available border-border hover:scale-105",
        isSelected && "seat-selected scale-105 shadow-lg",
        isReserved && "seat-reserved border-muted",
        isOccupied && "seat-occupied",
        isBlocked && "bg-muted/50 border-muted cursor-not-allowed"
      )}
      title={`Asiento ${seat.code} - ${
        isSelected
          ? "Seleccionado"
          : isAvailable
          ? "Disponible"
          : isReserved
          ? "Reservado"
          : "No disponible"
      }`}
    >
      {seat.number}
    </button>
  );
}
