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

export interface ReportMonth {
  year: number;
  month: number;
  label: string;
  eventCount: number;
}

export interface MonthlyReportEvent {
  id: string;
  eventDate: Date;
  homeTeam: { name: string; shortName: string } | null;
  awayTeam: { name: string; shortName: string } | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  reservations: {
    id: string;
    numberOfSeats: number;
    totalPrice: number;
  }[];
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
        homeTeamName: event.homeTeam?.name ?? event.homeTeamName ?? "",
        awayTeamName: event.awayTeam?.name ?? event.awayTeamName ?? "",
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
          reservations: { where: { status: "CONFIRMED" } },
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
        where: { status: "CONFIRMED" },
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

// Get past events from the last 35 days with reservation counts
export async function getPastEventsLast35Days(): Promise<EventWithReservationCount[]> {
  const now = new Date();
  const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);

  const events = await prisma.event.findMany({
    where: {
      eventDate: {
        lt: now,
        gte: thirtyFiveDaysAgo,
      },
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      _count: {
        select: {
          reservations: { where: { status: "CONFIRMED" } },
        },
      },
    },
    orderBy: {
      eventDate: "desc",
    },
  });

  return events as EventWithReservationCount[];
}

// Get available months for reports (last 90 days)
export async function getAvailableReportMonths(): Promise<ReportMonth[]> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const events = await prisma.event.findMany({
    where: {
      eventDate: {
        lt: now,
        gte: ninetyDaysAgo,
      },
    },
    select: {
      eventDate: true,
    },
  });

  // Group events by month
  const monthsMap = new Map<string, { year: number; month: number; count: number }>();
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  for (const event of events) {
    const date = new Date(event.eventDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${month}`;

    if (monthsMap.has(key)) {
      monthsMap.get(key)!.count++;
    } else {
      monthsMap.set(key, { year, month, count: 1 });
    }
  }

  // Convert to array and sort by date descending
  const months: ReportMonth[] = Array.from(monthsMap.values()).map((m) => ({
    year: m.year,
    month: m.month,
    label: `${monthNames[m.month]} ${m.year}`,
    eventCount: m.count,
  }));

  months.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  return months;
}

// Get monthly report data for PDF generation
export async function getMonthlyReportData(year: number, month: number): Promise<MonthlyReportEvent[]> {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const events = await prisma.event.findMany({
    where: {
      eventDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      homeTeam: {
        select: {
          name: true,
          shortName: true,
        },
      },
      awayTeam: {
        select: {
          name: true,
          shortName: true,
        },
      },
      reservations: {
        select: {
          id: true,
          numberOfSeats: true,
          totalPrice: true,
        },
      },
    },
    orderBy: {
      eventDate: "asc",
    },
  });

  // Convert Decimal to number for client serialization
  return events.map((event) => ({
    ...event,
    reservations: event.reservations.map((res) => ({
      ...res,
      totalPrice: Number(res.totalPrice),
    })),
  }));
}
