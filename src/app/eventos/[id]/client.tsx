"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEuros } from "@/lib/utils";
import { centsToEuros } from "@/modules/events/config/pricing";
import { FloorPlanMap } from "@/modules/seating/components/floor-plan-map";
import { useReservationStore } from "@/shared/hooks";
import { useIsSpanish } from "@/shared/hooks/use-is-spanish";
import { initializePayment } from "@/modules/payments/actions";
import {
  CUSTOMER_NAME_MAX_LENGTH,
  CUSTOMER_NAME_MIN_LENGTH,
  normalizeCustomerName,
  validateCustomerName,
} from "@/modules/payments/lib/customer-name";
import { CompetitionEmblem } from "@/modules/events/components/competition-emblem";
import { getSportEmoji, isMotorSport } from "@/modules/football-data/config/competitions";
import type { EventWithTeams } from "@/modules/events/types";
import type { SeatWithStatus } from "@/modules/seating/types";
import type { ZoneLabelConfig } from "@/modules/seating/constants";

/** El nombre se precarga en la siguiente reserva: casi siempre reserva la misma persona. */
const CUSTOMER_NAME_STORAGE_KEY = "lounge:customerName";

interface EventReservationClientProps {
  event: EventWithTeams;
  seats: SeatWithStatus[];
  zoneLabels: ZoneLabelConfig[];
}

