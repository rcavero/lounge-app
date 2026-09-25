import { notFound } from "next/navigation";
import { getReservationByOrderId } from "@/modules/payments/actions";
import {
  confirmReservationByOrderId,
  hasReservationAccess,
} from "@/modules/payments/lib/return-pages";
import { MERCHANT_INFO } from "@/lib/redsys";
import { ConfirmationClient } from "./client";
import { ProcessingClient } from "./processing-client";
import { RefundNotice } from "./refund-notice";

interface Props {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ t?: string }>;
}

export default async function ConfirmationPage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const { t: token } = await searchParams;

  // Sin la llave de la reserva, la página no existe: el nº de pedido se adivina, y con
  // él se veía el ticket de otro (RCA-285). Antes que nada, también antes de confirmar.
  if (!(await hasReservationAccess(orderId, token))) notFound();

  // Fuera de producción, el webhook no llega y la página confirma. En producción esto no
  // hace nada: allí la única prueba del cobro es la notificación firmada de Redsys.
  await confirmReservationByOrderId(orderId);

  const reservation = await getReservationByOrderId(orderId, token);
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
  return <ProcessingClient orderId={orderId} token={token} merchant={MERCHANT_INFO} />;
}
