import { notFound } from "next/navigation";
import {
  confirmReservationByOrderId,
  getReservationByOrderId,
} from "@/modules/payments/actions";
import { MERCHANT_INFO } from "@/lib/redsys";
import { ConfirmationClient } from "./client";
import { ProcessingClient } from "./processing-client";
import { RefundNotice } from "./refund-notice";

interface Props {
  params: Promise<{ orderId: string }>;
}

export default async function ConfirmationPage({ params }: Props) {
  const { orderId } = await params;

  // Auto-confirm when not in real payment mode (sandbox or local dev).
  // When REDSYS_ENV=production, the webhook is the sole source of truth.
  if (process.env.REDSYS_ENV !== "production") {
    await confirmReservationByOrderId(orderId);
  }

  const reservation = await getReservationByOrderId(orderId);

  // Unknown order — genuinely invalid URL.
  if (!reservation) notFound();

  // Already confirmed (sandbox auto-confirm, or the webhook already arrived).
  if (reservation.status === "CONFIRMED") {
    return (
      <ConfirmationClient
        reservation={reservation}
        orderId={orderId}
        merchant={MERCHANT_INFO}
      />
    );
  }

  // Cobrada y anulada: el pago llegó tarde y sus asientos ya eran de otro (RCA-276).
  if (reservation.needsRefund) return <RefundNotice orderId={orderId} />;

  // In production the browser can reach this page before the Redsys webhook
  // confirms the reservation. Poll for the webhook instead of showing a 404.
  return <ProcessingClient orderId={orderId} merchant={MERCHANT_INFO} />;
}
