import { describe, expect, it } from "vitest";

import { eventWindow, overlappingEventIds, windowsOverlap } from "./overlap";

const MINUTE = 60 * 1000;

/** El partido de referencia: sábado 17 de octubre de 2026, 20:00 en Madrid, 120 minutos. */
const TARGET = { eventDate: new Date("2026-10-17T20:00:00+02:00"), durationMinutes: 120 };

function startingAt(offsetMinutes: number, durationMinutes = 120, id = "otro") {
  return {
    id,
    eventDate: new Date(TARGET.eventDate.getTime() + offsetMinutes * MINUTE),
    durationMinutes,
  };
}

const overlaps = (other: ReturnType<typeof startingAt>) =>
  overlappingEventIds(TARGET, [other]).length === 1;

describe("eventWindow", () => {
  it("va del inicio al inicio más la duración, en milisegundos", () => {
    const window = eventWindow(TARGET);

    expect(window.start).toBe(TARGET.eventDate.getTime());
    expect(window.end - window.start).toBe(120 * MINUTE);
  });
});

describe("solape con el partido de las 20:00 (120 min)", () => {
  it.each([
    ["empieza antes y termina dentro", -60],
    ["empieza dentro y termina después", 60],
    ["es idéntico", 0],
  ])("se solapa si el otro %s", (_label, offset) => {
    expect(overlaps(startingAt(offset))).toBe(true);
  });

  it("se solapa si el otro está contenido dentro", () => {
    expect(overlaps(startingAt(30, 30))).toBe(true);
  });

  it("se solapa si el otro lo contiene", () => {
    expect(overlaps(startingAt(-60, 300))).toBe(true);
  });

  it("NO se solapa con uno que empieza justo cuando este termina (22:00)", () => {
    // La frontera que decide si un asiento se vende dos veces.
    expect(overlaps(startingAt(120))).toBe(false);
  });

  it("NO se solapa con uno que termina justo cuando este empieza (18:00-20:00)", () => {
    expect(overlaps(startingAt(-120))).toBe(false);
  });

  it("un minuto de más a cada lado ya solapa", () => {
    expect(overlaps(startingAt(119))).toBe(true);
    expect(overlaps(startingAt(-119))).toBe(true);
  });

  it("NO se solapa con uno de otro día", () => {
    expect(overlaps(startingAt(24 * 60))).toBe(false);
  });

  it("detecta el solape cuando el otro cruza la medianoche", () => {
    // 21:30 a 00:30.
    expect(overlaps(startingAt(90, 180))).toBe(true);
  });

  it("cruza el cambio de hora sin descuadrarse: cuenta minutos reales, no de reloj", () => {
    // La madrugada del 25 de octubre de 2026 los relojes de Madrid vuelven de 3:00 a 2:00.
    // Un partido de 01:00 a 03:00 (hora de verano) y otro que empieza a las 02:30 de la
    // hora de invierno: entre los dos inicios hay 150 minutos reales, así que no solapan.
    const night = {
      eventDate: new Date("2026-10-25T01:00:00+02:00"),
      durationMinutes: 120,
    };
    const after = {
      id: "después",
      eventDate: new Date("2026-10-25T02:30:00+01:00"),
      durationMinutes: 60,
    };

    expect(overlappingEventIds(night, [after])).toEqual([]);
  });
});

describe("windowsOverlap", () => {
  it("es simétrico", () => {
    const a = { start: 0, end: 10 };
    const b = { start: 5, end: 15 };

    expect(windowsOverlap(a, b)).toBe(true);
    expect(windowsOverlap(b, a)).toBe(true);
  });

  it("una ventana de duración cero cuenta como solape si cae dentro, y no si cae en el borde", () => {
    expect(windowsOverlap({ start: 5, end: 5 }, { start: 0, end: 10 })).toBe(true);
    expect(windowsOverlap({ start: 10, end: 10 }, { start: 0, end: 10 })).toBe(false);
  });
});

describe("overlappingEventIds", () => {
  it("devuelve solo los ids que se solapan, en el orden de entrada", () => {
    const candidates = [
      startingAt(60, 120, "b"),
      startingAt(120, 120, "pegado"),
      startingAt(-30, 60, "a"),
      startingAt(24 * 60, 120, "mañana"),
    ];

    expect(overlappingEventIds(TARGET, candidates)).toEqual(["b", "a"]);
  });

  it("no excluye al propio evento: por eso la consulta lo saca antes", () => {
    const itself = { id: "yo", ...TARGET };

    expect(overlappingEventIds(TARGET, [itself])).toEqual(["yo"]);
  });

  it("sin candidatos, ninguno", () => {
    expect(overlappingEventIds(TARGET, [])).toEqual([]);
  });
});
