"use client";

import { cn } from "@/lib/utils";
import type { SeatWithStatus } from "../types";
import { DEFAULT_ZONE_LABEL_POSITIONS, type ZoneLabelConfig } from "../constants";

interface FloorPlanViewProps {
  seats: SeatWithStatus[];
  highlightedSeats?: string[]; // Seat IDs to highlight in yellow
  zoneLabels?: ZoneLabelConfig[];
}

// Base horizontal padding in pixels for each label type
const BASE_PADDING = 12; // px (equivalent to px-3)

export function FloorPlanView({ seats, highlightedSeats = [], zoneLabels }: FloorPlanViewProps) {
  const labels = zoneLabels || DEFAULT_ZONE_LABEL_POSITIONS;

  return (
    <div className="relative w-full">
      {/* Floor plan image - aspect ratio matches 464x800 image */}
      <div className="relative w-full aspect-[464/800] rounded-xl overflow-hidden bg-black">
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="relative w-full h-full"
            style={{
              backgroundImage: "url('/images/floor-plan.png')",
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
        </div>

        {/* Zone labels with dynamic positioning and transformations */}
        {labels.map((label) => {
          const isTV1 = label.zone === "TV1";
          const isTV2 = label.zone === "TV2";
          // Calculate padding based on scaleX multiplier
          const horizontalPadding = Math.round(BASE_PADDING * label.scaleX);

          // Colors: background and lighter border for each zone
          const colors = isTV1
            ? { bg: "#7f1d1d", border: "#b91c1c" }
            : isTV2
            ? { bg: "#1e3a5f", border: "#3b82f6" }
            : { bg: "#92700c", border: "#D4AF37" };

          return (
            <div
              key={label.zone}
              className="absolute text-[9px] font-bold z-10 pointer-events-none whitespace-nowrap text-white py-1 rounded-full border-2"
              style={{
                left: `${label.posX}%`,
                top: `${label.posY}%`,
                transform: `translate(-50%, -50%) rotate(${label.rotation}deg)`,
                paddingLeft: `${horizontalPadding}px`,
                paddingRight: `${horizontalPadding}px`,
                backgroundColor: colors.bg,
                borderColor: colors.border,
              }}
            >
              {label.zone === "PROYECTOR" ? "PROYECTOR" : label.zone}
            </div>
          );
        })}

        {/* Seats overlay - positions from database (posX, posY) */}
        {seats.map((seat) => {
          const isHighlighted = highlightedSeats.includes(seat.id);
          const isAvailable = seat.status === "AVAILABLE";
          const isOccupied = seat.status === "OCCUPIED" || seat.status === "RESERVED";

          return (
            <div
              key={seat.id}
              className={cn(
                "absolute w-[26px] h-[26px] md:w-[31px] md:h-[31px] rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 z-20",
                isHighlighted && "bg-[#D4AF37] border-[#b8972e]",
                !isHighlighted && isAvailable && "bg-[#22c55e] border-[#16a34a]",
                !isHighlighted && isOccupied && "bg-[#ef4444] border-[#dc2626]"
              )}
              style={{
                left: `${seat.posX}%`,
                top: `${seat.posY}%`,
              }}
              title={`${seat.code} - ${isHighlighted ? "Esta reserva" : isAvailable ? "Disponible" : "Ocupado"}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#D4AF37] border-2 border-[#b8972e]" />
          <span className="text-white/70">Esta reserva</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#22c55e] border-2 border-[#16a34a]" />
          <span className="text-white/70">Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ef4444] border-2 border-[#dc2626]" />
          <span className="text-white/70">Ocupado</span>
        </div>
      </div>
    </div>
  );
}
