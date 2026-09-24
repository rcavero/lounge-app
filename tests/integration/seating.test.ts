/**
 * Asientos por evento: el plano que ve el cliente (`getSeatsForEvent`) y los bloqueos
 * que pone el bar (`saveBlockedSeats`).
 *
 * `requireAuth` se mockea porque lee la cookie de sesión con `next/headers`, que fuera de
 * una petición de Next no existe. Lo que se prueba aquí es qué escribe la action, no el
 * login; que la action exige sesión sí se comprueba, con el mock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Event, Seat } from "@/generated/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  getSeatsForEvent,
  initializeSeatsForEvent,
  saveBlockedSeats,
} from "@/modules/seating/actions";

import { freezeClock } from "../fixtures/clock";
import {
  at,
  days,
  makeEvent,
  makeReservation,
  makeSeatStatuses,
  makeSeats,
  minutes,
  seatStatesOf,
} from "../fixtures/factories";

vi.mock("@/lib/auth-guard", () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}));

let seats: Seat[];
let event: Event;

beforeEach(async () => {
  freezeClock();
  vi.mocked(requireAuth).mockResolvedValue(undefined);

  seats = await makeSeats(5);
  event = await makeEvent();
  await makeSeatStatuses(event.id, seats);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

async function statusesById(eventId: string) {
  const seatsWithStatus = await getSeatsForEvent(eventId);
  return Object.fromEntries(seatsWithStatus.map((s) => [s.id, s.status]));
}

describe("saveBlockedSeats", () => {
  it("sustituye los bloqueos anteriores por los nuevos", async () => {
    await prisma.seatStatus.updateMany({
      where: { eventId: event.id, seatId: seats[0].id },
      data: { status: "BLOCKED" },
    });

    const result = await saveBlockedSeats(event.id, [seats[1].id]);

    expect(result).toEqual({ success: true });
    const states = await seatStatesOf(event.id);
    expect(states[seats[0].id].status).toBe("AVAILABLE");
    expect(states[seats[1].id].status).toBe("BLOCKED");
  });

  it("nunca pisa un asiento RESERVED ni OCCUPIED", async () => {
    // Un bloqueo no puede quitarle el sitio a quien está pagando o ya ha pagado.
    const pending = await makeReservation({ event, seats: [seats[1]] });
    const paid = await makeReservation({ event, seats: [seats[2]], status: "CONFIRMED" });

    await saveBlockedSeats(event.id, [seats[0].id, seats[1].id, seats[2].id]);

    const states = await seatStatesOf(event.id);
    expect(states[seats[0].id].status).toBe("BLOCKED");
    expect(states[seats[1].id]).toEqual({
      status: "RESERVED",
      reservationId: pending.id,
    });
    expect(states[seats[2].id]).toEqual({ status: "OCCUPIED", reservationId: paid.id });
  });

  it("con la lista vacía libera todos los bloqueos del evento", async () => {
    await saveBlockedSeats(event.id, [seats[0].id, seats[1].id]);

    await saveBlockedSeats(event.id, []);

    const states = await seatStatesOf(event.id);
    expect(Object.values(states).every((s) => s.status === "AVAILABLE")).toBe(true);
  });

  it("solo toca el evento que se le pide", async () => {
    const other = await makeEvent({ title: "Otro partido", eventDate: at(days(7)) });
    await makeSeatStatuses(other.id, seats, { [seats[0].id]: "BLOCKED" });

    await saveBlockedSeats(event.id, [seats[1].id]);

    const otherStates = await seatStatesOf(other.id);
    expect(otherStates[seats[0].id].status).toBe("BLOCKED");
    expect(otherStates[seats[1].id].status).toBe("AVAILABLE");
  });

  it("sin sesión lanza antes de escribir nada", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error("Unauthorized"));

    await expect(saveBlockedSeats(event.id, [seats[0].id])).rejects.toThrow(
      "Unauthorized",
    );

    expect((await seatStatesOf(event.id))[seats[0].id].status).toBe("AVAILABLE");
  });
});

describe("getSeatsForEvent — expiración de reservas pendientes", () => {
  it("expira la PENDING de hace 6 minutos y libera sus asientos", async () => {
    const stale = await makeReservation({
      event,
      seats: [seats[0], seats[1]],
      createdAt: at(-minutes(6)),
    });

    const statuses = await statusesById(event.id);

    expect(statuses[seats[0].id]).toBe("AVAILABLE");
    expect(statuses[seats[1].id]).toBe("AVAILABLE");
    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: stale.id } })).status,
    ).toBe("EXPIRED");
    // El vínculo con la reserva se conserva como rastro, para poder recuperar los
    // asientos si el pago llega tarde (RCA-276).
    expect((await seatStatesOf(event.id))[seats[0].id].reservationId).toBe(stale.id);
  });

  it("no expira la PENDING de hace 4 minutos: el cliente sigue en la pasarela", async () => {
    const fresh = await makeReservation({
      event,
      seats: [seats[0]],
      createdAt: at(-minutes(4)),
    });

    const statuses = await statusesById(event.id);

    expect(statuses[seats[0].id]).toBe("RESERVED");
    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: fresh.id } })).status,
    ).toBe("PENDING");
  });

  it("no expira una pendiente de exactamente 5 minutos (el corte es estricto)", async () => {
    const edge = await makeReservation({
      event,
      seats: [seats[0]],
      createdAt: at(-minutes(5)),
    });

    await getSeatsForEvent(event.id);

    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: edge.id } })).status,
    ).toBe("PENDING");
  });

  it("no toca una CONFIRMED antigua", async () => {
    const paid = await makeReservation({
      event,
      seats: [seats[0]],
      status: "CONFIRMED",
      createdAt: at(-days(2)),
    });

    const statuses = await statusesById(event.id);

    expect(statuses[seats[0].id]).toBe("OCCUPIED");
    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: paid.id } })).status,
    ).toBe("CONFIRMED");
  });

  it("solo expira las del evento que se consulta", async () => {
    const other = await makeEvent({ title: "Otro partido", eventDate: at(days(7)) });
    await makeSeatStatuses(other.id, seats);
    const staleElsewhere = await makeReservation({
      event: other,
      seats: [seats[0]],
      createdAt: at(-minutes(6)),
    });

    await getSeatsForEvent(event.id);

    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: staleElsewhere.id } }))
        .status,
    ).toBe("PENDING");
  });
});

describe("getSeatsForEvent — el plano que ve el cliente", () => {
  async function overlappingEvent() {
    const other = await makeEvent({
      title: "Partido solapado",
      eventDate: new Date(event.eventDate.getTime() + minutes(60)),
    });
    await makeSeatStatuses(other.id, seats);
    return other;
  }

  it("devuelve todos los asientos, ordenados por código", async () => {
    const result = await getSeatsForEvent(event.id);

    expect(result.map((s) => s.code)).toEqual([...seats.map((s) => s.code)].sort());
  });

  it("marca OCCUPIED un asiento tomado en un evento solapado", async () => {
    const other = await overlappingEvent();
    await makeReservation({ event: other, seats: [seats[0]], status: "CONFIRMED" });
    await makeReservation({
      event: other,
      seats: [seats[1]],
      createdAt: at(-minutes(1)),
    });

    const statuses = await statusesById(event.id);

    expect(statuses[seats[0].id]).toBe("OCCUPIED");
    expect(statuses[seats[1].id]).toBe("OCCUPIED");
    expect(statuses[seats[2].id]).toBe("AVAILABLE");
  });

  it("no pisa un BLOQUEO propio con la ocupación del evento solapado", async () => {
    await prisma.seatStatus.updateMany({
      where: { eventId: event.id, seatId: seats[0].id },
      data: { status: "BLOCKED" },
    });
    const other = await overlappingEvent();
    await makeReservation({ event: other, seats: [seats[0]], status: "CONFIRMED" });

    const statuses = await statusesById(event.id);

    expect(statuses[seats[0].id]).toBe("BLOCKED");
  });

  it("es solo lectura para el solapado: no escribe en este evento", async () => {
    const other = await overlappingEvent();
    await makeReservation({ event: other, seats: [seats[0]], status: "CONFIRMED" });

    await getSeatsForEvent(event.id);

    expect((await seatStatesOf(event.id))[seats[0].id].status).toBe("AVAILABLE");
  });

  it("ignora un evento que empieza justo cuando termina este", async () => {
    const next = await makeEvent({
      title: "Partido siguiente",
      eventDate: new Date(event.eventDate.getTime() + minutes(120)),
    });
    await makeSeatStatuses(next.id, seats);
    await makeReservation({ event: next, seats: [seats[0]], status: "CONFIRMED" });

    expect((await statusesById(event.id))[seats[0].id]).toBe("AVAILABLE");
  });

  it("un asiento sin SeatStatus en este evento sale AVAILABLE", async () => {
    // Evento recién creado cuya página aún no ha llamado a initializeSeatsForEvent.
    const fresh = await makeEvent({ title: "Recién creado", eventDate: at(days(3)) });

    const statuses = await statusesById(fresh.id);

    expect(Object.values(statuses).every((s) => s === "AVAILABLE")).toBe(true);
  });
});

describe("initializeSeatsForEvent", () => {
  it("crea un SeatStatus AVAILABLE por asiento", async () => {
    const fresh = await makeEvent({ title: "Recién creado", eventDate: at(days(3)) });

    await initializeSeatsForEvent(fresh.id);

    const states = await seatStatesOf(fresh.id);
    expect(Object.keys(states)).toHaveLength(seats.length);
    expect(Object.values(states).every((s) => s.status === "AVAILABLE")).toBe(true);
  });

  it("es idempotente: si ya hay estados, no toca nada", async () => {
    // La página del evento lo llama en cada visita.
    await prisma.seatStatus.updateMany({
      where: { eventId: event.id, seatId: seats[0].id },
      data: { status: "BLOCKED" },
    });

    await initializeSeatsForEvent(event.id);

    expect(await prisma.seatStatus.count({ where: { eventId: event.id } })).toBe(
      seats.length,
    );
    expect((await seatStatesOf(event.id))[seats[0].id].status).toBe("BLOCKED");
  });
});
