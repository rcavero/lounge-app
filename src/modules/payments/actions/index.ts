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
import { BOOKING_CLOSED_MESSAGES } from "@/modules/events/components/booking-messages";
import { bookingClosedReason } from "@/modules/events/domain/booking-window";
import { overlappingEventIds } from "@/modules/events/domain/overlap";
import { computeReservationAmount, toRedsysAmount } from "../domain/amount";
import { needsRefund } from "../domain/outcome";
import { accessTokenMatches, newAccessToken } from "../lib/access-token";
import { normalizeCustomerName, validateCustomerName } from "../lib/customer-name";
import type { InitializePaymentResult, ReservationTicketData } from "../types";

/** Algún asiento pedido no se ha podido apartar dentro de la transacción. */
class SeatsTakenError extends Error {}

/** El mensaje de error si alguno de los asientos no existe o no está libre en este evento. */
async function unavailableSeatsError(
  eventId: string,
  seatIds: string[],
): Promise<string | null> {
  const seatStatuses = await prisma.seatStatus.findMany({
    where: { eventId, seatId: { in: seatIds } },
    include: { seat: true },
  });

  // Uno que no existe en este evento se cobraría sin apartar nada (RCA-277).
  if (seatStatuses.length !== seatIds.length) {
    return "Alguno de los asientos no existe en este evento";
  }

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

  // La interfaz no lo permite, pero esto es un endpoint público: un asiento repetido se
  // cobraría dos veces (RCA-277).
  if (new Set(seatIds).size !== seatIds.length) {
    return { success: false, error: "Hay asientos repetidos en la selección" };
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

  // La ventana de 48 h – 4 h y el estado del evento. Antes solo los miraba la portada,
  // y por enlace directo se compraba un partido que empezaba en una hora (RCA-277).
  const closedReason = bookingClosedReason(event, new Date());
  if (closedReason) {
    return { success: false, error: BOOKING_CLOSED_MESSAGES.es[closedReason] };
  }

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
  // La llave de las páginas de vuelta: el nº de pedido se adivina, esta no (RCA-285).
  const accessToken = newAccessToken();

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
          accessToken,
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
  // Las dos llevan la llave de la reserva: es el único camino por el que llega al
  // cliente, y sin ella las páginas no enseñan ni cancelan nada (RCA-285).
  const okUrl = `${BASE_URL}/api/payments/return/${orderId}?r=ok&t=${accessToken}`;
  const koUrl = `${BASE_URL}/api/payments/return/${orderId}?r=ko&eventId=${eventId}&t=${accessToken}`;
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

/**
 * El ticket de una reserva. Es pública —la llama el sondeo de la página de confirmación—,
 * así que exige la llave de la reserva: con el nº de pedido solo, que se adivina, se
 * leía el ticket de cualquiera (RCA-285). Sin la llave, `null`, igual que un pedido que
 * no existe, para no confirmar que existe.
 */
export async function getReservationByOrderId(
  orderId: string,
  token?: string | null,
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

  if (!reservation || !accessTokenMatches(reservation.accessToken, token)) return null;

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
    needsRefund: needsRefund(reservation),
    // Recibo: null mientras no haya llegado una notificación firmada de Redsys
    authorisationCode: reservation.authorisationCode,
    paymentDateTime: reservation.paymentDateTime,
    paymentResponseCode: reservation.paymentResponseCode,
  };
}
