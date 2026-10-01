/**
 * El respaldo local de confirmar y cancelar: lo que hacen las páginas de OK y KO cuando
 * el webhook de Redsys no ha llegado (en local y en testing, siempre).
 *
 * Las dos funciones tienen guardas de estado distintas, y a propósito:
 * - Confirmar solo actúa sobre `PENDING`.
 * - Cancelar sale si la reserva ya está `CONFIRMED`: el pago manda.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Event, Seat } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  cancelReservationByOrderId,
  confirmReservationByOrderId,
} from "@/modules/payments/lib/return-pages";

import { freezeClock } from "../fixtures/clock";
import {
  at,
  makeEvent,
  makeReservation,
  makeSeatStatuses,
  makeSeats,
  minutes,
  seatStatesOf,
  TEST_NOW,
} from "../fixtures/factories";

let seats: Seat[];
let event: Event;

beforeEach(async () => {
  freezeClock();
  vi.spyOn(console, "log").mockImplementation(() => {});

  seats = await makeSeats(4);
  event = await makeEvent();
  await makeSeatStatuses(event.id, seats);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("confirmReservationByOrderId", () => {
  it("PENDING → CONFIRMED, pago COMPLETED, confirmedAt y asientos OCCUPIED", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0], seats[1]] });

    await confirmReservationByOrderId(reservation.paymentId!);

    const after = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(after).toMatchObject({
      status: "CONFIRMED",
      paymentStatus: "COMPLETED",
      confirmedAt: TEST_NOW,
    });

    const states = await seatStatesOf(event.id);
    expect(states[seats[0].id]).toEqual({
      status: "OCCUPIED",
      reservationId: reservation.id,
    });
    expect(states[seats[1].id]).toEqual({
      status: "OCCUPIED",
      reservationId: reservation.id,
    });
    expect(states[seats[2].id]).toEqual({ status: "AVAILABLE", reservationId: null });
  });

  it("es idempotente: la segunda llamada no mueve confirmedAt", async () => {
    // La página de confirmación se puede recargar, y el webhook puede haber llegado antes.
    const reservation = await makeReservation({ event, seats: [seats[0]] });
    await confirmReservationByOrderId(reservation.paymentId!);

    freezeClock(at(minutes(1)));
    await confirmReservationByOrderId(reservation.paymentId!);

    const after = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(after.confirmedAt).toEqual(TEST_NOW);
  });

  it.each(["CANCELLED", "EXPIRED"] as const)(
    "no resucita una reserva %s",
    async (status) => {
      const reservation = await makeReservation({ event, seats: [seats[0]], status });

      await confirmReservationByOrderId(reservation.paymentId!);

      const after = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
      });
      expect(after.status).toBe(status);
      expect(after.confirmedAt).toBeNull();
      expect((await seatStatesOf(event.id))[seats[0].id].status).toBe("AVAILABLE");
    },
  );

  it("con un pedido desconocido no hace nada ni lanza", async () => {
    await expect(confirmReservationByOrderId("000000000000")).resolves.toBeUndefined();
  });

  it("no toca las reservas de otros pedidos", async () => {
    const mine = await makeReservation({ event, seats: [seats[0]] });
    const other = await makeReservation({ event, seats: [seats[1]] });

    await confirmReservationByOrderId(mine.paymentId!);

    const otherAfter = await prisma.reservation.findUniqueOrThrow({
      where: { id: other.id },
    });
    expect(otherAfter.status).toBe("PENDING");
    expect((await seatStatesOf(event.id))[seats[1].id].status).toBe("RESERVED");
  });
});

describe("cancelReservationByOrderId", () => {
  it("PENDING → CANCELLED, pago FAILED y asientos liberados y desvinculados", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0], seats[1]] });

    await cancelReservationByOrderId(reservation.paymentId!);

    const after = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(after).toMatchObject({ status: "CANCELLED", paymentStatus: "FAILED" });

    const states = await seatStatesOf(event.id);
    expect(states[seats[0].id]).toEqual({ status: "AVAILABLE", reservationId: null });
    expect(states[seats[1].id]).toEqual({ status: "AVAILABLE", reservationId: null });
  });

  it("CONFIRMED → no hace nada: el pago manda sobre la vuelta por la URL KO", async () => {
    const reservation = await makeReservation({
      event,
      seats: [seats[0]],
      status: "CONFIRMED",
    });

    await cancelReservationByOrderId(reservation.paymentId!);

    const after = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(after.status).toBe("CONFIRMED");
    expect((await seatStatesOf(event.id))[seats[0].id]).toEqual({
      status: "OCCUPIED",
      reservationId: reservation.id,
    });
  });

  it("no libera asientos de otra reserva del mismo evento", async () => {
    const mine = await makeReservation({ event, seats: [seats[0]] });
    const other = await makeReservation({
      event,
      seats: [seats[1]],
      status: "CONFIRMED",
    });

    await cancelReservationByOrderId(mine.paymentId!);

    expect((await seatStatesOf(event.id))[seats[1].id]).toEqual({
      status: "OCCUPIED",
      reservationId: other.id,
    });
  });

  it("no toca el mismo asiento en otro evento", async () => {
    const otherEvent = await makeEvent({
      title: "Otro partido",
      eventDate: at(minutes(60 * 72)),
    });
    await makeSeatStatuses(otherEvent.id, seats);
    await makeReservation({ event: otherEvent, seats: [seats[0]], status: "CONFIRMED" });
    const mine = await makeReservation({ event, seats: [seats[0]] });

    await cancelReservationByOrderId(mine.paymentId!);

    expect((await seatStatesOf(otherEvent.id))[seats[0].id].status).toBe("OCCUPIED");
  });

  /**
   * El plan (MASTER_IA, «tres trampas») suponía que cancelar, al filtrar por
   * `seatId` + `eventId` en vez de por `reservationId`, liberaba también un asiento
   * cuyo vínculo con la reserva ya fuera nulo. No es así: los `seatId` se sacan de la
   * relación `reservation.seatStatuses`, que va precisamente por `reservationId`. Un
   * asiento sin vínculo no entra en la lista y no se libera. Este test lo fija.
   */
  it("COMPORTAMIENTO ACTUAL: un asiento RESERVED sin vínculo a la reserva NO se libera", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0], seats[1]] });
    await prisma.seatStatus.updateMany({
      where: { eventId: event.id, seatId: seats[1].id },
      data: { reservationId: null },
    });

    await cancelReservationByOrderId(reservation.paymentId!);

    const states = await seatStatesOf(event.id);
    expect(states[seats[0].id]).toEqual({ status: "AVAILABLE", reservationId: null });
    expect(states[seats[1].id]).toEqual({ status: "RESERVED", reservationId: null });
  });

  it("con un pedido desconocido no hace nada ni lanza", async () => {
    await expect(cancelReservationByOrderId("000000000000")).resolves.toBeUndefined();
  });
});
