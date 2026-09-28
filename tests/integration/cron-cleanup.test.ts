/**
 * `GET /api/cron/cleanup`, que Vercel lanza cada noche: borra los eventos de hace más de
 * 90 días y expira las reservas PENDING de más de 5 minutos.
 *
 * Es una ruta pública en internet y lo único que la protege es el `CRON_SECRET`. Por eso
 * los tests de "sin permiso" comprueban que no se ha escrito NADA, no solo el 401.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as cleanup } from "@/app/api/cron/cleanup/route";
import type { Event, Seat } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

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

let seats: Seat[];
let event: Event;

beforeEach(async () => {
  freezeClock();
  seats = await makeSeats(4);
  event = await makeEvent();
  await makeSeatStatuses(event.id, seats);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

function callCron(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return cleanup(new Request("http://localhost:3100/api/cron/cleanup", { headers }));
}

const AUTHORIZED = `Bearer ${process.env.CRON_SECRET}`;

/** Todo lo que el cron podría cambiar. */
async function snapshot() {
  return {
    events: await prisma.event.findMany({ orderBy: { id: "asc" } }),
    reservations: await prisma.reservation.findMany({ orderBy: { id: "asc" } }),
    seatStatuses: await prisma.seatStatus.findMany({ orderBy: { id: "asc" } }),
    loginAttempts: await prisma.loginAttempt.findMany({ orderBy: { key: "asc" } }),
  };
}

/** Un escenario con algo que hacer en cada frente, para que un 401 tenga qué no tocar. */
async function workToDo() {
  await makeReservation({ event, seats: [seats[0]], createdAt: at(-minutes(6)) });
  const old = await makeEvent({ title: "Partido viejo", eventDate: at(-days(91)) });
  await makeSeatStatuses(old.id, seats);
  await prisma.loginAttempt.create({
    data: { key: "203.0.113.7", count: 5, resetAt: at(-minutes(1)) },
  });
}

describe("GET /api/cron/cleanup — autorización", () => {
  it.each([
    ["sin cabecera", undefined],
    ["con otro secreto", "Bearer otro-secreto"],
    ["con el secreto sin 'Bearer'", process.env.CRON_SECRET],
  ])("%s: 401 y cero escrituras", async (_label, authorization) => {
    await workToDo();
    const before = await snapshot();

    const response = await callCron(authorization);

    expect(response.status).toBe(401);
    expect(await snapshot()).toEqual(before);
  });

  it("si al despliegue le falta CRON_SECRET, 'Bearer undefined' no entra", async () => {
    // El error clásico: sin la variable, la cadena esperada sería `Bearer ${undefined}`
    // y la puerta quedaría abierta a quien mande literalmente eso. Lo impide el
    // `!cronSecret` de la ruta; sin él, este test falla.
    vi.stubEnv("CRON_SECRET", undefined);
    await workToDo();
    const before = await snapshot();

    expect((await callCron("Bearer undefined")).status).toBe(401);
    expect(await snapshot()).toEqual(before);
  });

  it("con CRON_SECRET vacío tampoco entra nadie", async () => {
    vi.stubEnv("CRON_SECRET", "");
    await workToDo();
    const before = await snapshot();

    // `Bearer ` con espacio final ni siquiera se puede mandar: las cabeceras HTTP se
    // recortan y llega `Bearer`.
    for (const authorization of ["Bearer ", "Bearer", "Bearer undefined"]) {
      expect((await callCron(authorization)).status).toBe(401);
    }
    expect(await snapshot()).toEqual(before);
  });
});

