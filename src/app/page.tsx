import { getUpcomingEvents } from "@/modules/events/actions";
import { EventRow } from "@/modules/events/components/event-row";
import { Logo } from "@/shared/components/logo";
import { Calendar } from "lucide-react";

export default async function HomePage() {
  const events = await getUpcomingEvents();

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header with Logo */}
      <header className="py-6 flex justify-center">
        <Logo size="lg" />
      </header>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-lg font-medium tracking-widest text-white/90">
          RESERVA TU ASIENTO
        </h1>
      </div>

      {/* Events List */}
      <main className="flex-1 px-4 pb-8">
        {events.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No hay eventos programados</h3>
            <p className="text-muted-foreground">
              Vuelve pronto para ver los proximos partidos disponibles.
            </p>
          </div>
        ) : (
          <div className="max-w-md mx-auto space-y-3">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center">
        <p className="text-xs text-white/40 tracking-wider">
          THE LOUNGE BEERHOUSE • VALENCIA
        </p>
      </footer>
    </div>
  );
}
