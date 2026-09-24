import { notFound } from "next/navigation";
import Link from "next/link";
import { LinkPendingIndicator, PRESSABLE } from "@/shared/components/link-pending";
import { ArrowLeft, ClipboardList, Lock } from "lucide-react";
import { formatEventDateMadrid } from "@/lib/utils";
import { getEventWithReservations } from "@/modules/reservations/actions";
import { displayCustomerName } from "@/modules/payments/lib/customer-name";
import { TeamLogo } from "@/modules/events/components/team-logo";
import { CompetitionEmblem } from "@/modules/events/components/competition-emblem";
import { getSportEmoji } from "@/modules/football-data/config/competitions";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ id: string }>;
}

// Get all active screens from event.screens field
function getActiveScreens(screens: string | null): string[] {
  if (!screens) return [];
  return screens.split(",").filter(Boolean);
}

const screenColors: Record<string, string> = {
  TV3: "bg-[#D4AF37] text-black",
  TV1: "bg-[#b91c1c] text-white",
  TV2: "bg-[#3b82f6] text-white",
};

export default async function EventReservationsPage({ params }: Props) {
  const { id } = await params;
  const event = await getEventWithReservations(id);

  if (!event) {
    notFound();
  }

  const eventDate = new Date(event.eventDate);
  const activeScreens = getActiveScreens(event.screens);
  const sportEmoji = getSportEmoji(event.competition);

  // Format date in Europe/Madrid (server runs in UTC in production)
  const { formattedDay, dayNumber, monthName, time } = formatEventDateMadrid(eventDate);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/reservas"
              className="text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-white font-semibold text-sm">Reservas del evento</h1>
              <p className="text-white/50 text-xs">
                {event.reservations.length} reserva
                {event.reservations.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Link href={`/admin/reservas/${id}/bloquear`}>
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 text-white/70 hover:text-white hover:bg-white/10"
            >
              <Lock className="w-4 h-4 mr-1.5" />
              Bloquear asientos
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Event Info Card */}
          <div className="bg-[#1a1a1a] rounded-2xl p-4 relative">
            <CompetitionEmblem
              competition={event.competition}
              className="absolute top-2 left-2"
            />
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
                <span className="text-white text-2xl font-bold">{time}</span>
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

          {/* Reservations List */}
          {event.reservations.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="w-12 h-12 text-white/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Sin reservas</h3>
              <p className="text-white/50 text-sm">
                Aún no hay reservas para este evento.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-white/70 text-xs font-medium uppercase tracking-wider">
                Listado de reservas
              </h2>
              {event.reservations.map((reservation) => {
                const seatCodes = reservation.seatStatuses
                  .map((ss) => ss.seat.code)
                  .join(", ");
                const totalPrice = Number(reservation.totalPrice);

                return (
                  <Link
                    key={reservation.id}
                    href={`/admin/reservas/${event.id}/${reservation.id}`}
                    className={`block relative ${PRESSABLE}`}
                  >
                    <div className="bg-[#1a1a1a] rounded-2xl p-4 hover:bg-[#222] transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        {/* min-w-0 + truncate: sin ellos un nombre de 24 caracteres
                            empuja el precio fuera de la tarjeta en móvil */}
                        <div className="min-w-0 pr-3">
                          <p className="text-white/50 text-[10px] uppercase tracking-wider">
                            Nombre / Alias
                          </p>
                          <p className="text-white text-sm font-semibold truncate">
                            {displayCustomerName(reservation.customerName)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white/50 text-[10px] uppercase tracking-wider">
                            Total
                          </p>
                          <p className="text-[#D4AF37] text-lg font-bold">
                            {totalPrice.toFixed(2).replace(".", ",")}€
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-white/10 pt-2 mt-2">
                        <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1">
                          {reservation.numberOfSeats} asiento
                          {reservation.numberOfSeats !== 1 ? "s" : ""}
                        </p>
                        <p className="text-white text-sm">{seatCodes}</p>
                      </div>
                    </div>
                    <LinkPendingIndicator className="top-auto bottom-2" />
                  </Link>
                );
              })}
            </div>
          )}
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
