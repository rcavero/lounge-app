import prisma from "@/lib/prisma";

/**
 * Crea las filas de `SeatStatus` de un evento la primera vez que se abre su plano.
 * Idempotente: si ya hay alguna, no hace nada.
 *
 * NO es una server action, a propósito (RCA-286, R7): todo lo que exporta un fichero
 * `"use server"` es un endpoint que cualquiera puede llamar con los argumentos que
 * quiera. Solo la llama la página del evento, en el servidor, como
 * `payments/lib/return-pages.ts`.
 */
export async function initializeSeatsForEvent(eventId: string): Promise<void> {
  const existingCount = await prisma.seatStatus.count({
    where: { eventId },
  });

  if (existingCount > 0) {
    return; // Already initialized
  }

  const seats = await prisma.seat.findMany();

  await prisma.seatStatus.createMany({
    data: seats.map((seat) => ({
      eventId,
      seatId: seat.id,
      status: "AVAILABLE" as const,
    })),
  });
}
