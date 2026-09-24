/**
 * Cuándo se puede reservar un evento: de 48 h antes a 4 h antes de su inicio, y solo si
 * sigue `UPCOMING`.
 *
 * Antes la ventana solo la aplicaba `EventRow` en la portada, con la cuenta escrita en
 * el componente. La página `/eventos/[id]` y `initializePayment` no la miraban, así que
 * por enlace directo se podía comprar un partido que empezaba en una hora, uno ya jugado
 * o uno cancelado (RCA-277). Ahora los tres leen de aquí.
 *
 * Módulo plano, sin `"use server"` ni Prisma. El reloj entra como parámetro.
 */

const HOUR_MS = 60 * 60 * 1000;

/** Las reservas se abren 48 h antes del inicio. A las 48 h justas ya están abiertas. */
export const BOOKING_OPENS_BEFORE_MS = 48 * HOUR_MS;

/** Y se cierran 4 h antes. A las 4 h justas todavía están abiertas. */
export const BOOKING_CLOSES_BEFORE_MS = 4 * HOUR_MS;

/** Por qué un evento no admite reservas; `null` si las admite. */
export type BookingClosedReason = "too-early" | "too-late" | "not-upcoming";

/**
 * Solo el reloj. Un evento que ya ha empezado está `too-late`: en la portada no se ve,
 * porque solo lista eventos futuros, pero por enlace directo sí se llega.
 */
export function bookingWindowReason(
  eventDate: Date,
  now: Date,
): "too-early" | "too-late" | null {
  const msUntilEvent = eventDate.getTime() - now.getTime();
  if (msUntilEvent > BOOKING_OPENS_BEFORE_MS) return "too-early";
  if (msUntilEvent < BOOKING_CLOSES_BEFORE_MS) return "too-late";
  return null;
}

/** El reloj y el estado: lo que exige el servidor antes de cobrar. */
export function bookingClosedReason(
  event: { eventDate: Date; status: string },
  now: Date,
): BookingClosedReason | null {
  if (event.status !== "UPCOMING") return "not-upcoming";
  return bookingWindowReason(event.eventDate, now);
}
