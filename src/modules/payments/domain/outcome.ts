/**
 * Qué estados deja un pago según su resultado. 💰
 *
 * | Resultado | Reserva                               | Asientos                          |
 * |-----------|---------------------------------------|-----------------------------------|
 * | `ok`      | `CONFIRMED`, `COMPLETED`, confirmedAt | `OCCUPIED`, siguen vinculados     |
 * | `ko`      | `CANCELLED`, `FAILED`                 | `AVAILABLE`, vínculo a `null`     |
 *
 * Solo decide **qué** se escribe. **Si** se escribe lo decide cada caller, y a propósito
 * no aquí: son tres guardas distintas. La página de OK solo confirma `PENDING`; la de KO
 * no cancela una `CONFIRMED`; el webhook actúa sin filtro de estado. Meter aquí una
 * regla como "un KO sobre una CONFIRMED no hace nada" cambiaría lo que hace el webhook.
 *
 * Módulo plano, sin `"use server"` ni Prisma.
 */

export type PaymentOutcome = "ok" | "ko";

export function reservationUpdateFor(
  outcome: "ok",
  now: Date,
): {
  status: "CONFIRMED";
  paymentStatus: "COMPLETED";
  confirmedAt: Date;
};
export function reservationUpdateFor(outcome: "ko"): {
  status: "CANCELLED";
  paymentStatus: "FAILED";
};
export function reservationUpdateFor(outcome: PaymentOutcome, now?: Date) {
  return outcome === "ok"
    ? { status: "CONFIRMED", paymentStatus: "COMPLETED", confirmedAt: now }
    : { status: "CANCELLED", paymentStatus: "FAILED" };
}

/**
 * Una reserva **cobrada y anulada** (RCA-276). El banco autorizó el pago, pero la
 * reserva ya había caducado y sus asientos no se pudieron recuperar: hay que devolver
 * el dinero. No es un estado nuevo en el esquema, sino una combinación que ningún otro
 * camino produce: `CANCELLED` con el pago `COMPLETED`. Cuando el bar hace la devolución
 * en el portal de Redsys, el pago pasa a `REFUNDED`.
 */
export const PAID_WITHOUT_SEATS = {
  status: "CANCELLED",
  paymentStatus: "COMPLETED",
} as const;

/** ¿Hay que devolver el dinero de esta reserva? */
export function needsRefund(reservation: {
  status: string;
  paymentStatus: string;
}): boolean {
  return (
    reservation.status === PAID_WITHOUT_SEATS.status &&
    reservation.paymentStatus === PAID_WITHOUT_SEATS.paymentStatus
  );
}

export function seatUpdateFor(outcome: "ok"): { status: "OCCUPIED" };
export function seatUpdateFor(outcome: "ko"): {
  status: "AVAILABLE";
  reservationId: null;
};
export function seatUpdateFor(outcome: PaymentOutcome) {
  return outcome === "ok"
    ? { status: "OCCUPIED" }
    : { status: "AVAILABLE", reservationId: null };
}
