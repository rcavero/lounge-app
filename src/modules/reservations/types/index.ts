import type { Reservation, ReservationStatus, PaymentStatus } from "@/generated/prisma";
import type { EventWithTeams } from "@/modules/events/types";
import type { SeatWithStatus } from "@/modules/seating/types";

export type { Reservation, ReservationStatus, PaymentStatus };

export interface ReservationWithDetails extends Reservation {
  event: EventWithTeams;
  seatStatuses: {
    seat: SeatWithStatus;
  }[];
}

export interface CreateReservationInput {
  eventId: string;
  seatIds: string[];
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
}

export interface ReservationFormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}
