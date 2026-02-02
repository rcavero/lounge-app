import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getEventsWithReservationCount,
  getPastEventsLast35Days,
  getAvailableReportMonths,
} from "@/modules/reservations/actions";
import { getSessionData } from "@/modules/auth/actions";
import { ReservasClient } from "./client";

export default async function AdminReservationsPage() {
  const [upcomingEvents, pastEvents, reportMonths, session] = await Promise.all([
    getEventsWithReservationCount(),
    getPastEventsLast35Days(),
    getAvailableReportMonths(),
    getSessionData(),
  ]);

  const isAdmin = session.role === "ADMIN";

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
        <ReservasClient
          upcomingEvents={upcomingEvents}
          pastEvents={pastEvents}
          reportMonths={reportMonths}
          isAdmin={isAdmin}
        />
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
