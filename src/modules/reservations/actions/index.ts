"use server";

import prisma from "@/lib/prisma";
import type { EventWithTeams } from "@/modules/events/types";
import { requireAdmin, requireAuth } from "@/lib/auth-guard";
import { PAID_WITHOUT_SEATS } from "@/modules/payments/domain/outcome";
import {
  groupEventsByMonth,
  monthRange,
  type ReportMonth,
} from "../domain/report-months";

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

// Vive en el dominio; se reexporta porque la página de reservas la importa de aquí.
export type { ReportMonth } from "../domain/report-months";

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

// Get all events with reservation counts
export async function getEventsWithReservationCount(): Promise<
  EventWithReservationCount[]
> {
  await requireAuth();
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
  await requireAuth();
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
            orderBy: { seat: { code: "asc" } },
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
  await requireAuth();
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
        orderBy: { seat: { code: "asc" } },
      },
    },
  });

  return reservation;
}

// Get past events from the last 35 days with reservation counts
export async function getPastEventsLast35Days(): Promise<EventWithReservationCount[]> {
  await requireAuth();
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
  await requireAuth();
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

  return groupEventsByMonth(events.map((event) => event.eventDate));
}

// Get monthly report data for PDF generation
export async function getMonthlyReportData(
  year: number,
  month: number,
): Promise<MonthlyReportEvent[]> {
  await requireAuth();
  const { startDate, endDate } = monthRange(year, month);

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
        where: { status: "CONFIRMED" },
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

export interface PaymentToRefund {
  id: string;
  paymentId: string | null;
  customerName: string;
  totalPrice: number;
  authorisationCode: string | null;
  paymentDateTime: string | null;
  eventTitle: string;
  eventDate: Date;
}

/**
 * Reservas cobradas y anuladas: el pago llegó con la reserva caducada y sus asientos ya
 * eran de otro (RCA-276). El bar tiene que devolver el importe desde el portal de Redsys.
 * Las ve también el WORKER: si el cliente se presenta en la barra, tiene que saberlo.
 */
export async function getPaymentsToRefund(): Promise<PaymentToRefund[]> {
  await requireAuth();
  const reservations = await prisma.reservation.findMany({
    where: PAID_WITHOUT_SEATS,
    include: { event: { select: { title: true, eventDate: true } } },
    orderBy: { createdAt: "asc" },
  });

  return reservations.map((r) => ({
    id: r.id,
    paymentId: r.paymentId,
    customerName: r.customerName,
    totalPrice: Number(r.totalPrice),
    authorisationCode: r.authorisationCode,
    paymentDateTime: r.paymentDateTime,
    eventTitle: r.event.title,
    eventDate: r.event.eventDate,
  }));
}

/**
 * El bar ya ha hecho la devolución en el portal de Redsys. Solo ADMIN, y solo sobre una
 * reserva que de verdad esté pendiente de devolver: no sirve para anular una reserva
 * confirmada.
 */
export async function markReservationRefunded(
  reservationId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const { count } = await prisma.reservation.updateMany({
    where: { id: reservationId, ...PAID_WITHOUT_SEATS },
    data: { paymentStatus: "REFUNDED" },
  });
  return count === 1
    ? { success: true }
    : { success: false, error: "Esta reserva no está pendiente de devolución" };
}
