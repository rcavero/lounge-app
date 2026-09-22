import { describe, expect, it } from "vitest";

import { espnMonths, getTeamLogo } from "./api-client";

function months(from: string, to: string): string[] {
  return espnMonths(new Date(from), new Date(to));
}

describe("espnMonths", () => {
  it("una ventana dentro de un mes pide un solo mes", () => {
    expect(months("2026-09-10T12:00Z", "2026-09-24T12:00Z")).toEqual(["202609"]);
  });

  it("una ventana que cruza de mes pide los dos", () => {
    expect(months("2026-09-20T12:00Z", "2026-10-04T12:00Z")).toEqual([
      "202609",
      "202610",
    ]);
  });

  it("una ventana que cruza de año pide diciembre y enero", () => {
    expect(months("2026-12-25T12:00Z", "2027-01-08T12:00Z")).toEqual([
      "202612",
      "202701",
    ]);
  });

  it("añade el mes anterior si la ventana empieza el día 1", () => {
    // ESPN agrupa por su día (huso de EE. UU.): un partido a las 00:30 UTC del día 1
    // aparece listado en el mes anterior. El margen de un día lo recoge.
    expect(months("2026-10-01T00:30Z", "2026-10-10T12:00Z")).toEqual([
      "202609",
      "202610",
    ]);
  });

  it("añade el mes siguiente si la ventana acaba el último día", () => {
    expect(months("2026-09-20T12:00Z", "2026-09-30T23:00Z")).toEqual([
      "202609",
      "202610",
    ]);
  });

  it("no se salta febrero al empezar un día 31", () => {
    // La trampa clásica de sumar un mes a una fecha: el 31 de enero + 1 mes es el 3
    // de marzo. Por eso el cursor se lleva al día 1 antes de avanzar.
    expect(months("2026-01-31T12:00Z", "2026-03-02T12:00Z")).toEqual([
      "202601",
      "202602",
      "202603",
    ]);
  });

  it("usa meses con dos cifras", () => {
    expect(months("2026-03-10T12:00Z", "2026-03-12T12:00Z")).toEqual(["202603"]);
  });
});

describe("getTeamLogo", () => {
  it("prefiere logo sobre logos[0]", () => {
    expect(
      getTeamLogo({
        id: "1",
        displayName: "X",
        logo: "a.png",
        logos: [{ href: "b.png" }],
      }),
    ).toBe("a.png");
  });

  it("cae a logos[0] y después a null", () => {
    expect(getTeamLogo({ id: "1", displayName: "X", logos: [{ href: "b.png" }] })).toBe(
      "b.png",
    );
    expect(getTeamLogo({ id: "1", displayName: "X", logos: [] })).toBeNull();
    expect(getTeamLogo({ id: "1", displayName: "X" })).toBeNull();
  });
});
