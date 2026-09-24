/**
 * Dos clientes que pulsan RESERVAR a la vez sobre el mismo asiento (RCA-175).
 *
 * `initializePayment` comprueba la disponibilidad con una lectura y aparta los asientos
 * después, en una transacción. Entre las dos cosas hay una ventana, y dos peticiones que
 * caigan dentro pasaban la comprobación las dos. Ahora la transacción solo aparta
 * asientos que siguen `AVAILABLE` y se deshace si falta alguno.
 *
 * Para que la carrera no dependa de la suerte, `holdTransactions` retiene la
 * transacción de cada llamada hasta que han llegado todas: garantiza que las dos han
 * hecho ya su comprobación cuando la primera empieza a escribir. Es el peor orden
 * posible, y en producción basta con que ocurra una vez.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Event, Seat } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { initializePayment } from "@/modules/payments/actions";

import { freezeClock } from "../fixtures/clock";
import {
  makeEvent,
  makeSeatStatuses,
  makeSeats,
  seatStatesOf,
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

/**
 * Retiene cada `prisma.$transaction` hasta que `callers` llamadas han llegado a ella, y
 * entonces las suelta todas juntas.
 */
function holdTransactions(callers: number) {
  const original = prisma.$transaction.bind(prisma);
  let arrived = 0;
  let release!: () => void;
  const allArrived = new Promise<void>((resolve) => (release = resolve));

  vi.spyOn(prisma, "$transaction").mockImplementation((async (...args: unknown[]) => {
    arrived += 1;
    if (arrived === callers) release();
    await allArrived;
    return (original as (...a: unknown[]) => unknown)(...args);
  }) as never);
}

function reserve(seatIds: string[], customerName: string) {
  return initializePayment({ eventId: event.id, seatIds, customerName });
}

describe("initializePayment — dos clientes a la vez", () => {
  it("el mismo asiento: gana uno, y el otro recibe el error sin dejar nada escrito", async () => {
    holdTransactions(2);

    const results = await Promise.all([
      reserve([seats[0].id], "Ana"),
      reserve([seats[0].id], "Luis"),
    ]);

    const winners = results.filter((r) => r.success);
    const losers = results.filter((r) => !r.success);
    expect(winners).toHaveLength(1);
    expect(losers).toEqual([
      { success: false, error: `Asientos no disponibles: ${seats[0].code}` },
    ]);

    // Una sola reserva, y es la dueña del asiento.
    const [reservation] = await prisma.reservation.findMany();
    expect(await prisma.reservation.count()).toBe(1);
    expect((await seatStatesOf(event.id))[seats[0].id]).toEqual({
      status: "RESERVED",
      reservationId: reservation.id,
    });
  });

  it("con asientos solapados, el perdedor no se queda ni con los que no disputaba", async () => {
    holdTransactions(2);

    const [ana, luis] = await Promise.all([
      reserve([seats[0].id, seats[1].id], "Ana"),
      reserve([seats[1].id, seats[2].id], "Luis"),
    ]);

    expect([ana.success, luis.success].sort()).toEqual([false, true]);

    const [winner] = await prisma.reservation.findMany();
    expect(await prisma.reservation.count()).toBe(1);

    // El ganador tiene sus dos asientos; el que solo pedía el perdedor sigue libre,
    // porque su transacción se deshizo entera.
    const states = await seatStatesOf(event.id);
    const winnerSeats = winner.customerName === "Ana" ? [0, 1] : [1, 2];
    const loserOnly = winner.customerName === "Ana" ? 2 : 0;
    for (const i of winnerSeats) {
      expect(states[seats[i].id]).toEqual({
        status: "RESERVED",
        reservationId: winner.id,
      });
    }
    expect(states[seats[loserOnly].id]).toEqual({
      status: "AVAILABLE",
      reservationId: null,
    });
    expect(states[seats[3].id]).toEqual({ status: "AVAILABLE", reservationId: null });
  });

  it("diez clientes a por el mismo asiento: exactamente uno lo consigue", async () => {
    holdTransactions(10);

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => reserve([seats[0].id], `Cliente ${i}`)),
    );

    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(await prisma.reservation.count()).toBe(1);
  });

  it("asientos distintos no se estorban: los dos lo consiguen", async () => {
    holdTransactions(2);

    const results = await Promise.all([
      reserve([seats[0].id], "Ana"),
      reserve([seats[1].id], "Luis"),
    ]);

    expect(results.map((r) => r.success)).toEqual([true, true]);
    expect(await prisma.reservation.count()).toBe(2);
  });
});