export function EventReservationClient({
  event,
  seats,
  zoneLabels,
}: EventReservationClientProps) {
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
  const [showNameModal, setShowNameModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const isSpanish = useIsSpanish();
  const redsysFormRef = useRef<HTMLFormElement>(null);

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

  const nameModal = isSpanish
    ? {
        title: "NOMBRE o ALIAS de la reserva",
        seat: "asiento",
        seats: "asientos",
        placeholder: "Ej.: Ramón",
        help: "Lo usaremos para localizar tu reserva en el local.",
        pay: "PAGAR",
        processing: "Procesando...",
        cancel: "Cancelar",
        errors: {
          length: "Escribe entre 2 y 24 caracteres.",
          chars: "Usa solo letras, números, espacios y . ' -",
        },
      }
    : {
        title: "NAME or NICKNAME for the booking",
        seat: "seat",
        seats: "seats",
        placeholder: "e.g. Ramon",
        help: "We'll use it to find your booking at the venue.",
        pay: "PAY",
        processing: "Processing...",
        cancel: "Cancel",
        errors: {
          length: "Enter between 2 and 24 characters.",
          chars: "Use only letters, numbers, spaces and . ' -",
        },
      };

  // RESERVAR ya no paga: abre el modal que pide el nombre. El cobro sale de ahí.
  const openNameModal = () => {
    if (selectedSeats.length === 0) return;

    setError(null);
    setNameError(null);

    // Dentro del handler, nunca en render: leer localStorage al renderizar rompe el SSR.
    try {
      const saved = localStorage.getItem(CUSTOMER_NAME_STORAGE_KEY);
      if (saved) setCustomerName(saved);
    } catch {
      // Safari en modo privado lanza al tocar localStorage
    }

    setShowNameModal(true);
  };

  // Initialize payment: creates PENDING reservation and redirects to Redsys
  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSeats.length === 0) return;

    const name = normalizeCustomerName(customerName);
    const invalid = validateCustomerName(name);
    if (invalid) {
      setNameError(nameModal.errors[invalid]);
      return;
    }

    setIsProcessing(true);
    setNameError(null);
    setError(null);

    try {
      const result = await initializePayment({
        eventId: event.id,
        seatIds: selectedSeats,
        customerName: name,
      });

      if (!result.success || !result.redsysUrl || !result.formBody) {
        // Dentro del modal: el banner de error de la página queda tapado por el overlay.
        setNameError(result.error || "Error al iniciar el pago");
        setIsProcessing(false);
        return;
      }

      try {
        localStorage.setItem(CUSTOMER_NAME_STORAGE_KEY, name);
      } catch {
        // Igual que arriba: no es crítico si no se puede guardar
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
      setNameError("Error al procesar el pago");
      setIsProcessing(false);
    }
  };

  // Manual sport helpers
  const sportEmoji = getSportEmoji(event.competition);
  const isMotor = isMotorSport(event.competition);

  // Create short team code (e.g., "MCI vs LIV")
  const homeShort = event.homeTeam?.shortName ?? event.homeTeamName ?? "";
  const awayShort = event.awayTeam?.shortName ?? event.awayTeamName ?? "";
  const homeCode = homeShort.substring(0, 3).toUpperCase();
  const awayCode = awayShort.substring(0, 3).toUpperCase();

  // Format date: "Mié 15 Ene • 20:00"
  const dayName = format(eventDate, "EEE", { locale: es });
  const formattedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const dayNumber = format(eventDate, "d");
  const monthName = format(eventDate, "MMM", { locale: es });
  const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const time = format(eventDate, "HH:mm");
  const dateString = `${formattedDay} ${dayNumber} ${formattedMonth} • ${time}`;

  // Gastos de gestión del evento. Con 0 € el punto 3 se queda EXACTAMENTE como estaba:
  // "excepto los gastos de gestión de 0€/asiento" no tendría ningún sentido.
  const feeCents = event.managementFeeCents;
  const feeSuffixEs =
    feeCents > 0
      ? `, excepto los gastos de gestión de ${formatEuros(centsToEuros(feeCents))}€/asiento`
      : "";
  const feeSuffixEn =
    feeCents > 0
      ? `, excluding the ${centsToEuros(feeCents).toFixed(2)}€/seat management fee`
      : "";

  const conditions = isSpanish
    ? {
        title: "CONDICIONES DE LA RESERVA",
        items: [
          { text: "No se admiten cancelaciones", bold: null },
          {
            text: "Los asientos se liberarán 10 minutos después de la hora de inicio del evento (se exige puntualidad)",
            bold: null,
          },
          {
            before: "El pago de la reserva supone un consumo mínimo que ",
            bold: "será descontado del importe del ticket final",
            after: feeSuffixEs,
          },
          {
            text: "La reserva de los asientos es válida sólo durante la duración del evento",
            bold: null,
          },
        ],
        accept: "Aceptar",
      }
    : {
        title: "RESERVATION CONDITIONS",
        items: [
          { text: "No cancellations accepted", bold: null },
          {
            text: "Seats will be released 10 minutes after the event start time (punctuality is required)",
            bold: null,
          },
          {
            before: "The reservation payment represents a minimum consumption that ",
            bold: "will be deducted from the final ticket amount",
            after: feeSuffixEn,
          },
          {
            text: "Seat reservation is only valid for the duration of the event",
            bold: null,
          },
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
              data-testid="conditions-accept"
              onClick={() => setShowConditions(false)}
              className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold"
            >
              {conditions.accept}
            </Button>
          </div>
        </div>
      )}

      {/* Name modal - se abre al pulsar RESERVAR, antes de ir a la pasarela */}
      {showNameModal && (
        <div
          data-testid="name-modal"
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 px-5"
        >
          <div className="bg-[#1a1a1a] rounded-2xl p-6 max-w-sm w-full border border-white/10">
            <h2 className="text-white font-bold text-sm tracking-widest text-center mb-2">
              {nameModal.title}
            </h2>
            <p className="text-white/50 text-xs text-center mb-5">
              {selectedSeats.length}{" "}
              {selectedSeats.length === 1 ? nameModal.seat : nameModal.seats}
              {" · "}
              {formatEuros(totalPrice)}€
            </p>

            {/* El <form> es lo que hace que Enter funcione en el teclado del movil */}
            <form onSubmit={handleReserve}>
              <input
                data-testid="customer-name-input"
                type="text"
                autoFocus
                autoComplete="name"
                enterKeyHint="go"
                maxLength={CUSTOMER_NAME_MAX_LENGTH}
                disabled={isProcessing}
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setNameError(null);
                }}
                placeholder={nameModal.placeholder}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-white/30 focus:border-[#D4AF37] outline-none disabled:opacity-50"
              />

              {nameError && (
                <p data-testid="name-error" className="text-red-400 text-xs mt-2">
                  {nameError}
                </p>
              )}

              <p className="text-white/40 text-[11px] mt-2 mb-5">{nameModal.help}</p>

              <Button
                data-testid="pay-button"
                type="submit"
                disabled={
                  isProcessing ||
                  normalizeCustomerName(customerName).length < CUSTOMER_NAME_MIN_LENGTH
                }
                className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {nameModal.processing}
                  </>
                ) : (
                  nameModal.pay
                )}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setShowNameModal(false)}
              disabled={isProcessing}
              className="w-full text-white/40 text-xs mt-3 hover:text-white/70 disabled:opacity-40"
            >
              {nameModal.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-4">
          {/* Left: Back button + team crests */}
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/70 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-1">
              {sportEmoji ? (
                <span className="text-2xl leading-none">{sportEmoji}</span>
              ) : event.homeTeam?.logo ? (
                <Image
                  src={event.homeTeam.logo}
                  alt={homeShort}
                  width={36}
                  height={36}
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[8px] font-bold text-[#D4AF37]">
                  {homeCode}
                </div>
              )}
              {!isMotor && (
                <>
                  <span className="text-white/50 text-xs font-bold">vs</span>
                  {event.awayTeam?.logo ? (
                    <Image
                      src={event.awayTeam.logo}
                      alt={awayShort}
                      width={36}
                      height={36}
                      className="object-contain"
                      unoptimized
                    />
                  ) : sportEmoji ? (
                    <span className="text-2xl leading-none">{sportEmoji}</span>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[8px] font-bold text-[#D4AF37]">
                      {awayCode}
                    </div>
                  )}
                </>
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
            data-testid="reserve-button"
            disabled={selectedSeats.length === 0}
            onClick={openNameModal}
            className="bg-[#D4AF37] hover:bg-[#C5A028] text-black font-semibold px-5 py-1 text-base"
          >
            RESERVAR
          </Button>
        </div>
      </header>

      {/* Floating seat count & price */}
      {selectedSeats.length > 0 && (
        <div className="fixed top-[72px] right-4 z-[100] bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-right shadow-lg">
          <p className="text-[10px] text-white/50 uppercase tracking-wide">
            {selectedSeats.length} asiento{selectedSeats.length !== 1 ? "s" : ""}
          </p>
          <p data-testid="selection-total" className="text-white font-bold">
            {formatEuros(totalPrice)}€
          </p>
          {feeCents > 0 && (
            <p className="text-[9px] text-white/40 leading-tight">
              {isSpanish ? "gastos de gestión incl." : "management fee incl."}
            </p>
          )}
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
