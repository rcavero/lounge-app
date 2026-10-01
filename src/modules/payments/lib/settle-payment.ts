import prisma from "@/lib/prisma";
import { overlappingEventIds } from "@/modules/events/domain/overlap";

import {
  PAID_WITHOUT_SEATS,
  reservationUpdateFor,
  seatUpdateFor,
} from "../domain/outcome";

/**
 * Qué pasa cuando el banco autoriza un pago. 💰 Lo llama el webhook de Redsys, que es
 * la única fuente de verdad de que se ha cobrado.
 *
 * - **`confirmed`**: la reserva seguía `PENDING` (o ya estaba `CONFIRMED`, porque Redsys
 *   repite notificaciones). Es el camino de siempre.
 * - **`rescued`**: la reserva había caducado mientras el cliente estaba en la pasarela,
 *   pero sus asientos seguían libres. Se ocupan esos mismos y se confirma (RCA-276).
 * - **`refund`**: había caducado y alguno de sus asientos ya es de otro, aquí o en un
 *   evento que se solapa. Queda cobrada y anulada (`PAID_WITHOUT_SEATS`): el panel lo
 *   avisa y el bar devuelve el dinero en el portal de Redsys.
 *
 * Antes, un OK sobre una reserva caducada la confirmaba sin asientos: se cobraba, el
 * ticket salía vacío y los asientos se podían vender a otro.
 *
 * NO es una server action, por lo mismo que `apply-payment-outcome.ts`.
 */
export type SettledPayment = "confirmed" | "rescued" | "refund";

/** Alguno de los asientos no se ha podido recuperar dentro de la transacción. */
class RescueFailed extends Error {}

export async function settleAuthorisedPayment(
  reservationId: string,
): Promise<SettledPayment> {
  if (await confirmOnTime(reservationId)) return "confirmed";

  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    select: {
      paymentStatus: true,
      numberOfSeats: true,
      event: { select: { id: true, eventDate: true, durationMinutes: true } },
    },
  });

  // Ya devuelta: una notificación repetida no la reabre.
  if (reservation.paymentStatus === "REFUNDED") return "refund";

  if (await rescue(reservationId, reservation.numberOfSeats, reservation.event)) {
    return "rescued";
  }

  return (await markForRefund(reservationId)) ? "refund" : "confirmed";
}

/** El camino de siempre: la reserva sigue PENDING, o ya estaba confirmada. */
async function confirmOnTime(reservationId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.reservation.updateMany({
      where: { id: reservationId, status: { in: ["PENDING", "CONFIRMED"] } },
      data: reservationUpdateFor("ok", new Date()),
    });
    if (count === 0) return false;

    await tx.seatStatus.updateMany({
      where: { reservationId },
      data: seatUpdateFor("ok"),
    });
    return true;
  });
}

/**
 * Recupera los asientos que la caducidad dejó libres con el rastro de esta reserva
 * (ver `reservations/lib/expire.ts`). Todos o ninguno: una reserva de tres asientos
 * con dos recuperados sigue habiendo cobrado tres.
 */
async function rescue(
  reservationId: string,
  numberOfSeats: number,
  event: { id: string; eventDate: Date; durationMinutes: number },
): Promise<boolean> {
  const traced = await prisma.seatStatus.findMany({
    where: { reservationId, status: "AVAILABLE" },
    select: { seatId: true },
  });
  if (traced.length !== numberOfSeats) return false;

  // El local es uno: si otro cliente tiene el asiento en un partido que se solapa, no
  // está libre aunque en este evento lo parezca. Es la misma comprobación que hace
  // initializePayment, y como allí, va fuera de la transacción.
  if (
    await takenInOverlappingEvent(
      event,
      traced.map((t) => t.seatId),
    )
  )
    return false;

  try {
    await prisma.$transaction(async (tx) => {
      // Mismo principio que initializePayment: solo cuenta lo que sigue libre y es
      // nuestro. Si otro cliente se ha adelantado, se deshace.
      const { count } = await tx.seatStatus.updateMany({
        where: { reservationId, status: "AVAILABLE" },
        data: seatUpdateFor("ok"),
      });
      if (count !== numberOfSeats) throw new RescueFailed();

      await tx.reservation.update({
        where: { id: reservationId },
        data: reservationUpdateFor("ok", new Date()),
      });
    });
    return true;
  } catch (error) {
    if (error instanceof RescueFailed) return false;
    throw error;
  }
}

async function takenInOverlappingEvent(
  event: { id: string; eventDate: Date; durationMinutes: number },
  seatIds: string[],
): Promise<boolean> {
  const candidates = await prisma.event.findMany({
    where: { id: { not: event.id }, status: { in: ["UPCOMING", "LIVE"] } },
    select: { id: true, eventDate: true, durationMinutes: true },
  });
  const overlapping = overlappingEventIds(event, candidates);
  if (overlapping.length === 0) return false;

  const taken = await prisma.seatStatus.count({
    where: {
      eventId: { in: overlapping },
      seatId: { in: seatIds },
      status: { in: ["RESERVED", "OCCUPIED"] },
    },
  });
  return taken > 0;
}

/**
 * Cobrada y anulada. Devuelve `false` si otra notificación la ha confirmado entre
 * medias, y entonces no toca nada.
 */
async function markForRefund(reservationId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.reservation.updateMany({
      where: {
        id: reservationId,
        status: { in: ["EXPIRED", "CANCELLED"] },
        paymentStatus: { not: "REFUNDED" },
      },
      data: PAID_WITHOUT_SEATS,
    });
    if (count === 0) return false;

    // El rastro que quede ya no sirve para nada, y en un asiento libre es confuso.
    await tx.seatStatus.updateMany({
      where: { reservationId, status: { in: ["AVAILABLE", "BLOCKED"] } },
      data: { reservationId: null },
    });
    return true;
  });
}
