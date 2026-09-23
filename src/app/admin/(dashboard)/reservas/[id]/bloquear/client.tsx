"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { saveBlockedSeats } from "@/modules/seating/actions";
import {
  DEFAULT_ZONE_LABEL_POSITIONS,
  type ZoneLabelConfig,
} from "@/modules/seating/constants";
import type { SeatWithStatus } from "@/modules/seating/types";

const BASE_PADDING = 12;

interface BlockSeatsClientProps {
  eventId: string;
  seats: SeatWithStatus[];
  zoneLabels: ZoneLabelConfig[];
}

export function BlockSeatsClient({ eventId, seats, zoneLabels }: BlockSeatsClientProps) {
  const router = useRouter();
  const labels = zoneLabels?.length ? zoneLabels : DEFAULT_ZONE_LABEL_POSITIONS;

  // Pre-select currently blocked seats
  const [blockedSeats, setBlockedSeats] = useState<string[]>(
    seats.filter((s) => s.status === "BLOCKED").map((s) => s.id),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSeat = (seatId: string, currentStatus: string) => {
    if (currentStatus === "OCCUPIED" || currentStatus === "RESERVED") return;
    setBlockedSeats((prev) =>
      prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId],
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    const result = await saveBlockedSeats(eventId, blockedSeats);
    if (result.success) {
      router.push(`/admin/reservas/${eventId}`);
    } else {
      setError(result.error ?? "Error al guardar");
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link
          href={`/admin/reservas/${eventId}`}
          className="inline-flex items-center text-white/70 hover:text-white text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Link>
        <Button
          data-testid="save-blocks"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Guardando..." : "Guardar bloqueos"}
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Floor plan */}
      <div className="relative w-full">
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

          {/* Zone labels */}
          {labels.map((label) => {
            const isTV1 = label.zone === "TV1";
            const isTV2 = label.zone === "TV2";
            const horizontalPadding = Math.round(BASE_PADDING * label.scaleX);
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
                {label.zone}
              </div>
            );
          })}

          {/* Seats */}
          {seats.map((seat) => {
            const isUnavailable =
              seat.status === "OCCUPIED" || seat.status === "RESERVED";
            const isBlocked = blockedSeats.includes(seat.id);

            return (
              <button
                key={seat.id}
                data-testid="block-seat"
                data-seat-code={seat.code}
                data-seat-state={
                  isUnavailable ? seat.status : isBlocked ? "BLOCKED" : "AVAILABLE"
                }
                onClick={() => toggleSeat(seat.id, seat.status)}
                disabled={isUnavailable}
                className={cn(
                  "absolute w-[26px] h-[26px] md:w-[31px] md:h-[31px] rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 transition-all z-20",
                  isUnavailable && "bg-[#ef4444] border-[#dc2626] cursor-not-allowed",
                  !isUnavailable &&
                    isBlocked &&
                    "bg-[#6b7280] border-[#4b5563] hover:scale-125 cursor-pointer",
                  !isUnavailable &&
                    !isBlocked &&
                    "bg-[#22c55e] border-[#16a34a] hover:scale-125 cursor-pointer",
                )}
                style={{ left: `${seat.posX}%`, top: `${seat.posY}%` }}
                title={`${seat.code} — ${isUnavailable ? "Ocupado" : isBlocked ? "Bloqueado" : "Disponible"}`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 mt-4 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#22c55e] border-2 border-[#16a34a]" />
            <span className="text-white/70">Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#6b7280] border-2 border-[#4b5563]" />
            <span className="text-white/70">Bloqueado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ef4444] border-2 border-[#dc2626]" />
            <span className="text-white/70">Ocupado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
