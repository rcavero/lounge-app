import { describe, expect, it } from "vitest";

import {
  BOOKING_CLOSES_BEFORE_MS,
  BOOKING_OPENS_BEFORE_MS,
  bookingClosedReason,
  bookingWindowReason,
} from "./booking-window";

const NOW = new Date("2026-10-14T10:00:00.000Z");
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const inMs = (ms: number) => new Date(NOW.getTime() + ms);

describe("bookingWindowReason — de 48 h a 4 h antes", () => {
  it("las cifras son 48 h y 4 h", () => {
    expect(BOOKING_OPENS_BEFORE_MS).toBe(48 * HOUR);
    expect(BOOKING_CLOSES_BEFORE_MS).toBe(4 * HOUR);
  });

  it("a 24 h está abierta", () => {
    expect(bookingWindowReason(inMs(24 * HOUR), NOW)).toBeNull();
  });

  it("justo a 48 h ya está abierta; un minuto antes, todavía no", () => {
    expect(bookingWindowReason(inMs(48 * HOUR), NOW)).toBeNull();
    expect(bookingWindowReason(inMs(48 * HOUR + MINUTE), NOW)).toBe("too-early");
  });

  it("justo a 4 h todavía está abierta; un minuto después, ya no", () => {
    expect(bookingWindowReason(inMs(4 * HOUR), NOW)).toBeNull();
    expect(bookingWindowReason(inMs(4 * HOUR - MINUTE), NOW)).toBe("too-late");
  });

  it("un evento que ya ha empezado, o ya se ha jugado, está cerrado", () => {
    expect(bookingWindowReason(inMs(-1 * HOUR), NOW)).toBe("too-late");
    expect(bookingWindowReason(inMs(-30 * 24 * HOUR), NOW)).toBe("too-late");
  });
});

describe("bookingClosedReason — el reloj y el estado", () => {
  it("un evento UPCOMING en ventana admite reservas", () => {
    expect(
      bookingClosedReason({ eventDate: inMs(24 * HOUR), status: "UPCOMING" }, NOW),
    ).toBeNull();
  });

  it.each(["LIVE", "FINISHED", "CANCELLED"])(
    "un evento %s no admite reservas, aunque esté en ventana",
    (status) => {
      expect(bookingClosedReason({ eventDate: inMs(24 * HOUR), status }, NOW)).toBe(
        "not-upcoming",
      );
    },
  );

  it("fuera de ventana, dice por qué", () => {
    expect(
      bookingClosedReason({ eventDate: inMs(72 * HOUR), status: "UPCOMING" }, NOW),
    ).toBe("too-early");
    expect(
      bookingClosedReason({ eventDate: inMs(2 * HOUR), status: "UPCOMING" }, NOW),
    ).toBe("too-late");
  });

  it("el estado manda sobre el reloj", () => {
    expect(
      bookingClosedReason({ eventDate: inMs(72 * HOUR), status: "CANCELLED" }, NOW),
    ).toBe("not-upcoming");
  });
});
