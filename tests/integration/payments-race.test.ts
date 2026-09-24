/**
 * Dos clientes que pulsan RESERVAR a la vez sobre el mismo asiento (RCA-175).
 *
 * `initializePayment` comprueba la disponibilidad con una lectura y aparta los asientos
 * después, en una transacción. Entre las dos cosas hay una ventana, y dos peticiones que
 * caigan dentro pasan la comprobación las dos.
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
  it("COMPORTAMIENTO ACTUAL: el mismo asiento se vende a los dos", async () => {
    holdTransactions(2);

    const results = await Promise.all([
      reserve([seats[0].id], "Ana"),
      reserve([seats[0].id], "Luis"),
    ]);

    expect(results.map((r) => r.success)).toEqual([true, true]);
    // Dos reservas PENDING para un solo asiento: las dos irán a la pasarela y las dos
    // pagarán. El asiento acaba vinculado a la que escribió la última.
    expect(await prisma.reservation.count({ where: { status: "PENDING" } })).toBe(2);
  });

  it("COMPORTAMIENTO ACTUAL: con asientos solapados, el compartido cambia de dueño", async () => {
    holdTransactions(2);

    const [ana, luis] = await Promise.all([
      reserve([seats[0].id, seats[1].id], "Ana"),
      reserve([seats[1].id, seats[2].id], "Luis"),
    ]);

    expect(ana.success).toBe(true);
    expect(luis.success).toBe(true);

    const states = await seatStatesOf(event.id);
    const owners = new Set(
      [seats[0], seats[1], seats[2]].map((s) => states[s.id].reservationId),
    );
    // Dos reservas de dos asientos cada una, repartidas en tres asientos: una de las
    // dos cobrará dos asientos y solo tendrá uno.
    expect(owners.size).toBe(2);
    expect(await prisma.reservation.count()).toBe(2);
  });
});
