import type { Seat, SeatStatus, SeatZone, SeatStatusType } from "@/generated/prisma";

export type { Seat, SeatStatus, SeatZone, SeatStatusType };

export interface SeatWithStatus extends Seat {
  status: SeatStatusType;
}

export interface SeatMapProps {
  eventId: string;
  seats: SeatWithStatus[];
  selectedSeats: string[];
  onSeatSelect: (seatId: string) => void;
}

export interface ZoneInfo {
  zone: SeatZone;
  label: string;
  description: string;
  price: number;
}

export const ZONE_LABELS: Record<SeatZone, string> = {
  PROJECTOR: "Proyector",
  TV1: "TV 1",
  TV2: "TV 2",
};

export const ZONE_DESCRIPTIONS: Record<SeatZone, string> = {
  PROJECTOR: "Vista principal con proyector gigante",
  TV1: "Zona con TV de 65 pulgadas",
  TV2: "Zona con TV de 55 pulgadas",
};
