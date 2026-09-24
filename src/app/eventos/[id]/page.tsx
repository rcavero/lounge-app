import { notFound } from "next/navigation";
import { getEventById } from "@/modules/events/actions";
import {
  getSeatsForEvent,
  initializeSeatsForEvent,
  getZoneLabels,
} from "@/modules/seating/actions";
import { bookingClosedReason } from "@/modules/events/domain/booking-window";
import { BookingClosed } from "./booking-closed";
import { EventReservationClient } from "./client";

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;
  const event = await getEventById(id);

  if (!event) {
    notFound();
  }

  // Fuera de la ventana de 48 h – 4 h, o si el evento ya no está UPCOMING, no se enseña
  // el plano: antes se podía comprar entrando por enlace directo (RCA-277).
  const closedReason = bookingClosedReason(event, new Date());
  if (closedReason) {
    return <BookingClosed title={event.title} reason={closedReason} />;
  }

  // Initialize seats for this event if not already done
  await initializeSeatsForEvent(event.id);

  // Get seats with their status for this event and zone labels
  const [seats, zoneLabels] = await Promise.all([
    getSeatsForEvent(event.id),
    getZoneLabels(),
  ]);

  return <EventReservationClient event={event} seats={seats} zoneLabels={zoneLabels} />;
}
