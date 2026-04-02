"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloorPlanMap } from "@/modules/seating/components/floor-plan-map";
import { useReservationStore } from "@/shared/hooks";
import { initializePayment } from "@/modules/payments/actions";
import { SEAT_PRICE } from "@/modules/events/types";
import { CompetitionEmblem } from "@/modules/events/components/competition-emblem";
import type { EventWithTeams } from "@/modules/events/types";
import type { SeatWithStatus } from "@/modules/seating/types";
import type { ZoneLabelConfig } from "@/modules/seating/constants";

interface EventReservationClientProps {
  event: EventWithTeams;
  seats: SeatWithStatus[];
  zoneLabels: ZoneLabelConfig[];
}

export function EventReservationClient({ event, seats, zoneLabels }: EventReservationClientProps) {
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
  const [showConditions, setShowConditions] = useState(true);
  const [isSpanish, setIsSpanish] = useState(true);
  const redsysFormRef = useRef<HTMLFormElement>(null);

  // Initialize store with event and seats data
  useEffect(() => {
    setEvent(event);
    setSeatsData(seats);

    return () => {
      clearSelection();
    };
  }, [event, seats, setEvent, setSeatsData, clearSelection]);

  // Detect browser language
  useEffect(() => {
    setIsSpanish(navigator.language.startsWith("es"));
  }, []);

  const eventDate = new Date(event.eventDate);
  const totalPrice = getTotalPrice();

  // Initialize payment: creates PENDING reservation and redirects to Redsys
  const handleReserve = async () => {
    if (selectedSeats.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await initializePayment({
        eventId: event.id,
        seatIds: selectedSeats,
        pricePerSeat: event.pricePerSeat ?? SEAT_PRICE,
      });

      if (!result.success || !result.redsysUrl || !result.formBody) {
        setError(result.error || "Error al iniciar el pago");
        setIsProcessing(false);
        return;
      }

      clearSelection();

      // Auto-submit the Redsys form to redirect to the payment gateway
      const form = redsysFormRef.current;
      if (!form) return;

      form.action = result.redsysUrl;
      (form.elements.namedItem("Ds_SignatureVersion") as HTMLInputElement).value =
        result.formBody.Ds_SignatureVersion;
      (form.elements.namedItem("Ds_MerchantParameters") as HTMLInputElement).value =
        result.formBody.Ds_MerchantParameters;
      (form.elements.namedItem("Ds_Signature") as HTMLInputElement).value =
        result.formBody.Ds_Signature;

      form.submit();
    } catch (err) {
      console.error("Error initiating payment:", err);
      setError("Error al procesar el pago");
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

  const conditions = isSpanish
    ? {
        title: "CONDICIONES DE LA RESERVA",
        items: [
          { text: "No se admiten cancelaciones", bold: null },
          { text: "Los asientos se liberarán 10 minutos después de la hora de inicio del evento (se exige puntualidad)", bold: null },
          { before: "El pago de la reserva supone un consumo mínimo que ", bold: "será descontado del importe del ticket final", after: "" },
          { text: "La reserva de los asientos es válida sólo durante la duración del evento", bold: null },
        ],
        accept: "Aceptar",
      }
    : {
        title: "RESERVATION CONDITIONS",
        items: [
          { text: "No cancellations accepted", bold: null },
          { text: "Seats will be released 10 minutes after the event start time (punctuality is required)", bold: null },
          { before: "The reservation payment represents a minimum consumption that ", bold: "will be deducted from the final ticket amount", after: "" },
          { text: "Seat reservation is only valid for the duration of the event", bold: null },
        ],
        accept: "Accept",
      };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Conditions modal */}
      {showConditions && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 px-5">
          <div className="bg-[#1a1a1a] rounded-2xl p-6 max-w-sm w-full border border-white/10">
            <h2 className="text-white font-bold text-sm tracking-widest text-center mb-5">
              {conditions.title}
            </h2>
            <ul className="space-y-3 mb-6">
              {conditions.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-white/70 text-sm leading-snug">
                  <span className="text-[#D4AF37] mt-0.5 shrink-0">•</span>
                  <span>
                    {"text" in item && item.text ? (
                      item.text
                    ) : (
                      <>
                        {(item as { before: string; bold: string; after: string }).before}
                        <strong className="text-white font-semibold">
                          {(item as { before: string; bold: string; after: string }).bold}
                        </strong>
                        {(item as { before: string; bold: string; after: string }).after}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              onClick={() => setShowConditions(false)}
              className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold"
            >
              {conditions.accept}
            </Button>
          </div>
        </div>
      )}

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
            <CompetitionEmblem competition={event.competition} className="mb-1" />
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

      {/* Hidden Redsys redirect form — auto-submitted on payment init */}
      <form ref={redsysFormRef} method="POST" style={{ display: "none" }}>
        <input type="hidden" name="Ds_SignatureVersion" />
        <input type="hidden" name="Ds_MerchantParameters" />
        <input type="hidden" name="Ds_Signature" />
      </form>
    </div>
  );
}
