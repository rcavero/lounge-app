/**
 * Alta y edición de eventos: el título y los participantes que se guardan según el tipo
 * de deporte. Es la red de la extracción de `events/domain/title.ts` (P4): hoy la misma
 * lógica está copiada en `createEvent` y en `updateEvent`, y los dos se prueban igual.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Team } from "@/generated/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createEvent, updateEvent } from "@/modules/events/actions";

import { at, days, makeEvent, makeSeats } from "../fixtures/factories";

vi.mock("@/lib/auth-guard", () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}));

let valencia: Team;
let betis: Team;

beforeEach(async () => {
  vi.mocked(requireAuth).mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});

  valencia = await prisma.team.create({
    data: { name: "Valencia CF", shortName: "Valencia", league: "La Liga" },
  });
  betis = await prisma.team.create({
    data: { name: "Real Betis", shortName: "Betis", league: "La Liga" },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const BASE = { eventDate: at(days(2)), screens: ["TV1", "TV2"] };

type EventInput = Parameters<typeof createEvent>[0];

/**
 * Cada caso se ejecuta por los dos caminos: crear un evento nuevo, y editar uno que ya
 * existía con otros datos. Los dos tienen que guardar exactamente lo mismo.
 */
const paths = {
  createEvent: async (input: EventInput) => {
    const result = await createEvent(input);
    return {
      result,
      event: result.eventId
        ? await prisma.event.findUniqueOrThrow({ where: { id: result.eventId } })
        : null,
    };
  },
  updateEvent: async (input: EventInput) => {
    const existing = await makeEvent({
      title: "Título viejo",
      homeTeamId: valencia.id,
      awayTeamId: betis.id,
      homeTeamName: "viejo",
      awayTeamName: "viejo",
    });
    const result = await updateEvent(existing.id, input);
    return {
      result,
      event: await prisma.event.findUniqueOrThrow({ where: { id: existing.id } }),
    };
  },
};

describe.each(Object.entries(paths))("%s — título y participantes", (_name, run) => {
  it("fútbol: título con los nombres cortos y los equipos por id", async () => {
    const { result, event } = await run({
      ...BASE,
      competition: "La Liga",
      homeTeamId: valencia.id,
      awayTeamId: betis.id,
    });

    expect(result.success).toBe(true);
    expect(event).toMatchObject({
      title: "Valencia vs Betis",
      homeTeamId: valencia.id,
      awayTeamId: betis.id,
      homeTeamName: null,
      awayTeamName: null,
      competition: "La Liga",
    });
  });

  it("fútbol con un equipo que no existe: error y nada guardado", async () => {
    const { result } = await run({
      ...BASE,
      competition: "La Liga",
      homeTeamId: valencia.id,
      awayTeamId: "no-existe",
    });

    expect(result).toEqual({ success: false, error: "Equipo no encontrado" });
    // Crear no deja ningún evento; editar deja el que había, sin tocar.
    const events = await prisma.event.findMany();
    expect(
      events.every((e) => e.title === "Título viejo" && e.homeTeamName === "viejo"),
    ).toBe(true);
    expect(events.length).toBeLessThanOrEqual(1);
  });

  it("sin competición cuenta como fútbol y la guarda como «Liga»", async () => {
    const { event } = await run({
      ...BASE,
      homeTeamId: valencia.id,
      awayTeamId: betis.id,
    });

    expect(event).toMatchObject({ title: "Valencia vs Betis", competition: "Liga" });
  });

  it("deporte manual: «local vs visitante» con los nombres libres, sin equipos", async () => {
    const { event } = await run({
      ...BASE,
      competition: "Baloncesto",
      homeTeamName: "  Valencia Basket ",
      awayTeamName: "Real Madrid",
      // Se ignoran: el deporte manual no usa equipos de la BD.
      homeTeamId: valencia.id,
      awayTeamId: betis.id,
    });

    expect(event).toMatchObject({
      title: "Valencia Basket vs Real Madrid",
      homeTeamName: "Valencia Basket",
      awayTeamName: "Real Madrid",
      homeTeamId: null,
      awayTeamId: null,
      competition: "Baloncesto",
    });
  });

  it("deporte manual sin visitante: el título es solo el local", async () => {
    // Antes quedaba «Velada vs », con espacio final (RCA-279).
    const { event } = await run({
      ...BASE,
      competition: "Boxeo",
      homeTeamName: "Velada",
    });

    expect(event).toMatchObject({
      title: "Velada",
      homeTeamName: "Velada",
      awayTeamName: null,
    });
  });

  it("motor: el título es el nombre del gran premio, sin visitante", async () => {
    const { event } = await run({
      ...BASE,
      competition: "Fórmula 1",
      homeTeamName: " GP de España ",
      awayTeamName: "se ignora",
    });

    expect(event).toMatchObject({
      title: "GP de España",
      homeTeamName: "GP de España",
      awayTeamName: null,
      homeTeamId: null,
      awayTeamId: null,
    });
  });

  it("motor sin nombre: el título es la competición", async () => {
    const { event } = await run({ ...BASE, competition: "Moto GP", homeTeamName: "   " });

    expect(event).toMatchObject({
      title: "Moto GP",
      homeTeamName: null,
      awayTeamName: null,
    });
  });

  it("fútbol sin homeTeamId: la búsqueda revienta y se devuelve el error genérico", async () => {
    const { result } = await run({
      ...BASE,
      competition: "La Liga",
      awayTeamId: betis.id,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/^Error al (crear|actualizar) el evento$/);
  });
});

describe("createEvent — lo que no es el título", () => {
  it("crea un SeatStatus AVAILABLE por asiento del local", async () => {
    const seats = await makeSeats(5);

    const { eventId } = await createEvent({
      ...BASE,
      competition: "La Liga",
      homeTeamId: valencia.id,
      awayTeamId: betis.id,
    });

    const statuses = await prisma.seatStatus.findMany({ where: { eventId } });
    expect(statuses).toHaveLength(seats.length);
    expect(statuses.every((s) => s.status === "AVAILABLE")).toBe(true);
  });

  it("valores por defecto: 10 €, gastos de 1,50 €, 120 minutos, pantallas unidas por comas", async () => {
    const { eventId } = await createEvent({
      ...BASE,
      competition: "La Liga",
      homeTeamId: valencia.id,
      awayTeamId: betis.id,
    });

    expect(
      await prisma.event.findUniqueOrThrow({ where: { id: eventId } }),
    ).toMatchObject({
      pricePerSeat: 10,
      managementFeeCents: 150,
      durationMinutes: 120,
      screens: "TV1,TV2",
      status: "UPCOMING",
    });
  });

  it("unos gastos de gestión fuera de la lista caen al valor por defecto", async () => {
    const { eventId } = await createEvent({
      ...BASE,
      competition: "La Liga",
      homeTeamId: valencia.id,
      awayTeamId: betis.id,
      managementFeeCents: 149,
    });

    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: eventId } }))
        .managementFeeCents,
    ).toBe(150);
  });
});
