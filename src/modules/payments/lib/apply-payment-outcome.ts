import prisma from "@/lib/prisma";

import { reservationUpdateFor, seatUpdateFor } from "../domain/outcome";

/**
 * Aplica el resultado de un pago a la reserva y a sus asientos, en una transacción. 💰
 *
 * Era la misma transacción copiada en cuatro sitios: confirmar y cancelar desde las
 * páginas de vuelta, y el OK y el KO del webhook. El OK del webhook ya no pasa por aquí:
 * va por `settle-payment.ts`, que además sabe qué hacer con un pago que llega tarde.
 *
 * NO es una server action, y eso es deliberado, por lo mismo que `receipt.ts`: todo lo
 * exportado desde un fichero `"use server"` queda como endpoint invocable desde el
 * navegador, y esta función confirmaría cualquier reserva sin pago. Solo la llaman
 * caminos de servidor que ya han decidido que toca.
 *
 * Las guardas de estado NO están aquí: cada caller tiene la suya (ver domain/outcome.ts).
 * Y el recibo tampoco: `recordPaymentReceipt` va fuera de esta transacción, para que un
 * fallo al guardarlo no impida confirmar la reserva.
 */
export type SettlePayment =
  | { outcome: "ok"; reservationId: string }
  | { outcome: "ko"; reservationId: string; eventId: string; seatIds: string[] };

export async function applyPaymentOutcome(settle: SettlePayment): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (settle.outcome === "ok") {
      await tx.reservation.update({
        where: { id: settle.reservationId },
        data: reservationUpdateFor("ok", new Date()),
      });

      // Confirmar ocupa los asientos VINCULADOS a la reserva...
      await tx.seatStatus.updateMany({
        where: { reservationId: settle.reservationId },
        data: seatUpdateFor("ok"),
      });
    } else {
      await tx.reservation.update({
        where: { id: settle.reservationId },
        data: reservationUpdateFor("ko"),
      });

      // ...y cancelar libera por asiento y evento. Los dos `where` son distintos desde
      // siempre y se dejan así: en secuencia tocan las mismas filas, pero con
      // concurrencia no, y un refactor no cambia comportamiento (MASTER_IA, P3.3).
      await tx.seatStatus.updateMany({
        where: { seatId: { in: settle.seatIds }, eventId: settle.eventId },
        data: seatUpdateFor("ko"),
      });
    }
  });
}
