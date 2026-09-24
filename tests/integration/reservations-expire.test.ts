/**
 * `expirePendingReservation`: la caducidad que comparten la página del evento y el cron.
 *
 * Los dos caminos que la llaman ya tienen sus tests (qué reservas eligen). Estos miran
 * la función en sí: la guarda de estado y el rastro que deja en los asientos (RCA-276).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Event, Seat } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { initializePayment } from "@/modules/payments/actions";
import { expirePendingReservation } from "@/modules/reservations/lib/expire";

import { freezeClock } from "../fixtures/clock";

import {
  makeEvent,
  makeReservation,
  makeSeatStatuses,
  makeSeats,
  seatStatesOf,
} from "../fixtures/factories";

let seats: Seat[];
let event: Event;

beforeEach(async () => {
  freezeClock();
  vi.spyOn(console, "log").mockImplementation(() => {});
  seats = await makeSeats(3);
  event = await makeEvent();
  await makeSeatStatuses(event.id, seats);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function statusOf(reservationId: string) {
  return (await prisma.reservation.findUniqueOrThrow({ where: { id: reservationId } }))
    .status;
}

describe("expirePendingReservation", () => {
  it("caduca la PENDING y deja sus asientos libres con el rastro de la reserva", async () => {
    const pending = await makeReservation({ event, seats: [seats[0], seats[1]] });

    expect(await expirePendingReservation(pending.id)).toBe(true);

    expect(await statusOf(pending.id)).toBe("EXPIRED");
    const states = await seatStatesOf(event.id);
    expect(states[seats[0].id]).toEqual({
      status: "AVAILABLE",
      reservationId: pending.id,
    });
    expect(states[seats[1].id]).toEqual({
      status: "AVAILABLE",
      reservationId: pending.id,
    });
    // Los que no eran suyos, intactos.
    expect(states[seats[2].id]).toEqual({ status: "AVAILABLE", reservationId: null });
  });

  it("no toca una reserva que el webhook ya ha confirmado", async () => {
    // Es la carrera que tenían las copias anteriores: leían la reserva PENDING, el
    // webhook la confirmaba, y la caducaban igual, soltando unos asientos ya pagados.
    const paid = await makeReservation({
      event,
      seats: [seats[0]],
      status: "CONFIRMED",
    });

    expect(await expirePendingReservation(paid.id)).toBe(false);

    expect(await statusOf(paid.id)).toBe("CONFIRMED");
    expect((await seatStatesOf(event.id))[seats[0].id]).toEqual({
      status: "OCCUPIED",
      reservationId: paid.id,
    });
  });

  it.each(["CANCELLED", "EXPIRED"] as const)("no toca una reserva %s", async (status) => {
    const other = await makeReservation({ event, seats: [seats[0]], status });
    const before = await seatStatesOf(event.id);

    expect(await expirePendingReservation(other.id)).toBe(false);

    expect(await statusOf(other.id)).toBe(status);
    expect(await seatStatesOf(event.id)).toEqual(before);
  });

  it("un asiento libre con rastro se puede volver a reservar, y el rastro pasa al nuevo", async () => {
    const stale = await makeReservation({ event, seats: [seats[0]] });
    await expirePendingReservation(stale.id);

    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id],
      customerName: "Luis",
    });

    expect(result.success).toBe(true);
    const next = await prisma.reservation.findFirstOrThrow({
      where: { customerName: "Luis" },
    });
    expect((await seatStatesOf(event.id))[seats[0].id]).toEqual({
      status: "RESERVED",
      reservationId: next.id,
    });
  });
});
