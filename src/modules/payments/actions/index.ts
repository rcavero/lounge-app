"use server";

import prisma from "@/lib/prisma";
import { BASE_URL } from "@/lib/base-url";
import {
  createRedirectForm,
  MERCHANT_CODE,
  MERCHANT_TERMINAL,
  PRODUCT_DESCRIPTION,
  PAY_METHODS,
  generateOrderId,
} from "@/lib/redsys";
import { overlappingEventIds } from "@/modules/events/domain/overlap";
import { computeReservationAmount, toRedsysAmount } from "../domain/amount";
import { applyPaymentOutcome } from "../lib/apply-payment-outcome";
import { normalizeCustomerName, validateCustomerName } from "../lib/customer-name";
import type { InitializePaymentResult, ReservationTicketData } from "../types";

/** Algún asiento pedido no se ha podido apartar dentro de la transacción. */
class SeatsTakenError extends Error {}

/** El mensaje de error si alguno de los asientos no está libre en este evento. */
async function unavailableSeatsError(
  eventId: string,
  seatIds: string[],
): Promise<string | null> {
  const seatStatuses = await prisma.seatStatus.findMany({
    where: { eventId, seatId: { in: seatIds } },
    include: { seat: true },
  });

  const unavailable = seatStatuses.filter((ss) => ss.status !== "AVAILABLE");
  if (unavailable.length === 0) return null;
  return `Asientos no disponibles: ${unavailable.map((s) => s.seat.code).join(", ")}`;
}

