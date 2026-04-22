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

  // In local development the webhook can't reach localhost, so auto-confirm as fallback.
  // In production/testing the webhook is the only source of truth — never trust this URL.
  if (process.env.NODE_ENV === "development") {
    await confirmReservationByOrderId(orderId);
  }

  const reservation = await getReservationByOrderId(orderId);

  if (!reservation || reservation.status !== "CONFIRMED") notFound();

  return <ConfirmationClient reservation={reservation} orderId={orderId} />;
}
