/**
 * El test más valioso de la suite: la fórmula de lo que se cobra, recorrida entera.
 */
import { describe, expect, it } from "vitest";

import { MANAGEMENT_FEE_OPTIONS_CENTS } from "@/modules/events/config/pricing";

import {
  computeReservationAmount,
  expectedCentsFromTotalPrice,
  toRedsysAmount,
} from "./amount";

describe("computeReservationAmount — casos con nombre", () => {
  it.each([
    ["el partido de siempre: 10 € + 1,50 €, un asiento", 10, 150, 1, 1150, 11.5],
    ["dos asientos", 10, 150, 2, 2300, 23],
    ["sin gastos de gestión", 10, 0, 3, 3000, 30],
    ["gastos máximos: 5 €", 10, 500, 1, 1500, 15],
    ["medio euro de gastos: importe no redondo", 10, 50, 3, 3150, 31.5],
    ["precio máximo, aforo completo", 30, 500, 47, 164_500, 1645],
    ["gratis y sin gastos", 0, 0, 4, 0, 0],
  ])("%s", (_label, pricePerSeat, managementFeeCents, seats, totalCents, totalPrice) => {
    expect(computeReservationAmount({ pricePerSeat, managementFeeCents }, seats)).toEqual(
      {
        seatPriceCents: pricePerSeat * 100,
        managementFeeCents,
        totalCents,
        totalPrice,
      },
    );
  });

  it("congela los importes unitarios tal cual vienen del evento", () => {
    const amount = computeReservationAmount(
      { pricePerSeat: 12, managementFeeCents: 250 },
      2,
    );

    expect(amount.seatPriceCents).toBe(1200);
    expect(amount.managementFeeCents).toBe(250);
  });
});

/**
 * Toda la matriz de valores posibles: precios de 0 a 30 €, los 11 gastos de gestión
 * permitidos y de 1 a 47 asientos (el aforo). Son 16.027 combinaciones.
 */
const MATRIX = (() => {
  const cases: Array<[number, number, number]> = [];
  for (let price = 0; price <= 30; price++) {
    for (const fee of MANAGEMENT_FEE_OPTIONS_CENTS) {
      for (let seats = 1; seats <= 47; seats++) cases.push([price, fee, seats]);
    }
  }
  return cases;
})();

describe("computeReservationAmount — invariantes en toda la matriz", () => {
  it("recorre las 16.027 combinaciones", () => {
    expect(MATRIX).toHaveLength(31 * 11 * 47);
  });

  it("el total en céntimos es siempre un entero", () => {
    for (const [pricePerSeat, managementFeeCents, seats] of MATRIX) {
      const { totalCents } = computeReservationAmount(
        { pricePerSeat, managementFeeCents },
        seats,
      );
      if (!Number.isInteger(totalCents)) {
        throw new Error(
          `no entero: ${pricePerSeat} € + ${managementFeeCents} c × ${seats}`,
        );
      }
    }
  });

  it("cumple la regla del CHECK de la base de datos", () => {
    for (const [pricePerSeat, managementFeeCents, seats] of MATRIX) {
      const a = computeReservationAmount({ pricePerSeat, managementFeeCents }, seats);
      // totalPrice * 100 = (seatPriceCents + managementFeeCents) * numberOfSeats
      if (
        Math.round(a.totalPrice * 100) !==
        (a.seatPriceCents + a.managementFeeCents) * seats
      ) {
        throw new Error(`CHECK: ${pricePerSeat} € + ${managementFeeCents} c × ${seats}`);
      }
    }
  });

  it("totalPrice nunca tiene más de dos decimales al pasarlo a texto", () => {
    // Prisma convierte el number a Decimal a través de su representación en texto: si
    // saliera "19.989999999999998", el CHECK de la base de datos lo rechazaría.
    for (const [pricePerSeat, managementFeeCents, seats] of MATRIX) {
      const { totalPrice } = computeReservationAmount(
        { pricePerSeat, managementFeeCents },
        seats,
      );
      if (!/^\d+(\.\d{1,2})?$/.test(String(totalPrice))) {
        throw new Error(
          `"${totalPrice}": ${pricePerSeat} € + ${managementFeeCents} c × ${seats}`,
        );
      }
    }
  });

  it("expectedCentsFromTotalPrice(totalPrice) devuelve exactamente totalCents", () => {
    // Es lo que demuestra que la traza IMPORTE DISCREPANTE del webhook no puede saltar en
    // falso con un importe correcto.
    for (const [pricePerSeat, managementFeeCents, seats] of MATRIX) {
      const a = computeReservationAmount({ pricePerSeat, managementFeeCents }, seats);
      if (expectedCentsFromTotalPrice(a.totalPrice) !== a.totalCents) {
        throw new Error(
          `descuadre: ${pricePerSeat} € + ${managementFeeCents} c × ${seats}`,
        );
      }
    }
  });
});

describe("expectedCentsFromTotalPrice", () => {
  it("redondea, no trunca: 19,99 € son 1999 céntimos aunque 19.99 * 100 = 1998.99…", () => {
    expect(19.99 * 100).not.toBe(1999);
    expect(expectedCentsFromTotalPrice(19.99)).toBe(1999);
  });
});

describe("toRedsysAmount", () => {
  it.each([
    [2300, "2300"],
    [3150, "3150"],
    [0, "0"],
  ])("%i céntimos → %s", (cents, expected) => {
    expect(toRedsysAmount(cents)).toBe(expected);
  });
});
