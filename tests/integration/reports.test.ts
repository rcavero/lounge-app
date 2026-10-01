/**
 * Informes mensuales del panel: qué meses se ofrecen y qué entra en cada uno. Es la red
 * de la extracción de `reservations/domain/report-months.ts` (P4).
 *
 * Los meses se cortan en hora LOCAL (`new Date(year, month, 1)`), y la suite corre con
 * `TZ=Europe/Madrid`. El caso delicado es un partido a las 00:30 del día 1: en Valencia
 * ya es el mes nuevo, pero en UTC todavía es el anterior.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireAuth } from "@/lib/auth-guard";
import {
  getAvailableReportMonths,
  getMonthlyReportData,
} from "@/modules/reservations/actions";

import { freezeClock } from "../fixtures/clock";
import {
  at,
  days,
  makeEvent,
  makeReservation,
  makeSeatStatuses,
  makeSeats,
} from "../fixtures/factories";

vi.mock("@/lib/auth-guard", () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}));

beforeEach(() => {
  // TEST_NOW: 14 de octubre de 2026, 12:00 en Madrid.
  freezeClock();
  vi.mocked(requireAuth).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

/** Una fecha en hora de Madrid (CEST, +02:00, en todas las de este fichero). */
const madrid = (isoLocal: string) => new Date(`${isoLocal}+02:00`);

describe("getAvailableReportMonths", () => {
  it("agrupa los partidos de los últimos 90 días por mes, del más reciente al más antiguo", async () => {
    await makeEvent({ eventDate: madrid("2026-08-01T21:00:00") });
    await makeEvent({ eventDate: madrid("2026-08-20T21:00:00") });
    await makeEvent({ eventDate: madrid("2026-09-10T21:00:00") });
    await makeEvent({ eventDate: madrid("2026-10-01T21:00:00") });

    expect(await getAvailableReportMonths()).toEqual([
      { year: 2026, month: 9, label: "Octubre 2026", eventCount: 1 },
      { year: 2026, month: 8, label: "Septiembre 2026", eventCount: 1 },
      { year: 2026, month: 7, label: "Agosto 2026", eventCount: 2 },
    ]);
  });

  it("corta el mes en hora de Madrid, no en UTC", async () => {
    // 1 de octubre a las 00:30 en Madrid = 30 de septiembre a las 22:30 UTC.
    await makeEvent({ eventDate: madrid("2026-10-01T00:30:00") });

    expect(await getAvailableReportMonths()).toEqual([
      { year: 2026, month: 9, label: "Octubre 2026", eventCount: 1 },
    ]);
  });

  it("deja fuera los partidos futuros y los de hace más de 90 días", async () => {
    await makeEvent({ eventDate: at(days(1)) });
    await makeEvent({ eventDate: at(-days(91)) });

    expect(await getAvailableReportMonths()).toEqual([]);
  });

  it("cruza el año: diciembre va después de enero", async () => {
    freezeClock(madrid("2027-01-20T12:00:00"));
    await makeEvent({ eventDate: madrid("2026-12-20T21:00:00") });
    await makeEvent({ eventDate: madrid("2027-01-10T21:00:00") });

    expect((await getAvailableReportMonths()).map((m) => m.label)).toEqual([
      "Enero 2027",
      "Diciembre 2026",
    ]);
  });
});

describe("getMonthlyReportData", () => {
  it("devuelve los partidos del mes con sus reservas CONFIRMED, en orden, y el total como número", async () => {
    const seats = await makeSeats(3);
    const late = await makeEvent({
      title: "Tarde",
      eventDate: madrid("2026-09-20T21:00:00"),
    });
    const early = await makeEvent({
      title: "Pronto",
      eventDate: madrid("2026-09-05T21:00:00"),
    });
    for (const e of [late, early]) await makeSeatStatuses(e.id, seats);

    const paid = await makeReservation({
      event: early,
      seats: [seats[0], seats[1]],
      status: "CONFIRMED",
    });
    await makeReservation({ event: early, seats: [seats[2]], status: "PENDING" });
    await makeReservation({ event: late, seats: [seats[0]], status: "CANCELLED" });

    const report = await getMonthlyReportData(2026, 8);

    expect(report.map((e) => e.id)).toEqual([early.id, late.id]);
    expect(report[0].reservations).toEqual([
      { id: paid.id, numberOfSeats: 2, totalPrice: 23 },
    ]);
    expect(report[1].reservations).toEqual([]);
  });

  it("incluye el primer minuto del mes y el último, en hora de Madrid", async () => {
    const first = await makeEvent({ eventDate: madrid("2026-09-01T00:00:00") });
    const last = await makeEvent({ eventDate: madrid("2026-09-30T23:59:59") });
    await makeEvent({ eventDate: madrid("2026-08-31T23:59:59") });
    await makeEvent({ eventDate: madrid("2026-10-01T00:00:00") });

    const report = await getMonthlyReportData(2026, 8);

    expect(report.map((e) => e.id)).toEqual([first.id, last.id]);
  });

  it("febrero de un año bisiesto llega hasta el 29", async () => {
    const leapDay = await makeEvent({ eventDate: new Date("2028-02-29T20:00:00+01:00") });
    await makeEvent({ eventDate: new Date("2028-03-01T20:00:00+01:00") });

    const report = await getMonthlyReportData(2028, 1);

    expect(report.map((e) => e.id)).toEqual([leapDay.id]);
  });

  it("diciembre llega hasta el 31 y no se come enero", async () => {
    const newYearsEve = await makeEvent({
      eventDate: new Date("2026-12-31T23:30:00+01:00"),
    });
    await makeEvent({ eventDate: new Date("2027-01-01T00:30:00+01:00") });

    const report = await getMonthlyReportData(2026, 11);

    expect(report.map((e) => e.id)).toEqual([newYearsEve.id]);
  });
});
