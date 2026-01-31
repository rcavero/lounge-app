import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import { getEventsWithReservationCount } from "@/modules/reservations/actions";
import { EventRowWithBadge } from "@/modules/events/components/event-row-with-badge";

export default async function AdminReservationsPage() {
  const events = await getEventsWithReservationCount();

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-white font-semibold text-sm">Administrar Reservas</h1>
              <p className="text-white/50 text-xs">Selecciona un evento para ver sus reservas</p>
            </div>
          </div>
        </div>
      </header>

      {/* Events List */}
      <main className="flex-1 px-4 py-4">
        {events.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No hay eventos programados</h3>
            <p className="text-white/50">
              Crea un evento primero para poder gestionar reservas.
            </p>
          </div>
        ) : (
          <div className="max-w-lg mx-auto space-y-3">
            {events.map((event) => (
              <EventRowWithBadge key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center border-t border-white/10">
        <p className="text-xs text-white/40 tracking-wider">
          THE LOUNGE BEERHOUSE • VALENCIA
        </p>
      </footer>
    </div>
  );
}
