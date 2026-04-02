import { notFound } from "next/navigation";
import { getEventById } from "@/modules/events/actions";
import { getSeatsForEvent, getZoneLabels } from "@/modules/seating/actions";
import { BlockSeatsClient } from "./client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BlockSeatsPage({ params }: Props) {
  const { id } = await params;

  const [event, seats, zoneLabels] = await Promise.all([
    getEventById(id),
    getSeatsForEvent(id),
    getZoneLabels(),
  ]);

  if (!event) notFound();

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-white/10">
        <div className="px-4 py-3">
          <h1 className="text-white font-semibold text-sm">Bloquear asientos</h1>
          <p className="text-white/50 text-xs">
            {event.homeTeam?.shortName ?? event.homeTeamName ?? ""} vs {event.awayTeam?.shortName ?? event.awayTeamName ?? ""}
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <BlockSeatsClient eventId={id} seats={seats} zoneLabels={zoneLabels} />
        </div>
      </main>

      <footer className="py-4 text-center border-t border-white/10">
        <p className="text-xs text-white/40 tracking-wider">
          THE LOUNGE BEERHOUSE • VALENCIA
        </p>
      </footer>
    </div>
  );
}
