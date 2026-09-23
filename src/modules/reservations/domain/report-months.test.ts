/**
 * Corre con `TZ=Europe/Madrid` (lo fija `vitest.config.mts`): las fechas de aquí se
 * escriben con su desfase explícito para que se lean como hora de Madrid.
 */
import { describe, expect, it } from "vitest";

import { groupEventsByMonth, monthRange } from "./report-months";

const madrid = (iso: string) => new Date(iso);

describe("monthRange", () => {
  it("septiembre: del 1 a las 00:00 al 30 a las 23:59:59.999, hora de Madrid", () => {
    const { startDate, endDate } = monthRange(2026, 8);

    expect(startDate.toISOString()).toBe("2026-08-31T22:00:00.000Z");
    expect(endDate.toISOString()).toBe("2026-09-30T21:59:59.999Z");
  });

  it("febrero de un año bisiesto llega al 29", () => {
    expect(monthRange(2028, 1).endDate.getDate()).toBe(29);
  });

  it("febrero de un año normal llega al 28", () => {
    expect(monthRange(2027, 1).endDate.getDate()).toBe(28);
  });

  it("diciembre termina el 31 y no pasa a enero", () => {
    const { endDate } = monthRange(2026, 11);

    expect(endDate.getFullYear()).toBe(2026);
    expect(endDate.getMonth()).toBe(11);
    expect(endDate.getDate()).toBe(31);
  });

  it("un mes con cambio de hora dentro: octubre empieza en CEST y termina en CET", () => {
    const { startDate, endDate } = monthRange(2026, 9);

    expect(startDate.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(endDate.toISOString()).toBe("2026-10-31T22:59:59.999Z");
  });
});

describe("groupEventsByMonth", () => {
  it("cuenta por mes y ordena del más reciente al más antiguo", () => {
    const months = groupEventsByMonth([
      madrid("2026-08-01T21:00:00+02:00"),
      madrid("2026-10-01T21:00:00+02:00"),
      madrid("2026-08-20T21:00:00+02:00"),
    ]);

    expect(months).toEqual([
      { year: 2026, month: 9, label: "Octubre 2026", eventCount: 1 },
      { year: 2026, month: 7, label: "Agosto 2026", eventCount: 2 },
    ]);
  });

  it("corta el mes en hora de Madrid: las 00:30 del día 1 son del mes nuevo", () => {
    // = 30 de septiembre, 22:30 UTC.
    expect(groupEventsByMonth([madrid("2026-10-01T00:30:00+02:00")])).toEqual([
      { year: 2026, month: 9, label: "Octubre 2026", eventCount: 1 },
    ]);
  });

  it("ordena por año antes que por mes", () => {
    const labels = groupEventsByMonth([
      madrid("2026-12-20T21:00:00+01:00"),
      madrid("2027-01-10T21:00:00+01:00"),
      madrid("2026-11-10T21:00:00+01:00"),
    ]).map((m) => m.label);

    expect(labels).toEqual(["Enero 2027", "Diciembre 2026", "Noviembre 2026"]);
  });

  it("sin eventos, ningún mes", () => {
    expect(groupEventsByMonth([])).toEqual([]);
  });

  it("no modifica las fechas que recibe", () => {
    const date = madrid("2026-08-01T21:00:00+02:00");
    const copy = new Date(date);

    groupEventsByMonth([date]);

    expect(date).toEqual(copy);
  });
});
