"use client";

import Link from "next/link";
import { Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BOOKING_CLOSED_MESSAGES } from "@/modules/events/components/booking-messages";
import type { BookingClosedReason } from "@/modules/events/domain/booking-window";
import { useIsSpanish } from "@/shared/hooks/use-is-spanish";

/**
 * Lo que ve quien entra por enlace directo a un evento que no admite reservas. Antes
 * veía el plano y podía pagar (RCA-277). El servidor lo rechazaría igual al pagar; esto
 * evita que el cliente elija asientos para nada.
 */
export function BookingClosed({
  title,
  reason,
}: {
  title: string;
  reason: BookingClosedReason;
}) {
  const isSpanish = useIsSpanish();
  const Icon = reason === "too-early" ? Clock : Lock;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div data-testid="booking-closed" className="max-w-sm w-full space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <Icon className="w-14 h-14 text-[#D4AF37]" />
          <h1 className="text-white text-xl font-bold tracking-tight">{title}</h1>
          <p className="text-white/60 text-sm">
            {BOOKING_CLOSED_MESSAGES[isSpanish ? "es" : "en"][reason]}
          </p>
        </div>

        <Link href="/" className="block">
          <Button className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold">
            {isSpanish ? "Ver otros eventos" : "See other events"}
          </Button>
        </Link>
      </div>
    </div>
  );
}
