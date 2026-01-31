"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, Tv } from "lucide-react";
import type { SeatWithStatus, SeatZone } from "../types";
import { ZONE_LABELS, ZONE_DESCRIPTIONS } from "../types";
import { Seat } from "./seat";

interface SeatMapProps {
  seats: SeatWithStatus[];
  selectedSeats: string[];
  onSeatSelect: (seatId: string) => void;
  prices: {
    PROJECTOR: number;
    TV1: number;
    TV2: number;
  };
}

export function SeatMap({ seats, selectedSeats, onSeatSelect, prices }: SeatMapProps) {
  // Group seats by zone
  const seatsByZone = seats.reduce((acc, seat) => {
    if (!acc[seat.zone]) {
      acc[seat.zone] = [];
    }
    acc[seat.zone].push(seat);
    return acc;
  }, {} as Record<SeatZone, SeatWithStatus[]>);

  // Group seats by row within each zone
  const groupByRow = (zoneSeats: SeatWithStatus[]) => {
    return zoneSeats.reduce((acc, seat) => {
      const row = seat.row || "A";
      if (!acc[row]) {
        acc[row] = [];
      }
      acc[row].push(seat);
      return acc;
    }, {} as Record<string, SeatWithStatus[]>);
  };

  const getZoneIcon = (zone: SeatZone) => {
    switch (zone) {
      case "PROJECTOR":
        return <Monitor className="w-5 h-5" />;
      case "TV1":
      case "TV2":
        return <Tv className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border border-border">
        <span className="text-sm font-medium">Leyenda:</span>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-secondary border-2 border-border" />
          <span className="text-xs text-muted-foreground">Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary border-2 border-primary" />
          <span className="text-xs text-muted-foreground">Seleccionado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-muted border-2 border-muted opacity-50" />
          <span className="text-xs text-muted-foreground">Reservado</span>
        </div>
      </div>

      {/* Bar Layout */}
      <div className="relative p-4 md:p-8 bg-card rounded-xl border border-border">
        {/* Bar Label */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2">
          <Badge variant="outline" className="text-xs">
            Vista del local
          </Badge>
        </div>

        {/* Projector Zone */}
        {seatsByZone.PROJECTOR && (
          <ZoneSection
            zone="PROJECTOR"
            seats={seatsByZone.PROJECTOR}
            selectedSeats={selectedSeats}
            onSeatSelect={onSeatSelect}
            price={prices.PROJECTOR}
            icon={getZoneIcon("PROJECTOR")}
            groupByRow={groupByRow}
            className="mb-8"
          />
        )}

        {/* Screen representation */}
        <div className="w-full max-w-md mx-auto h-4 bg-gradient-to-b from-primary/30 to-transparent rounded-t-full mb-8 flex items-center justify-center">
          <span className="text-[10px] text-primary font-medium">PROYECTOR</span>
        </div>

        {/* TV Zones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {seatsByZone.TV1 && (
            <ZoneSection
              zone="TV1"
              seats={seatsByZone.TV1}
              selectedSeats={selectedSeats}
              onSeatSelect={onSeatSelect}
              price={prices.TV1}
              icon={getZoneIcon("TV1")}
              groupByRow={groupByRow}
            />
          )}
          {seatsByZone.TV2 && (
            <ZoneSection
              zone="TV2"
              seats={seatsByZone.TV2}
              selectedSeats={selectedSeats}
              onSeatSelect={onSeatSelect}
              price={prices.TV2}
              icon={getZoneIcon("TV2")}
              groupByRow={groupByRow}
            />
          )}
        </div>

        {/* Bar counter representation */}
        <div className="mt-8 w-full h-8 bg-secondary/50 rounded-lg flex items-center justify-center">
          <span className="text-xs text-muted-foreground">BARRA</span>
        </div>
      </div>
    </div>
  );
}

interface ZoneSectionProps {
  zone: SeatZone;
  seats: SeatWithStatus[];
  selectedSeats: string[];
  onSeatSelect: (seatId: string) => void;
  price: number;
  icon: React.ReactNode;
  groupByRow: (seats: SeatWithStatus[]) => Record<string, SeatWithStatus[]>;
  className?: string;
}

function ZoneSection({
  zone,
  seats,
  selectedSeats,
  onSeatSelect,
  price,
  icon,
  groupByRow,
  className,
}: ZoneSectionProps) {
  const rows = groupByRow(seats);
  const availableCount = seats.filter((s) => s.status === "AVAILABLE").length;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{ZONE_LABELS[zone]}</CardTitle>
          </div>
          <div className="text-right">
            <Badge variant="secondary" className="mb-1">
              {price.toFixed(2)}€
            </Badge>
            <p className="text-xs text-muted-foreground">
              {availableCount} disponibles
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{ZONE_DESCRIPTIONS[zone]}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Object.entries(rows)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([row, rowSeats]) => (
              <div key={row} className="flex items-center gap-2">
                <span className="w-6 text-xs text-muted-foreground font-medium">
                  {row}
                </span>
                <div className="flex flex-wrap gap-2">
                  {rowSeats
                    .sort((a, b) => a.number - b.number)
                    .map((seat) => (
                      <Seat
                        key={seat.id}
                        seat={seat}
                        isSelected={selectedSeats.includes(seat.id)}
                        onSelect={onSeatSelect}
                      />
                    ))}
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