export async function initializePayment(data: {
  eventId: string;
  seatIds: string[];
  customerName: string;
}): Promise<InitializePaymentResult> {
  const { eventId, seatIds } = data;

  if (seatIds.length === 0) {
    return { success: false, error: "No hay asientos seleccionados" };
  }

  // Se valida antes de tocar la base de datos: un nombre inválido no puede llegar a
  // crear una reserva PENDING que deje asientos bloqueados hasta que expire. El modal
  // valida lo mismo, pero esta es la comprobación que cuenta.
  const customerName = normalizeCustomerName(data.customerName);
  if (validateCustomerName(customerName)) {
    return {
      success: false,
      error: "Indica un nombre o alias válido (entre 2 y 24 caracteres)",
    };
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { success: false, error: "Evento no encontrado" };

  // Importes unitarios de la BD, nunca del cliente. Se trabaja en céntimos enteros:
  // Redsys exige el importe como entero de céntimos y así el desglose que se guarda
  // en la reserva no depende de ninguna división.
  const { seatPriceCents, managementFeeCents, totalCents, totalPrice } =
    computeReservationAmount(event, seatIds.length);

  // Comprobación temprana, para devolver un error con nombre de asiento antes de hacer
  // más consultas. NO es la que protege frente a dos clientes a la vez: esa va dentro
  // de la transacción, más abajo.
  const unavailableError = await unavailableSeatsError(eventId, seatIds);
  if (unavailableError) return { success: false, error: unavailableError };

  // Verify selected seats are not taken in overlapping events
  const overlappingCandidates = await prisma.event.findMany({
    where: {
      id: { not: eventId },
      status: { in: ["UPCOMING", "LIVE"] },
    },
    select: { id: true, eventDate: true, durationMinutes: true },
  });

  const overlappingIds = overlappingEventIds(event, overlappingCandidates);

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

  const orderId = generateOrderId();

  // Crea la reserva PENDING y aparta los asientos, todo o nada.
  let reservation;
  try {
    reservation = await prisma.$transaction(async (tx) => {
      const newReservation = await tx.reservation.create({
        data: {
          eventId,
          customerName,
          // La columna es NOT NULL y en este alcance no se pide email al cliente.
          customerEmail: "cliente@lounge.com",
          numberOfSeats: seatIds.length,
          totalPrice,
          seatPriceCents,
          managementFeeCents,
          status: "PENDING",
          paymentStatus: "PENDING",
          paymentId: orderId,
        },
      });

      // Solo aparta los que SIGUEN libres. Si otro cliente ha apartado alguno desde la
      // comprobación de arriba, Postgres espera a que su transacción termine, vuelve a
      // evaluar el `where` y ya no lo cuenta. Si falta uno, se deshace todo, reserva
      // incluida: nunca se cobra un asiento que no se ha podido apartar.
      const claimed = await tx.seatStatus.updateMany({
        where: { eventId, seatId: { in: seatIds }, status: "AVAILABLE" },
        data: { status: "RESERVED", reservationId: newReservation.id },
      });
      if (claimed.count !== seatIds.length) throw new SeatsTakenError();

      return newReservation;
    });
  } catch (error) {
    if (!(error instanceof SeatsTakenError)) throw error;
    return {
      success: false,
      error:
        (await unavailableSeatsError(eventId, seatIds)) ??
        "Alguno de los asientos ya no está disponible. Elige otros.",
    };
  }

  // Build Redsys signed redirect form
  const amountInCents = toRedsysAmount(totalCents);
  // Las vueltas de Redsys NO apuntan directamente a las páginas: pasan por una ruta
  // propia que acepta GET y POST. Las páginas son `page.tsx` y en el App Router un POST
  // contra ellas devuelve 405; si CaixaBank activa el envío de parámetros en las URLs de
  // respuesta, sin esta ruta se rompería la pantalla de todos los que acaban de pagar.
  // De paso, la ruta aprovecha esos parámetros para guardar el recibo.
  const okUrl = `${BASE_URL}/api/payments/return/${orderId}?r=ok`;
  const koUrl = `${BASE_URL}/api/payments/return/${orderId}?r=ko&eventId=${eventId}`;
  const notifyUrl = `${BASE_URL}/api/payments/notify`;

  const form = createRedirectForm({
    DS_MERCHANT_MERCHANTCODE: MERCHANT_CODE,
    DS_MERCHANT_TERMINAL: MERCHANT_TERMINAL,
    DS_MERCHANT_ORDER: orderId,
    DS_MERCHANT_AMOUNT: amountInCents,
    DS_MERCHANT_CURRENCY: "978", // EUR
    DS_MERCHANT_TRANSACTIONTYPE: "0", // Authorization
    // Solo tarjeta: sin este parámetro el TPV ofrece también Bizum. Ver lib/redsys.ts
    DS_MERCHANT_PAYMETHODS: PAY_METHODS,
    DS_MERCHANT_URLOK: okUrl,
    DS_MERCHANT_URLKO: koUrl,
    DS_MERCHANT_MERCHANTURL: notifyUrl,
    DS_MERCHANT_PRODUCTDESCRIPTION: PRODUCT_DESCRIPTION,
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

  await applyPaymentOutcome({ outcome: "ok", reservationId: reservation.id });

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

  await applyPaymentOutcome({
    outcome: "ko",
    reservationId: reservation.id,
    eventId: reservation.eventId,
    seatIds,
  });

  console.log(`[Payment] Reservation ${reservation.id} cancelled from error page`);
}

export async function getReservationByOrderId(
  orderId: string,
): Promise<ReservationTicketData | null> {
  const reservation = await prisma.reservation.findFirst({
    where: { paymentId: orderId },
    include: {
      event: {
        include: { homeTeam: true, awayTeam: true },
      },
      // Ordenado por código: sin este orderBy Postgres devuelve los asientos como
      // le viene, y el ticket puede listarlos salteados (P-B3 • T1-A1 • P-A2).
      seatStatuses: {
        include: { seat: true },
        orderBy: { seat: { code: "asc" } },
      },
    },
  });

  if (!reservation) return null;

  return {
    id: reservation.id,
    eventId: reservation.eventId,
    customerName: reservation.customerName,
    homeTeamName:
      reservation.event.homeTeam?.name ?? reservation.event.homeTeamName ?? "",
    awayTeamName:
      reservation.event.awayTeam?.name ?? reservation.event.awayTeamName ?? "",
    eventDate: reservation.event.eventDate.toISOString(),
    seats: reservation.seatStatuses.map((ss) => ({
      id: ss.seat.id,
      code: ss.seat.code,
    })),
    totalSeats: reservation.numberOfSeats,
    totalPrice: Number(reservation.totalPrice),
    // Del snapshot de la reserva, no del evento: el evento puede haber cambiado
    seatPriceCents: reservation.seatPriceCents,
    managementFeeCents: reservation.managementFeeCents,
    status: reservation.status,
    // Recibo: null mientras no haya llegado una notificación firmada de Redsys
    authorisationCode: reservation.authorisationCode,
    paymentDateTime: reservation.paymentDateTime,
    paymentResponseCode: reservation.paymentResponseCode,
  };
}
