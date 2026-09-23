import type { Seat, SeatStatus, SeatZone, SeatStatusType } from "@/generated/prisma";

export type { Seat, SeatStatus, SeatZone, SeatStatusType };

export interface SeatWithStatus extends Seat {
  status: SeatStatusType;
}
