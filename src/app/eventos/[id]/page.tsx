import { notFound } from "next/navigation";
import { getEventById } from "@/modules/events/actions";
import { getSeatsForEvent, initializeSeatsForEvent, getZoneLabels } from "@/modules/seating/actions";
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

  // Initialize seats for this event if not already done
  await initializeSeatsForEvent(event.id);

  // Get seats with their status for this event and zone labels
  const [seats, zoneLabels] = await Promise.all([
    getSeatsForEvent(event.id),
    getZoneLabels(),
  ]);

  return (
    <EventReservationClient
      event={event}
      seats={seats}
      zoneLabels={zoneLabels}
    />
  );
}
