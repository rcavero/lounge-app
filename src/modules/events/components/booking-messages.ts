import type { BookingClosedReason } from "../domain/booking-window";

/**
 * Por qué no se puede reservar, en los dos idiomas del cliente. Los usan el aviso de
 * la portada (`EventRow`) y la página del evento cuando se llega por enlace directo.
 */
export const BOOKING_CLOSED_MESSAGES: Record<
  "es" | "en",
  Record<BookingClosedReason, string>
> = {
  es: {
    "too-early": "Las reservas se desbloquearán 48 horas antes del evento",
    "too-late":
      "Se han cerrado las reservas para este evento porque faltan menos de 4 horas para su inicio",
    "not-upcoming": "Este evento ya no admite reservas",
  },
  en: {
    "too-early": "Reservations will open 48 hours before the event",
    "too-late":
      "Reservations for this event are closed because it starts in less than 4 hours",
    "not-upcoming": "This event is no longer taking reservations",
  },
};
