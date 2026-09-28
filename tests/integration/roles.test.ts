/**
 * Qué puede hacer cada rol del panel, comprobado en las server actions, que son la
 * capa que cuenta: cada una es un endpoint que se puede llamar sin pasar por su página
 * (RCA-285).
 *
 * El WORKER ve en el menú solo «Administrar reservas», y desde ahí bloquea asientos. El
 * resto del panel —eventos, sugerencias, plano, carteles e informes— es del ADMIN. Antes
 * esas acciones solo exigían sesión: un WORKER que entrara por URL podía borrar un
 * evento, y con él sus reservas pagadas.
 *
 * A diferencia del resto de la suite, aquí `requireAuth` y `requireAdmin` son los de
 * verdad. Lo que se sustituye es la sesión, que en un test no tiene cookie de donde leer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Event, Seat } from "@/generated/prisma";
import { getSessionData } from "@/modules/auth/actions";
import { prisma } from "@/lib/prisma";
import {
  createEvent,
  deleteEvent,
  getAllEvents,
  getAllTeams,
  updateEvent,
} from "@/modules/events/actions";
import {
  createEventFromSuggestion,
  getMatchSuggestions,
  syncTeamsFromAPI,
} from "@/modules/football-data/actions";
import type { MatchSuggestion } from "@/modules/football-data/types";
import {
  getAvailableReportMonths,
  getEventsWithReservationCount,
  getMonthlyReportData,
} from "@/modules/reservations/actions";
import {
  getAllSeats,
  saveBlockedSeats,
  updateSeatPositions,
  updateZoneLabels,
} from "@/modules/seating/actions";

import {
  at,
  days,
  makeEvent,
  makeReservation,
  makeSeatStatuses,
  makeSeats,
} from "../fixtures/factories";

vi.mock("@/modules/auth/actions", () => ({ getSessionData: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Si un guardia fallara, que el test no salga a internet a buscar partidos.
vi.mock("@/modules/football-data/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getScheduledMatches: vi.fn().mockRejectedValue(new Error("sin red en los tests")),
  getCompetitionTeams: vi.fn().mockRejectedValue(new Error("sin red en los tests")),
}));

function signedInAs(role: "ADMIN" | "WORKER") {
  vi.mocked(getSessionData).mockResolvedValue({
    isLoggedIn: true,
    email: `${role.toLowerCase()}@lounge.test`,
    role,
    adminId: `sesion-de-${role.toLowerCase()}`,
  });
}

let event: Event;
let seats: Seat[];

beforeEach(async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  seats = await makeSeats(3);
  event = await makeEvent({ eventDate: at(days(1)) });
  await makeSeatStatuses(event.id, seats);
  await makeReservation({ event, seats: [seats[0]], status: "CONFIRMED" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const suggestion: MatchSuggestion = {
  externalMatchId: 4242,
  competition: "La Liga",
  competitionCode: "esp.1",
  homeTeam: {
    externalId: 1,
    name: "Valencia CF",
    shortName: "VAL",
    crest: "",
    dbTeamId: null,
  },
  awayTeam: {
    externalId: 2,
    name: "Real Betis",
    shortName: "BET",
    crest: "",
    dbTeamId: null,
  },
  utcDate: at(days(1)).toISOString(),
  matchday: null,
  canCreate: true,
};

/** Las acciones del ADMIN. Cada una, con argumentos que la harían escribir o leer. */
const ADMIN_ONLY: Record<string, () => Promise<unknown>> = {
  createEvent: () =>
    createEvent({
      homeTeamName: "Lakers",
      awayTeamName: "Celtics",
      competition: "Baloncesto",
      eventDate: at(days(1)),
      screens: ["TV1"],
    }),
  updateEvent: () =>
    updateEvent(event.id, {
      homeTeamName: "Lakers",
      awayTeamName: "Celtics",
      competition: "Baloncesto",
      eventDate: at(days(1)),
      screens: ["TV1"],
    }),
  deleteEvent: () => deleteEvent(event.id),
  getAllEvents: () => getAllEvents(),
  getAllTeams: () => getAllTeams(),
  syncTeamsFromAPI: () => syncTeamsFromAPI(),
  getMatchSuggestions: () => getMatchSuggestions(),
  createEventFromSuggestion: () => createEventFromSuggestion(suggestion, ["TV1"]),
  getAllSeats: () => getAllSeats(),
  updateSeatPositions: () => updateSeatPositions([{ id: seats[0].id, posX: 1, posY: 1 }]),
  updateZoneLabels: () =>
    updateZoneLabels([{ zone: "TV1", posX: 1, posY: 1, scaleX: 1, rotation: 0 }]),
  getAvailableReportMonths: () => getAvailableReportMonths(),
  getMonthlyReportData: () => {
    const d = at(0);
    return getMonthlyReportData(d.getFullYear(), d.getMonth() + 1);
  },
};

/** Todo lo que esas acciones podrían haber cambiado. */
async function snapshot() {
  return {
    events: await prisma.event.findMany({ orderBy: { id: "asc" } }),
    reservations: await prisma.reservation.count(),
    seats: await prisma.seat.findMany({ orderBy: { id: "asc" } }),
    zoneLabels: await prisma.zoneLabel.findMany(),
  };
}

describe("como WORKER", () => {
  beforeEach(() => signedInAs("WORKER"));

  it.each(Object.keys(ADMIN_ONLY))("%s lanza Forbidden y no toca nada", async (name) => {
    const before = await snapshot();

    await expect(ADMIN_ONLY[name]()).rejects.toThrow("Forbidden");

    expect(await snapshot()).toEqual(before);
  });

  it("sigue viendo los eventos con sus reservas", async () => {
    const events = await getEventsWithReservationCount();
    expect(events.map((e) => e.id)).toContain(event.id);
  });

  it("sigue pudiendo bloquear asientos: el botón está en su vista de reservas", async () => {
    const result = await saveBlockedSeats(event.id, [seats[1].id]);

    expect(result.success).toBe(true);
    const blocked = await prisma.seatStatus.findFirstOrThrow({
      where: { eventId: event.id, seatId: seats[1].id },
    });
    expect(blocked.status).toBe("BLOCKED");
  });
});

describe("como ADMIN", () => {
  beforeEach(() => signedInAs("ADMIN"));

  // El control del test anterior: si todo lanzara, el WORKER pasaría por la razón
  // equivocada.
  it("borra un evento, y con él sus reservas", async () => {
    await expect(deleteEvent(event.id)).resolves.toMatchObject({ success: true });
    expect(await prisma.event.count()).toBe(0);
    expect(await prisma.reservation.count()).toBe(0);
  });

  it("lee los meses con informe", async () => {
    await expect(getAvailableReportMonths()).resolves.toBeInstanceOf(Array);
  });
});
