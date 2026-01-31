"use server";

import prisma from "@/lib/prisma";
import type { EventWithTeams } from "@/modules/events/types";

export interface ReservationResult {
  success: boolean;
  error?: string;
  reservation?: {
    id: string;
    eventId: string;
    eventTitle: string;
    homeTeamName: string;
    awayTeamName: string;
    eventDate: string;
    seats: { id: string; code: string }[];
    totalSeats: number;
    totalPrice: number;
  };
}

export interface ReservationWithSeats {
  id: string;
  eventId: string;
  numberOfSeats: number;
  totalPrice: number;
  createdAt: Date;
  seatStatuses: {
    seat: {
      id: string;
      code: string;
    };
  }[];
}

export interface EventWithReservationCount extends EventWithTeams {
  _count: {
    reservations: number;
  };
}

export async function createReservation(data: {
  eventId: string;
  seatIds: string[];
  pricePerSeat: number;
}): Promise<ReservationResult> {
  try {
    const { eventId, seatIds, pricePerSeat } = data;

    if (seatIds.length === 0) {
      return { success: false, error: "No hay asientos seleccionados" };
    }

    // Get event with teams
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    });

    if (!event) {
      return { success: false, error: "Evento no encontrado" };
    }

    // Verify all seats are available
    const seatStatuses = await prisma.seatStatus.findMany({
      where: {
        eventId,
        seatId: { in: seatIds },
      },
      include: {
        seat: true,
      },
    });

    const unavailableSeats = seatStatuses.filter(
      (ss) => ss.status !== "AVAILABLE"
    );

    if (unavailableSeats.length > 0) {
      return {
        success: false,
        error: `Algunos asientos ya no están disponibles: ${unavailableSeats
          .map((s) => s.seat.code)
          .join(", ")}`,
      };
    }

    const totalPrice = seatIds.length * pricePerSeat;

    // Create reservation and update seat statuses in a transaction
    const reservation = await prisma.$transaction(async (tx) => {
      // Create the reservation
      const newReservation = await tx.reservation.create({
        data: {
          eventId,
          customerName: "Cliente",
          customerEmail: "cliente@lounge.com",
          numberOfSeats: seatIds.length,
          totalPrice,
          status: "CONFIRMED",
          paymentStatus: "COMPLETED",
          confirmedAt: new Date(),
        },
      });

      // Update seat statuses to OCCUPIED and link to reservation
      await tx.seatStatus.updateMany({
        where: {
          eventId,
          seatId: { in: seatIds },
        },
        data: {
          status: "OCCUPIED",
          reservationId: newReservation.id,
        },
      });

      return newReservation;
    });

    // Get seat codes for the response
    const seats = seatStatuses.map((ss) => ({
      id: ss.seat.id,
      code: ss.seat.code,
    }));

    return {
      success: true,
      reservation: {
        id: reservation.id,
        eventId: event.id,
        eventTitle: event.title,
        homeTeamName: event.homeTeam.name,
        awayTeamName: event.awayTeam.name,
        eventDate: event.eventDate.toISOString(),
        seats,
        totalSeats: seatIds.length,
        totalPrice,
      },
    };
  } catch (error) {
    console.error("Error creating reservation:", error);
    return { success: false, error: "Error al crear la reserva" };
  }
}

// Get all events with reservation counts
export async function getEventsWithReservationCount(): Promise<EventWithReservationCount[]> {
  const events = await prisma.event.findMany({
    where: {
      eventDate: {
        gte: new Date(),
      },
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      _count: {
        select: {
          reservations: true,
        },
      },
    },
    orderBy: {
      eventDate: "asc",
    },
  });

  return events as EventWithReservationCount[];
}

// Get event with all its reservations
export async function getEventWithReservations(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      homeTeam: true,
      awayTeam: true,
      reservations: {
        include: {
          seatStatuses: {
            include: {
              seat: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  return event;
}

// Get a specific reservation with its seats
export async function getReservationWithSeats(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      event: {
        include: {
          homeTeam: true,
          awayTeam: true,
        },
      },
      seatStatuses: {
        include: {
          seat: true,
        },
      },
    },
  });

  return reservation;
}
