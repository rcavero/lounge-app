"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Save, RotateCcw } from "lucide-react";
import { updateSeatPositions, updateZoneLabels } from "@/modules/seating/actions";
import {
  DEFAULT_SEAT_POSITIONS,
  DEFAULT_ZONE_LABEL_POSITIONS,
  type ZoneLabelConfig,
} from "@/modules/seating/constants";
import type { Seat } from "@/generated/prisma";

interface SeatPositionEditorProps {
  seats: Seat[];
  zoneLabels: ZoneLabelConfig[];
}

interface SeatPosition {
  id: string;
  code: string;
  zone: string;
  x: number; // percentage
  y: number; // percentage
}

export function SeatPositionEditor({ seats, zoneLabels }: SeatPositionEditorProps) {
  // Convert seats to position state (using posX, posY as percentages)
  const initialPositions: SeatPosition[] = seats.map((seat) => ({
    id: seat.id,
    code: seat.code,
    zone: seat.zone,
    x: seat.posX,
    y: seat.posY,
  }));

  const [positions, setPositions] = useState<SeatPosition[]>(initialPositions);
  const [labels, setLabels] = useState<ZoneLabelConfig[]>(zoneLabels);
  const [draggingSeat, setDraggingSeat] = useState<string | null>(null);
  const [draggingLabel, setDraggingLabel] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((seatId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingSeat(seatId);
  }, []);

  const handleLabelMouseDown = useCallback((zone: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingLabel(zone);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      // Clamp values between 2 and 98
      const clampedX = Math.max(2, Math.min(98, x));
      const clampedY = Math.max(2, Math.min(98, y));

      if (draggingSeat) {
        setPositions((prev) =>
          prev.map((pos) =>
            pos.id === draggingSeat
              ? { ...pos, x: Math.round(clampedX), y: Math.round(clampedY) }
              : pos,
          ),
        );
        setHasChanges(true);
      } else if (draggingLabel) {
        setLabels((prev) =>
          prev.map((label) =>
            label.zone === draggingLabel
              ? {
                  ...label,
                  posX: Math.round(clampedX * 10) / 10,
                  posY: Math.round(clampedY * 10) / 10,
                }
              : label,
          ),
        );
        setHasChanges(true);
      }
    },
    [draggingSeat, draggingLabel],
  );

  const handleMouseUp = useCallback(() => {
    setDraggingSeat(null);
    setDraggingLabel(null);
  }, []);

  const handleTouchStart = useCallback((seatId: string, e: React.TouchEvent) => {
    e.preventDefault();
    setDraggingSeat(seatId);
  }, []);

  const handleLabelTouchStart = useCallback((zone: string, e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingLabel(zone);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!containerRef.current) return;

      const touch = e.touches[0];
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((touch.clientX - rect.left) / rect.width) * 100;
      const y = ((touch.clientY - rect.top) / rect.height) * 100;

      const clampedX = Math.max(2, Math.min(98, x));
      const clampedY = Math.max(2, Math.min(98, y));

      if (draggingSeat) {
        setPositions((prev) =>
          prev.map((pos) =>
            pos.id === draggingSeat
              ? { ...pos, x: Math.round(clampedX), y: Math.round(clampedY) }
              : pos,
          ),
        );
        setHasChanges(true);
      } else if (draggingLabel) {
        setLabels((prev) =>
          prev.map((label) =>
            label.zone === draggingLabel
              ? {
                  ...label,
                  posX: Math.round(clampedX * 10) / 10,
                  posY: Math.round(clampedY * 10) / 10,
                }
              : label,
          ),
        );
        setHasChanges(true);
      }
    },
    [draggingSeat, draggingLabel],
  );

  const handleTouchEnd = useCallback(() => {
    setDraggingSeat(null);
    setDraggingLabel(null);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        updateSeatPositions(
          positions.map((pos) => ({
            id: pos.id,
            posX: pos.x,
            posY: pos.y,
          })),
        ),
        updateZoneLabels(labels),
      ]);
      setHasChanges(false);
      alert("Posiciones guardadas correctamente");
    } catch (error) {
      console.error("Error saving positions:", error);
      alert("Error al guardar las posiciones");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    // Reset to default positions (not the current database positions)
    const defaultPositions: SeatPosition[] = positions.map((pos) => {
      const defaultPos = DEFAULT_SEAT_POSITIONS.find((d) => d.id === pos.id);
      return {
        ...pos,
        x: defaultPos?.posX ?? pos.x,
        y: defaultPos?.posY ?? pos.y,
      };
    });
    setPositions(defaultPositions);
    setLabels(DEFAULT_ZONE_LABEL_POSITIONS);
    setHasChanges(true); // Mark as changed so user can save the reset
  };

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-white/50">
          {hasChanges ? "Hay cambios sin guardar" : "Sin cambios"}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Resetear
          </Button>
          <Button
            data-testid="save-positions"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="bg-[#D4AF37] hover:bg-[#b8972e] text-black"
          >
            <Save className="w-4 h-4 mr-1" />
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      {/* Floor plan with draggable seats */}
      <div className="relative w-full aspect-[464/800] rounded-xl overflow-hidden bg-black">
        <div
          ref={containerRef}
          className="absolute inset-0 flex items-center justify-center cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Floor plan image */}
          <div
            className="relative w-full h-full"
            style={{
              backgroundImage: "url('/images/floor-plan.png')",
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
          {/* Draggable zone labels */}
          {labels.map((label) => {
            const isTV1 = label.zone === "TV1";
            const isTV2 = label.zone === "TV2";
            const isDragging = draggingLabel === label.zone;
            // Calculate padding based on scaleX multiplier (base: 12px)
            const horizontalPadding = Math.round(12 * label.scaleX);

            // Colors: background and lighter border for each zone
            const colors = isTV1
              ? { bg: "#7f1d1d", border: "#b91c1c" }
              : isTV2
                ? { bg: "#1e3a5f", border: "#3b82f6" }
                : { bg: "#92700c", border: "#D4AF37" };

            return (
              <div
                key={label.zone}
                className={cn(
                  "absolute text-[9px] font-bold z-30 cursor-grab active:cursor-grabbing select-none whitespace-nowrap text-white py-1 rounded-full border-2",
                  isDragging && "ring-2 ring-white",
                )}
                style={{
                  left: `${label.posX}%`,
                  top: `${label.posY}%`,
                  transform: `translate(-50%, -50%) rotate(${label.rotation}deg)`,
                  paddingLeft: `${horizontalPadding}px`,
                  paddingRight: `${horizontalPadding}px`,
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                }}
                onMouseDown={(e) => handleLabelMouseDown(label.zone, e)}
                onTouchStart={(e) => handleLabelTouchStart(label.zone, e)}
                title={`${label.zone} (${label.posX}%, ${label.posY}%) - Ancho: ${label.scaleX}x - Rotación: ${label.rotation}°`}
              >
                {label.zone}
              </div>
            );
          })}

          {/* Draggable seats - all green, 30% bigger */}
          {positions.map((seat) => (
            <div
              key={seat.id}
              className={cn(
                "absolute w-[26px] h-[26px] md:w-[31px] md:h-[31px] rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 z-20 cursor-grab active:cursor-grabbing bg-[#22c55e] border-[#16a34a]",
                draggingSeat === seat.id && "scale-125 ring-2 ring-white",
              )}
              style={{
                left: `${seat.x}%`,
                top: `${seat.y}%`,
              }}
              onMouseDown={(e) => handleMouseDown(seat.id, e)}
              onTouchStart={(e) => handleTouchStart(seat.id, e)}
              title={`${seat.code} (${seat.x}%, ${seat.y}%)`}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#22c55e] border-2 border-[#16a34a]" />
          <span className="text-white/70">Asiento ({positions.length} total)</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-center text-xs text-white/40 mt-4">
        Arrastra los asientos para cambiar su posición. Los cambios se aplicarán a todos
        los eventos.
      </div>
    </div>
  );
}
