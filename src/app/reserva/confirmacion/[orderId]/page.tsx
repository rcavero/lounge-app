import { notFound } from "next/navigation";
import {
  confirmReservationByOrderId,
  getReservationByOrderId,
} from "@/modules/payments/actions";
import { ConfirmationClient } from "./client";

interface Props {
  params: Promise<{ orderId: string }>;
}

export default async function ConfirmationPage({ params }: Props) {
  const { orderId } = await params;

  // Confirm the reservation when the user arrives here.
  // Redsys only redirects to this URL on successful payment, so it is safe to trust it.
  // In production the webhook will have already confirmed it, making this a no-op.
  // In local development the webhook can't reach localhost, so this is the fallback.
  await confirmReservationByOrderId(orderId);

  const reservation = await getReservationByOrderId(orderId);
  if (!reservation) notFound();

  return <ConfirmationClient reservation={reservation} orderId={orderId} />;
}