describe("GET /api/cron/cleanup — reservas pendientes", () => {
  it("expira la de hace 6 minutos y libera sus asientos", async () => {
    const stale = await makeReservation({
      event,
      seats: [seats[0], seats[1]],
      createdAt: at(-minutes(6)),
    });

    const response = await callCron(AUTHORIZED);

    expect(response.status).toBe(200);
    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: stale.id } })).status,
    ).toBe("EXPIRED");
    // Libres, pero con el rastro de la reserva: si el pago llega tarde, se recuperan
    // si nadie los ha cogido (RCA-276).
    const states = await seatStatesOf(event.id);
    expect(states[seats[0].id]).toEqual({ status: "AVAILABLE", reservationId: stale.id });
    expect(states[seats[1].id]).toEqual({ status: "AVAILABLE", reservationId: stale.id });
  });

  it("no expira la de hace 4 minutos", async () => {
    const fresh = await makeReservation({
      event,
      seats: [seats[0]],
      createdAt: at(-minutes(4)),
    });

    await callCron(AUTHORIZED);

    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: fresh.id } })).status,
    ).toBe("PENDING");
    expect((await seatStatesOf(event.id))[seats[0].id]).toEqual({
      status: "RESERVED",
      reservationId: fresh.id,
    });
  });

  it("expira las de todos los eventos, no solo las de uno", async () => {
    const other = await makeEvent({ title: "Otro partido", eventDate: at(days(7)) });
    await makeSeatStatuses(other.id, seats);
    const a = await makeReservation({
      event,
      seats: [seats[0]],
      createdAt: at(-minutes(6)),
    });
    const b = await makeReservation({
      event: other,
      seats: [seats[0]],
      createdAt: at(-minutes(30)),
    });

    const body = await (await callCron(AUTHORIZED)).json();

    expect(body.expiredReservations).toBe(2);
    for (const r of [a, b]) {
      expect(
        (await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })).status,
      ).toBe("EXPIRED");
    }
  });

  it("no toca reservas confirmadas ni canceladas, por viejas que sean", async () => {
    const paid = await makeReservation({
      event,
      seats: [seats[0]],
      status: "CONFIRMED",
      createdAt: at(-days(2)),
    });
    const cancelled = await makeReservation({
      event,
      seats: [seats[1]],
      status: "CANCELLED",
      createdAt: at(-days(2)),
    });

    await callCron(AUTHORIZED);

    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: paid.id } })).status,
    ).toBe("CONFIRMED");
    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: cancelled.id } }))
        .status,
    ).toBe("CANCELLED");
    expect((await seatStatesOf(event.id))[seats[0].id].status).toBe("OCCUPIED");
  });
});

describe("GET /api/cron/cleanup — eventos antiguos", () => {
  it("borra el evento de hace 91 días con sus reservas y estados, y deja el de 89", async () => {
    const old = await makeEvent({
      title: "Partido de hace 91 días",
      eventDate: at(-days(91)),
    });
    await makeSeatStatuses(old.id, seats);
    const oldReservation = await makeReservation({
      event: old,
      seats: [seats[0]],
      status: "CONFIRMED",
      createdAt: at(-days(92)),
    });

    const recent = await makeEvent({
      title: "Partido de hace 89 días",
      eventDate: at(-days(89)),
    });
    await makeSeatStatuses(recent.id, seats);
    await makeReservation({
      event: recent,
      seats: [seats[0]],
      status: "CONFIRMED",
      createdAt: at(-days(90)),
    });

    const body = await (await callCron(AUTHORIZED)).json();

    expect(body).toMatchObject({ success: true, deletedEvents: 1 });
    expect(await prisma.event.findUnique({ where: { id: old.id } })).toBeNull();
    // La cascada: ni reservas ni estados huérfanos del evento borrado.
    expect(
      await prisma.reservation.findUnique({ where: { id: oldReservation.id } }),
    ).toBeNull();
    expect(await prisma.seatStatus.count({ where: { eventId: old.id } })).toBe(0);

    expect(await prisma.event.findUnique({ where: { id: recent.id } })).not.toBeNull();
    expect(await prisma.reservation.count({ where: { eventId: recent.id } })).toBe(1);
    expect(await prisma.seatStatus.count({ where: { eventId: recent.id } })).toBe(
      seats.length,
    );
  });

  it("no borra nunca los asientos del local", async () => {
    const old = await makeEvent({ title: "Partido viejo", eventDate: at(-days(200)) });
    await makeSeatStatuses(old.id, seats);

    await callCron(AUTHORIZED);

    expect(await prisma.seat.count()).toBe(seats.length);
  });

  it("devuelve la fecha de corte: 90 días antes de ahora", async () => {
    const body = await (await callCron(AUTHORIZED)).json();

    expect(body.cutoffDate).toBe(at(-days(90)).toISOString());
  });
});

describe("GET /api/cron/cleanup — límite de login (RCA-286, R2)", () => {
  it("borra las ventanas vencidas y deja las que siguen abiertas", async () => {
    await prisma.loginAttempt.createMany({
      data: [
        { key: "203.0.113.7", count: 5, resetAt: at(-minutes(1)) },
        { key: "198.51.100.23", count: 2, resetAt: at(minutes(10)) },
      ],
    });

    const body = await (await callCron(AUTHORIZED)).json();

    expect(body).toMatchObject({ success: true, deletedLoginAttempts: 1 });
    expect(await prisma.loginAttempt.findMany({ select: { key: true } })).toEqual([
      { key: "198.51.100.23" },
    ]);
  });
});
