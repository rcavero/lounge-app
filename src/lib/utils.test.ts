import { describe, expect, it } from "vitest";

import { cn, formatEuros, formatEventDateMadrid } from "./utils";

describe("cn", () => {
  it("descarta los valores falsos de una condición", () => {
    expect(cn("rounded", false && "hidden", undefined, "p-2")).toBe("rounded p-2");
  });

  it("resuelve el conflicto entre dos clases de Tailwind quedándose la última", () => {
    // Es lo único que `cn` aporta sobre concatenar cadenas: sin `twMerge`, el
    // resultado sería "px-2 px-4" y cuál gana dependería del orden del CSS.
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("formatEuros", () => {
  it("usa coma decimal y siempre dos decimales", () => {
    expect(formatEuros(34.5)).toBe("34,50");
    expect(formatEuros(10)).toBe("10,00");
    expect(formatEuros(0)).toBe("0,00");
  });

  it("no añade el símbolo del euro", () => {
    // Lo pone cada vista. Si se añadiera aquí saldría duplicado en las que ya lo ponen.
    expect(formatEuros(12.3)).not.toContain("€");
  });
});

describe("formatEventDateMadrid", () => {
  it("formatea en hora española, no en la del runtime", () => {
    // 20:30 UTC en enero son las 21:30 en Madrid (CET, +1).
    expect(formatEventDateMadrid(new Date("2026-01-15T20:30:00Z"))).toEqual({
      formattedDay: "Jueves",
      dayNumber: "15",
      monthName: "enero",
      time: "21:30",
    });
  });

  it("aplica el horario de verano", () => {
    // Las mismas 20:30 UTC en julio son las 22:30 (CEST, +2). Es el caso que rompe si
    // alguien sustituye el formateo por un desfase fijo de una hora.
    expect(formatEventDateMadrid(new Date("2026-07-15T20:30:00Z"))).toEqual({
      formattedDay: "Miércoles",
      dayNumber: "15",
      monthName: "julio",
      time: "22:30",
    });
  });

  it("pone en mayúscula el día de la semana pero deja el mes en minúscula", () => {
    const { formattedDay, monthName } = formatEventDateMadrid(
      new Date("2026-07-15T20:30:00Z"),
    );

    expect(formattedDay[0]).toBe(formattedDay[0].toUpperCase());
    expect(monthName[0]).toBe(monthName[0].toLowerCase());
  });
});
