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

  // Auto-confirm when not in real payment mode (sandbox or local dev).
  // When REDSYS_ENV=production, the webhook is the sole source of truth.
  if (process.env.REDSYS_ENV !== "production") {
    await confirmReservationByOrderId(orderId);
  }

  const reservation = await getReservationByOrderId(orderId);

  if (!reservation || reservation.status !== "CONFIRMED") notFound();

  return <ConfirmationClient reservation={reservation} orderId={orderId} />;
}
