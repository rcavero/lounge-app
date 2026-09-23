import { describe, expect, it } from "vitest";

import { reservationUpdateFor, seatUpdateFor } from "./outcome";

const NOW = new Date("2026-10-14T10:00:00.000Z");

describe("pago autorizado", () => {
  it("la reserva pasa a CONFIRMED, el pago a COMPLETED, y se sella confirmedAt", () => {
    expect(reservationUpdateFor("ok", NOW)).toEqual({
      status: "CONFIRMED",
      paymentStatus: "COMPLETED",
      confirmedAt: NOW,
    });
  });

  it("los asientos pasan a OCCUPIED y conservan su vínculo con la reserva", () => {
    // Sin `reservationId` en el objeto: el vínculo no se toca.
    expect(seatUpdateFor("ok")).toEqual({ status: "OCCUPIED" });
  });
});

describe("pago denegado", () => {
  it("la reserva pasa a CANCELLED y el pago a FAILED, sin confirmedAt", () => {
    expect(reservationUpdateFor("ko")).toEqual({
      status: "CANCELLED",
      paymentStatus: "FAILED",
    });
  });

  it("los asientos vuelven a AVAILABLE y pierden el vínculo", () => {
    expect(seatUpdateFor("ko")).toEqual({ status: "AVAILABLE", reservationId: null });
  });
});
