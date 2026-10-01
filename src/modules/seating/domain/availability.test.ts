import { describe, expect, it } from "vitest";

import type { SeatStatusType } from "@/generated/prisma";

import { applyOverlapOccupancy, effectiveSeatStatus } from "./availability";

const map = (entries: Record<string, SeatStatusType>) => new Map(Object.entries(entries));

describe("applyOverlapOccupancy", () => {
  it("un asiento libre aquí y tomado en un evento solapado pasa a OCCUPIED", () => {
    const result = applyOverlapOccupancy(map({ A1: "AVAILABLE" }), [{ seatId: "A1" }]);

    expect(result.get("A1")).toBe("OCCUPIED");
  });

  it("un BLOQUEO de este evento nunca se pisa", () => {
    const result = applyOverlapOccupancy(map({ A1: "BLOCKED" }), [{ seatId: "A1" }]);

    expect(result.get("A1")).toBe("BLOCKED");
  });

  it.each(["RESERVED", "OCCUPIED"] as const)(
    "un %s de este evento se queda como está",
    (status) => {
      const result = applyOverlapOccupancy(map({ A1: status }), [{ seatId: "A1" }]);

      expect(result.get("A1")).toBe(status);
    },
  );

  it("un asiento sin fila aquí cuenta como libre, y se ocupa", () => {
    const result = applyOverlapOccupancy(map({}), [{ seatId: "A1" }]);

    expect(result.get("A1")).toBe("OCCUPIED");
  });

  it("no toca los asientos que nadie ha tomado fuera", () => {
    const result = applyOverlapOccupancy(map({ A1: "AVAILABLE", A2: "AVAILABLE" }), [
      { seatId: "A1" },
    ]);

    expect(result.get("A2")).toBe("AVAILABLE");
  });

  it("el mismo asiento tomado en dos eventos solapados se marca una vez", () => {
    const result = applyOverlapOccupancy(map({ A1: "AVAILABLE" }), [
      { seatId: "A1" },
      { seatId: "A1" },
    ]);

    expect([...result]).toEqual([["A1", "OCCUPIED"]]);
  });

  it("no modifica el mapa que recibe", () => {
    const input = map({ A1: "AVAILABLE" });

    applyOverlapOccupancy(input, [{ seatId: "A1" }]);

    expect(input.get("A1")).toBe("AVAILABLE");
  });
});

describe("effectiveSeatStatus", () => {
  it("devuelve el estado guardado", () => {
    expect(effectiveSeatStatus(map({ A1: "BLOCKED" }), "A1")).toBe("BLOCKED");
  });

  it("sin fila, AVAILABLE", () => {
    expect(effectiveSeatStatus(map({}), "A1")).toBe("AVAILABLE");
  });
});
