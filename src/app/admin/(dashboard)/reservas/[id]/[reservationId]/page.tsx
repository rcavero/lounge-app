import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatEventDateMadrid } from "@/lib/utils";
import { getReservationWithSeats } from "@/modules/reservations/actions";
import { getSeatsForEvent, getZoneLabels } from "@/modules/seating/actions";
import { TeamLogo } from "@/modules/events/components/team-logo";
import { CompetitionEmblem } from "@/modules/events/components/competition-emblem";
import { getSportEmoji } from "@/modules/football-data/config/competitions";
import { FloorPlanView } from "@/modules/seating/components/floor-plan-view";

interface Props {
  params: Promise<{ id: string; reservationId: string }>;
}

// Get all active screens from event.screens field
function getActiveScreens(screens: string | null): string[] {
  if (!screens) return [];
  return screens.split(",").filter(Boolean);
}

const screenColors: Record<string, string> = {
  PROYECTOR: "bg-[#D4AF37] text-black",
  TV1: "bg-[#b91c1c] text-white",
  TV2: "bg-[#3b82f6] text-white",
};

export default async function ReservationDetailPage({ params }: Props) {
  const { id: eventId, reservationId } = await params;
  const reservation = await getReservationWithSeats(reservationId);

  if (!reservation || reservation.event.id !== eventId) {
    notFound();
  }

  const event = reservation.event;
  const eventDate = new Date(event.eventDate);
  const activeScreens = getActiveScreens(event.screens);
  const sportEmoji = getSportEmoji(event.competition);

  // Get all seats with status for this event
  const seats = await getSeatsForEvent(eventId);
  const zoneLabels = await getZoneLabels();

  // Get the seat IDs for this reservation to highlight
  const highlightedSeatIds = reservation.seatStatuses.map((ss) => ss.seat.id);
  const seatCodes = reservation.seatStatuses.map((ss) => ss.seat.code).join(", ");
  const totalPrice = Number(reservation.totalPrice);

  // Format date in Europe/Madrid (server runs in UTC in production)
  const { formattedDay, dayNumber, monthName, time } =
    formatEventDateMadrid(eventDate);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/reservas/${eventId}`}
              className="text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-white font-semibold text-sm">Detalle de reserva</h1>
              <p className="text-white/50 text-xs font-mono">{reservation.id.slice(0, 16)}...</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Event Info Card */}
          <div className="bg-[#1a1a1a] rounded-2xl p-4 relative">
            <CompetitionEmblem competition={event.competition} className="absolute top-2 left-2" />
            <div className="flex items-center justify-between">
              {/* Home Team */}
              <div className="flex flex-col items-center w-20">
                <TeamLogo team={event.homeTeam} emoji={sportEmoji} size="lg" />
                <span className="text-[10px] text-white/70 mt-1 text-center line-clamp-1">
                  {event.homeTeam?.shortName ?? event.homeTeamName ?? ""}
                </span>
              </div>

              {/* Center - Date, Time & Screen */}
              <div className="flex flex-col items-center flex-1 px-2">
                <span className="text-white/80 text-xs font-medium">
                  {formattedDay} {dayNumber} {monthName}
                </span>
                <span className="text-white text-2xl font-bold">
                  {time}
                </span>
                <div className="flex gap-1 mt-1 flex-wrap justify-center">
                  {activeScreens.map((screen) => (
                    <span
                      key={screen}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${screenColors[screen]}`}
                    >
                      {screen}
                    </span>
                  ))}
                </div>
              </div>

              {/* Away Team */}
              <div className="flex flex-col items-center w-20">
                <TeamLogo team={event.awayTeam} emoji={sportEmoji} size="lg" />
                <span className="text-[10px] text-white/70 mt-1 text-center line-clamp-1">
                  {event.awayTeam?.shortName ?? event.awayTeamName ?? ""}
                </span>
              </div>
            </div>
          </div>

          {/* Reservation Summary Card */}
          <div className="bg-[#1a1a1a] rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-white/50 text-[10px] uppercase tracking-wider">
                  Asientos reservados
                </p>
                <p className="text-white text-lg font-bold">
                  {reservation.numberOfSeats}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white/50 text-[10px] uppercase tracking-wider">
                  Total pagado
                </p>
                <p className="text-[#D4AF37] text-lg font-bold">
                  {totalPrice.toFixed(2).replace(".", ",")}€
                </p>
              </div>
            </div>

            <div className="border-t border-white/10 pt-3">
              <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1">
                Códigos de asientos
              </p>
              <p className="text-white text-sm">
                {seatCodes}
              </p>
            </div>
          </div>

          {/* Floor Plan */}
          <div>
            <h2 className="text-white/70 text-xs font-medium uppercase tracking-wider mb-3">
              Ubicación en el local
            </h2>
            <FloorPlanView
              seats={seats}
              highlightedSeats={highlightedSeatIds}
              zoneLabels={zoneLabels}
            />
          </div>
        </div>
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
