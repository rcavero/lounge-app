"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getReservationByOrderId } from "@/modules/payments/actions";
import type { ReservationTicketData } from "@/modules/payments/types";
import type { MerchantInfo } from "@/lib/redsys";
import { ConfirmationClient } from "./client";
import { RefundNotice } from "./refund-notice";

const POLL_INTERVAL_MS = 2500;
const MAX_ATTEMPTS = 16; // ~40s waiting for the Redsys webhook

interface Props {
  orderId: string;
  /** Datos del comercio para el recibo: solo se leen en el servidor. */
  merchant: MerchantInfo;
}

type PollState =
  | { phase: "polling" }
  | { phase: "confirmed"; reservation: ReservationTicketData }
  | { phase: "failed"; eventId: string | null }
  | { phase: "refund" }
  | { phase: "timeout" };

export function ProcessingClient({ orderId, merchant }: Props) {
  const [state, setState] = useState<PollState>({ phase: "polling" });

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      attempts += 1;

      let reservation: ReservationTicketData | null = null;
      try {
        reservation = await getReservationByOrderId(orderId);
      } catch {
        // Transient network error — retry until attempts run out
      }
      if (cancelled) return;

      if (reservation?.status === "CONFIRMED") {
        setState({ phase: "confirmed", reservation });
        return;
      }

      // Antes que el fallo: también es CANCELLED, pero aquí sí se ha cobrado.
      if (reservation?.needsRefund) {
        setState({ phase: "refund" });
        return;
      }

      if (reservation?.status === "CANCELLED" || reservation?.status === "EXPIRED") {
        setState({ phase: "failed", eventId: reservation.eventId });
        return;
      }

      if (attempts >= MAX_ATTEMPTS) {
        setState({ phase: "timeout" });
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId]);

  if (state.phase === "confirmed") {
    return (
      <ConfirmationClient
        reservation={state.reservation}
        orderId={orderId}
        merchant={merchant}
      />
    );
  }

  if (state.phase === "refund") {
    return <RefundNotice orderId={orderId} />;
  }

  if (state.phase === "failed") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full space-y-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <XCircle className="w-16 h-16 text-red-500" />
            <h1 className="text-white text-2xl font-bold tracking-tight">
              Pago no completado
            </h1>
            <p className="text-white/50 text-sm">
              No se ha podido confirmar el pago. Los asientos han sido liberados.
            </p>
          </div>

          <div className="space-y-3">
            {state.eventId && (
              <Link href={`/eventos/${state.eventId}`} className="block">
                <Button className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold">
                  Volver a seleccionar asientos
                </Button>
              </Link>
            )}
            <Link href="/" className="block">
              <Button
                variant="outline"
                className="w-full border-white/20 text-white/70 hover:text-white hover:bg-white/10"
              >
                Ir al inicio
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === "timeout") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full space-y-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <Clock className="w-16 h-16 text-[#D4AF37]" />
            <h1 className="text-white text-2xl font-bold tracking-tight">
              Estamos confirmando tu pago
            </h1>
            <p className="text-white/50 text-sm">
              Si has completado el pago, tu reserva se confirmará en unos minutos. Guarda
              este código de pedido:
            </p>
            <p className="text-[#D4AF37] font-mono text-lg font-bold">{orderId}</p>
          </div>

          <div className="bg-[#1a1a1a] rounded-xl p-4 text-left border border-white/10">
            <p className="text-white/50 text-xs mb-2">¿Tienes dudas?</p>
            <p className="text-white/70 text-sm">
              Contacta con nosotros por WhatsApp al{" "}
              <a
                href="https://wa.me/34640873444"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#D4AF37] font-bold hover:underline"
              >
                +34 640 87 34 44
              </a>
            </p>
          </div>

          <Link href="/" className="block">
            <Button
              variant="outline"
              className="w-full border-white/20 text-white/70 hover:text-white hover:bg-white/10"
            >
              Ir al inicio
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-16 h-16 text-[#D4AF37] animate-spin" />
          <h1 className="text-white text-2xl font-bold tracking-tight">
            Procesando tu pago
          </h1>
          <p className="text-white/50 text-sm">
            Estamos confirmando tu reserva con el banco. Esto puede tardar unos segundos.
            <br />
            No cierres ni recargues esta ventana.
          </p>
        </div>
      </div>
    </div>
  );
}
