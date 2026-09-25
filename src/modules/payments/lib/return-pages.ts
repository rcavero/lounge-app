import prisma from "@/lib/prisma";

import { accessTokenMatches } from "./access-token";
import { applyPaymentOutcome } from "./apply-payment-outcome";

/**
 * Lo que hacen las páginas de vuelta del pago (`/reserva/confirmacion` y `/reserva/error`)
 * antes de pintar nada. 💰
 *
 * NO son server actions, y eso es deliberado (RCA-285): todo lo exportado desde un
 * fichero `"use server"` es un endpoint que se puede llamar desde el navegador con los
 * argumentos que quiera quien llame. Antes vivían en `payments/actions`, y la guarda de
 * «en producción solo confirma el webhook» estaba en la página, no en la función. Aquí
 * solo las llaman las páginas, que antes han comprobado la llave con
 * `hasReservationAccess`.
 */

/** ¿Abre `token` la reserva del pedido `orderId`? Un pedido que no existe, no. */
export async function hasReservationAccess(
  orderId: string,
  token: string | null | undefined,
): Promise<boolean> {
  const reservation = await prisma.reservation.findFirst({
    where: { paymentId: orderId },
    select: { accessToken: true },
  });
  return reservation !== null && accessTokenMatches(reservation.accessToken, token);
}

/**
 * El respaldo de la página de OK cuando el webhook no llega, que en local y en testing
 * es siempre. **En producción no hace nada**: allí la única prueba de que se ha cobrado
 * es la notificación firmada de Redsys, y la página espera a que llegue.
 *
 * Solo actúa sobre reservas `PENDING`: si el webhook ya actuó, no toca nada.
 */
export async function confirmReservationByOrderId(orderId: string): Promise<void> {
  if (process.env.REDSYS_ENV === "production") return;

  const reservation = await prisma.reservation.findFirst({
    where: { paymentId: orderId, status: "PENDING" },
    select: { id: true },
  });
  if (!reservation) return;

  await applyPaymentOutcome({ outcome: "ok", reservationId: reservation.id });

  console.log(`[Payment] Reservation ${reservation.id} confirmed from success page`);
}

/**
 * El respaldo de la página de KO: libera los asientos si el webhook no lo ha hecho. Sale
 * si la reserva ya está `CONFIRMED`: el pago manda.
 */
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

  if (!reservation || reservation.status === "CONFIRMED") return;

  await applyPaymentOutcome({
    outcome: "ko",
    reservationId: reservation.id,
    eventId: reservation.eventId,
    seatIds: reservation.seatStatuses.map((ss) => ss.seatId),
  });

  console.log(`[Payment] Reservation ${reservation.id} cancelled from error page`);
}
