"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloorPlanMap } from "@/modules/seating/components/floor-plan-map";
import { useRouter } from "next/navigation";
import { useReservationStore } from "@/shared/hooks";
import { createReservation } from "@/modules/reservations/actions";
import { SEAT_PRICE } from "@/modules/events/types";
import { COMPETITION_EMBLEM } from "@/modules/football-data/config/competitions";
import type { EventWithTeams } from "@/modules/events/types";
import type { SeatWithStatus } from "@/modules/seating/types";
import type { ZoneLabelConfig } from "@/modules/seating/constants";

interface EventReservationClientProps {
  event: EventWithTeams;
  seats: SeatWithStatus[];
  zoneLabels: ZoneLabelConfig[];
}

export function EventReservationClient({ event, seats, zoneLabels }: EventReservationClientProps) {
  const router = useRouter();
  const {
    selectedSeats,
    toggleSeat,
    clearSelection,
    setEvent,
    setSeatsData,
    getTotalPrice,
  } = useReservationStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize store with event and seats data
  useEffect(() => {
    setEvent(event);
    setSeatsData(seats);

    return () => {
      clearSelection();
    };
  }, [event, seats, setEvent, setSeatsData, clearSelection]);

  const eventDate = new Date(event.eventDate);
  const totalPrice = getTotalPrice();

  // Handle reservation and PDF generation
  const handleReserve = async () => {
    if (selectedSeats.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await createReservation({
        eventId: event.id,
        seatIds: selectedSeats,
        pricePerSeat: SEAT_PRICE,
      });

      if (!result.success || !result.reservation) {
        setError(result.error || "Error al crear la reserva");
        setIsProcessing(false);
        return;
      }

      const reservation = result.reservation;

      // Dynamically import jspdf (client-side only)
      const { jsPDF } = await import("jspdf");

      // Generate PDF - ticket format (80mm wide, variable height)
      const ticketWidth = 80; // mm
      const margin = 5;
      const contentWidth = ticketWidth - (margin * 2);

      // Calculate height based on content
      const baseHeight = 120; // Base height for header, event info, totals
      const seatsHeight = reservation.seats.length * 5; // 5mm per seat
      const ticketHeight = baseHeight + seatsHeight;

      const doc = new jsPDF({
        unit: "mm",
        format: [ticketWidth, ticketHeight],
      });

      let yPos = 8;

      // Header
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("THE LOUNGE", ticketWidth / 2, yPos, { align: "center" });
      yPos += 4;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("BEERHOUSE • VALENCIA", ticketWidth / 2, yPos, { align: "center" });

      yPos += 5;
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(margin, yPos, ticketWidth - margin, yPos);
      doc.setLineDashPattern([], 0);

      // Match info - centered and prominent
      yPos += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(reservation.homeTeamName, ticketWidth / 2, yPos, { align: "center" });
      yPos += 4;
      doc.setFontSize(8);
      doc.text("vs", ticketWidth / 2, yPos, { align: "center" });
      yPos += 4;
      doc.setFontSize(10);
      doc.text(reservation.awayTeamName, ticketWidth / 2, yPos, { align: "center" });

      // Date and time
      const reservationDate = new Date(reservation.eventDate);
      const formattedDate = format(reservationDate, "EEE d MMM yyyy", { locale: es });
      const formattedTime = format(reservationDate, "HH:mm");

      yPos += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`${formattedDate} • ${formattedTime}h`, ticketWidth / 2, yPos, { align: "center" });

      // Dashed line
      yPos += 5;
      doc.setLineDashPattern([1, 1], 0);
      doc.line(margin, yPos, ticketWidth - margin, yPos);
      doc.setLineDashPattern([], 0);

      // Reservation ID
      yPos += 5;
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`Reserva: ${reservation.id}`, ticketWidth / 2, yPos, { align: "center" });

      // Seats section
      yPos += 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("ASIENTOS", ticketWidth / 2, yPos, { align: "center" });

      yPos += 4;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");

      // Display seats in a compact way (multiple per line if possible)
      const seatCodes = reservation.seats.map(s => s.code);
      const seatsPerLine = 3;
      for (let i = 0; i < seatCodes.length; i += seatsPerLine) {
        const lineSeats = seatCodes.slice(i, i + seatsPerLine).join("  •  ");
        doc.text(lineSeats, ticketWidth / 2, yPos, { align: "center" });
        yPos += 5;
      }

      // Dashed line before totals
      yPos += 2;
      doc.setLineDashPattern([1, 1], 0);
      doc.line(margin, yPos, ticketWidth - margin, yPos);
      doc.setLineDashPattern([], 0);

      // Totals - prominent
      yPos += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`${reservation.totalSeats} asiento${reservation.totalSeats !== 1 ? "s" : ""}`, ticketWidth / 2, yPos, { align: "center" });

      yPos += 7;
      doc.setFontSize(14);
      doc.text(`TOTAL: ${reservation.totalPrice.toFixed(2).replace(".", ",")}€`, ticketWidth / 2, yPos, { align: "center" });

      // Footer
      yPos += 8;
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text("Gracias por tu reserva", ticketWidth / 2, yPos, { align: "center" });

      // Open PDF in new tab
      const pdfBlob = doc.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, "_blank");

      // Clear selection after successful reservation
      clearSelection();

      // Redirect to home page
      router.push("/");

    } catch (err) {
      console.error("Error processing reservation:", err);
      setError("Error al procesar la reserva");
    } finally {
      setIsProcessing(false);
    }
  };

  // Create short team code (e.g., "MCI vs LIV")
  const homeCode = event.homeTeam.shortName.substring(0, 3).toUpperCase();
  const awayCode = event.awayTeam.shortName.substring(0, 3).toUpperCase();
  const matchCode = `${homeCode} vs ${awayCode}`;

  // Format date: "Mié 15 Ene • 20:00"
  const dayName = format(eventDate, "EEE", { locale: es });
  const formattedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const dayNumber = format(eventDate, "d");
  const monthName = format(eventDate, "MMM", { locale: es });
  const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const time = format(eventDate, "HH:mm");
  const dateString = `${formattedDay} ${dayNumber} ${formattedMonth} • ${time}`;

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-4">
          {/* Left: Back button + team crests */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-1">
              {event.homeTeam.logo ? (
                <Image
                  src={event.homeTeam.logo}
                  alt={event.homeTeam.shortName}
                  width={36}
                  height={36}
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[8px] font-bold text-[#D4AF37]">
                  {event.homeTeam.shortName.substring(0, 3).toUpperCase()}
                </div>
              )}
              <span className="text-white/50 text-xs font-bold">vs</span>
              {event.awayTeam.logo ? (
                <Image
                  src={event.awayTeam.logo}
                  alt={event.awayTeam.shortName}
                  width={36}
                  height={36}
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[8px] font-bold text-[#D4AF37]">
                  {event.awayTeam.shortName.substring(0, 3).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Center: Competition emblem + Date and time */}
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            {event.competition && COMPETITION_EMBLEM[event.competition] && (
              <div className="bg-white/90 rounded-full p-0.5 mb-1">
                <Image
                  src={COMPETITION_EMBLEM[event.competition]}
                  alt={event.competition}
                  width={20}
                  height={20}
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
            <p className="text-white text-xs font-normal">{dateString}</p>
          </div>

          {/* Right: Reserve button */}
          <Button
            disabled={selectedSeats.length === 0 || isProcessing}
            onClick={handleReserve}
            className="bg-[#D4AF37] hover:bg-[#C5A028] text-black font-semibold px-5 py-1 text-base"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              "RESERVAR"
            )}
          </Button>
        </div>
      </header>

      {/* Floating seat count & price */}
      {selectedSeats.length > 0 && (
        <div className="fixed top-[72px] right-4 z-[100] bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-right shadow-lg">
          <p className="text-[10px] text-white/50 uppercase tracking-wide">
            {selectedSeats.length} asiento{selectedSeats.length !== 1 ? "s" : ""}
          </p>
          <p className="text-white font-bold">
            {totalPrice.toFixed(2).replace(".", ",")}€
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mx-4 mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      {/* Main Content - Floor Plan */}
      <main className="flex-1 px-4 py-4">
        <div className="max-w-md mx-auto">
          <FloorPlanMap
            seats={seats}
            selectedSeats={selectedSeats}
            onSeatSelect={toggleSeat}
            zoneLabels={zoneLabels}
          />
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
