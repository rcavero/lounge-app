/**
 * Las reservas cobradas y anuladas en el panel (RCA-276): el aviso de «Pagos a
 * devolver» y el botón con el que el ADMIN lo marca como hecho.
 *
 * `requireAuth` y `requireAdmin` se mockean porque leen la cookie de sesión con
 * `next/headers`, que fuera de una petición de Next no existe.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Event, Reservation, Seat } from "@/generated/prisma";
import { requireAdmin, requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PAID_WITHOUT_SEATS } from "@/modules/payments/domain/outcome";
import {
  getPaymentsToRefund,
  markReservationRefunded,
} from "@/modules/reservations/actions";

import {
  makeEvent,
  makeReservation,
  makeSeatStatuses,
  makeSeats,
} from "../fixtures/factories";

vi.mock("@/lib/auth-guard", () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}));

let seats: Seat[];
let event: Event;

beforeEach(async () => {
  vi.mocked(requireAuth).mockResolvedValue(undefined);
  vi.mocked(requireAdmin).mockResolvedValue(undefined);

  seats = await makeSeats(3);
  event = await makeEvent();
  await makeSeatStatuses(event.id, seats);
});

afterEach(() => {
  vi.clearAllMocks();
});

/** Una reserva cobrada y anulada, como la deja el webhook. */
async function paidWithoutSeats(): Promise<Reservation> {
  const reservation = await makeReservation({ event, seats: [], status: "EXPIRED" });
  return prisma.reservation.update({
    where: { id: reservation.id },
    data: { ...PAID_WITHOUT_SEATS, authorisationCode: "U6N2PG" },
  });
}

describe("getPaymentsToRefund", () => {
  it("lista solo las cobradas y anuladas, con lo que hace falta para devolverlas", async () => {
    const toRefund = await paidWithoutSeats();
    // Ninguna de estas pide devolución.
    await makeReservation({ event, seats: [seats[0]], status: "CONFIRMED" });
    await makeReservation({ event, seats: [seats[1]], status: "CANCELLED" });
    await makeReservation({ event, seats: [seats[2]] });

    expect(await getPaymentsToRefund()).toEqual([
      {
        id: toRefund.id,
        paymentId: toRefund.paymentId,
        customerName: "Ana",
        totalPrice: 0,
        authorisationCode: "U6N2PG",
        paymentDateTime: null,
        eventTitle: event.title,
        eventDate: event.eventDate,
      },
    ]);
  });

  it("sin sesión lanza", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error("Unauthorized"));

    await expect(getPaymentsToRefund()).rejects.toThrow("Unauthorized");
  });
});

describe("markReservationRefunded", () => {
  it("pasa el pago a REFUNDED y la reserva deja de salir en el aviso", async () => {
    const reservation = await paidWithoutSeats();

    expect(await markReservationRefunded(reservation.id)).toEqual({ success: true });

    expect(
      await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } }),
    ).toMatchObject({ status: "CANCELLED", paymentStatus: "REFUNDED" });
    expect(await getPaymentsToRefund()).toEqual([]);
  });

  it("no sirve para anular una reserva confirmada", async () => {
    const paid = await makeReservation({ event, seats: [seats[0]], status: "CONFIRMED" });

    expect(await markReservationRefunded(paid.id)).toEqual({
      success: false,
      error: "Esta reserva no está pendiente de devolución",
    });
    expect(
      await prisma.reservation.findUniqueOrThrow({ where: { id: paid.id } }),
    ).toMatchObject({ status: "CONFIRMED", paymentStatus: "COMPLETED" });
  });

  it("un WORKER no puede marcarla: lanza antes de escribir", async () => {
    const reservation = await paidWithoutSeats();
    vi.mocked(requireAdmin).mockRejectedValueOnce(new Error("Forbidden"));

    await expect(markReservationRefunded(reservation.id)).rejects.toThrow("Forbidden");

    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } }))
        .paymentStatus,
    ).toBe("COMPLETED");
  });
});
