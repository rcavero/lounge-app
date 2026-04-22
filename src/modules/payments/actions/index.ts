"use server";

import prisma from "@/lib/prisma";
import {
  createRedirectForm,
  MERCHANT_CODE,
  MERCHANT_TERMINAL,
  generateOrderId,
} from "@/lib/redsys";
import type { InitializePaymentResult, ReservationTicketData } from "../types";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  "http://localhost:3000";

export async function initializePayment(data: {
  eventId: string;
  seatIds: string[];
}): Promise<InitializePaymentResult> {
  const { eventId, seatIds } = data;

  if (seatIds.length === 0) {
    return { success: false, error: "No hay asientos seleccionados" };
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { success: false, error: "Evento no encontrado" };

  const pricePerSeat = event.pricePerSeat;

  // Verify all selected seats are available in this event
  const seatStatuses = await prisma.seatStatus.findMany({
    where: { eventId, seatId: { in: seatIds } },
    include: { seat: true },
  });

  const unavailable = seatStatuses.filter((ss) => ss.status !== "AVAILABLE");
  if (unavailable.length > 0) {
    return {
      success: false,
      error: `Asientos no disponibles: ${unavailable.map((s) => s.seat.code).join(", ")}`,
    };
  }

  // Verify selected seats are not taken in overlapping events
  const eventStart = event.eventDate.getTime();
  const eventEnd = eventStart + event.durationMinutes * 60 * 1000;

  const overlappingCandidates = await prisma.event.findMany({
    where: {
      id: { not: eventId },
      status: { in: ["UPCOMING", "LIVE"] },
    },
    select: { id: true, eventDate: true, durationMinutes: true },
  });

  const overlappingIds = overlappingCandidates
    .filter((e) => {
      const start = e.eventDate.getTime();
      const end = start + e.durationMinutes * 60 * 1000;
      return eventStart < end && start < eventEnd;
    })
    .map((e) => e.id);

  if (overlappingIds.length > 0) {
    const takenInOverlap = await prisma.seatStatus.findMany({
      where: {
        eventId: { in: overlappingIds },
        seatId: { in: seatIds },
        status: { in: ["RESERVED", "OCCUPIED"] },
      },
      include: { seat: true },
    });

    if (takenInOverlap.length > 0) {
      const codes = [...new Set(takenInOverlap.map((s) => s.seat.code))].join(", ");
      return {
        success: false,
        error: `Algunos asientos no están disponibles porque están reservados en otro evento simultáneo: ${codes}`,
      };
    }
  }

  const totalPrice = seatIds.length * pricePerSeat;
  const orderId = generateOrderId();

  // Create PENDING reservation and mark seats as RESERVED atomically
  const reservation = await prisma.$transaction(async (tx) => {
    const newReservation = await tx.reservation.create({
      data: {
        eventId,
        customerName: "Cliente",
        customerEmail: "cliente@lounge.com",
        numberOfSeats: seatIds.length,
        totalPrice,
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentId: orderId,
      },
    });

    await tx.seatStatus.updateMany({
      where: { eventId, seatId: { in: seatIds } },
      data: { status: "RESERVED", reservationId: newReservation.id },
    });

    return newReservation;
  });

  // Build Redsys signed redirect form
  const amountInCents = String(totalPrice * 100);
  const okUrl = `${BASE_URL}/reserva/confirmacion/${orderId}`;
  const koUrl = `${BASE_URL}/reserva/error?orderId=${orderId}&eventId=${eventId}`;
  const notifyUrl = `${BASE_URL}/api/payments/notify`;

  const form = createRedirectForm({
    DS_MERCHANT_MERCHANTCODE: MERCHANT_CODE,
    DS_MERCHANT_TERMINAL: MERCHANT_TERMINAL,
    DS_MERCHANT_ORDER: orderId,
    DS_MERCHANT_AMOUNT: amountInCents,
    DS_MERCHANT_CURRENCY: "978", // EUR
    DS_MERCHANT_TRANSACTIONTYPE: "0", // Authorization
    DS_MERCHANT_URLOK: okUrl,
    DS_MERCHANT_URLKO: koUrl,
    DS_MERCHANT_MERCHANTURL: notifyUrl,
    DS_MERCHANT_PRODUCTDESCRIPTION: "Reserva de asientos",
    DS_MERCHANT_MERCHANTNAME: "The Lounge Beerhouse",
  });

  console.log(`[Payment] Created reservation ${reservation.id} with orderId ${orderId}`);

  return {
    success: true,
    redsysUrl: form.url,
    formBody: form.body,
  };
}

export async function confirmReservationByOrderId(orderId: string): Promise<void> {
  // Only act on PENDING reservations — if the webhook already confirmed it, this is a no-op
  const reservation = await prisma.reservation.findFirst({
    where: { paymentId: orderId, status: "PENDING" },
    select: { id: true },
  });

  if (!reservation) return;

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: "CONFIRMED",
        paymentStatus: "COMPLETED",
        confirmedAt: new Date(),
      },
    });

    await tx.seatStatus.updateMany({
      where: { reservationId: reservation.id },
      data: { status: "OCCUPIED" },
    });
  });

  console.log(`[Payment] Reservation ${reservation.id} confirmed from success page`);
}

export async function cancelReservationByOrderId(orderId: string): Promise<void> {
  const reservation = await prisma.reservation.findFirst({
    where: { paymentId: orderId, status: { in: ["PENDING", "CONFIRMED"] } },
    select: {
      id: true,
      eventId: true,
      status: true,
      seatStatuses: { select: { seatId: true } },
    },
  });

  // Only cancel if the payment hasn't already been confirmed by the webhook
  if (!reservation || reservation.status === "CONFIRMED") return;

  const seatIds = reservation.seatStatuses.map((ss) => ss.seatId);

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: "CANCELLED", paymentStatus: "FAILED" },
    });

    await tx.seatStatus.updateMany({
      where: { seatId: { in: seatIds }, eventId: reservation.eventId },
      data: { status: "AVAILABLE", reservationId: null },
    });
  });

  console.log(`[Payment] Reservation ${reservation.id} cancelled from error page`);
}

export async function getReservationByOrderId(
  orderId: string
): Promise<ReservationTicketData | null> {
  const reservation = await prisma.reservation.findFirst({
    where: { paymentId: orderId },
    include: {
      event: {
        include: { homeTeam: true, awayTeam: true },
      },
      seatStatuses: {
        include: { seat: true },
      },
    },
  });

  if (!reservation) return null;

  return {
    id: reservation.id,
    eventId: reservation.eventId,
    homeTeamName: reservation.event.homeTeam?.name ?? reservation.event.homeTeamName ?? "",
    awayTeamName: reservation.event.awayTeam?.name ?? reservation.event.awayTeamName ?? "",
    eventDate: reservation.event.eventDate.toISOString(),
    seats: reservation.seatStatuses.map((ss) => ({
      id: ss.seat.id,
      code: ss.seat.code,
    })),
    totalSeats: reservation.numberOfSeats,
    totalPrice: Number(reservation.totalPrice),
    status: reservation.status,
  };
}
