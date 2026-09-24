import prisma from "@/lib/prisma";

/**
 * Caduca una reserva PENDING y suelta sus asientos. La llaman la página del evento, al
 * abrirse, y el cron de limpieza. Antes cada uno tenía su propia copia.
 *
 * Dos cosas que la distinguen de aquellas copias, las dos por RCA-276:
 *
 * 1. **Solo caduca si sigue `PENDING`.** Las copias leían las reservas pendientes y las
 *    marcaban `EXPIRED` después, sin volver a mirar. Si el webhook confirmaba el pago
 *    entre medias, una reserva pagada acababa `EXPIRED` y con sus asientos libres.
 *    Ahora el `where` lleva el estado: si el webhook ha llegado antes, no se toca nada.
 *
 * 2. **Los asientos quedan libres pero conservan el vínculo** (`reservationId`). Es el
 *    rastro que permite, si el pago llega tarde, recuperar esos mismos asientos si nadie
 *    los ha cogido (ver `payments/lib/settle-payment.ts`). El vínculo no hace que el
 *    asiento parezca ocupado: la disponibilidad se lee solo del `status`, y en cuanto
 *    otro cliente lo aparta, el vínculo pasa a ser el suyo.
 *
 * NO es una server action: soltaría los asientos de cualquier reserva.
 *
 * Devuelve si la ha caducado.
 */
export async function expirePendingReservation(reservationId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.reservation.updateMany({
      where: { id: reservationId, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    if (count === 0) return false;

    await tx.seatStatus.updateMany({
      where: { reservationId, status: "RESERVED" },
      data: { status: "AVAILABLE" },
    });
    return true;
  });
}
