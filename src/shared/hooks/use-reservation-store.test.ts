/**
 * El total que ve el cliente antes de pagar. Tiene que ser, céntimo a céntimo, lo que
 * el servidor le va a cobrar.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { MANAGEMENT_FEE_OPTIONS_CENTS } from "@/modules/events/config/pricing";
import type { EventWithTeams } from "@/modules/events/types";
import { computeReservationAmount } from "@/modules/payments/domain/amount";

import { useReservationStore } from "./use-reservation-store";

const store = useReservationStore;

/** Lo único que el store lee del evento para calcular el total. */
function eventPriced(pricePerSeat: number, managementFeeCents: number): EventWithTeams {
  return { pricePerSeat, managementFeeCents } as EventWithTeams;
}

function selectSeats(count: number) {
  for (let i = 1; i <= count; i++) store.getState().selectSeat(`seat-${i}`);
}

beforeEach(() => {
  store.getState().reset();
});

describe("getTotalPrice", () => {
  it("dos asientos a 10 € con 1,50 € de gastos: 23 €", () => {
    store.getState().setEvent(eventPriced(10, 150));
    selectSeats(2);

    expect(store.getState().getTotalPrice()).toBe(23);
  });

  it("sin asientos, 0", () => {
    store.getState().setEvent(eventPriced(10, 150));

    expect(store.getState().getTotalPrice()).toBe(0);
  });

  it("sin evento cargado: 10 € por asiento y sin gastos", () => {
    selectSeats(3);

    expect(store.getState().getTotalPrice()).toBe(30);
  });

  it("marcar dos veces el mismo asiento no lo cobra dos veces", () => {
    store.getState().setEvent(eventPriced(10, 150));
    store.getState().selectSeat("A1");
    store.getState().selectSeat("A1");

    expect(store.getState().getTotalPrice()).toBe(11.5);
  });

  it("coincide con lo que calcula el servidor en toda la matriz de precios", () => {
    for (let price = 10; price <= 30; price++) {
      for (const fee of MANAGEMENT_FEE_OPTIONS_CENTS) {
        for (const seats of [1, 2, 3, 7, 47]) {
          store.getState().reset();
          store.getState().setEvent(eventPriced(price, fee));
          selectSeats(seats);

          const server = computeReservationAmount(
            { pricePerSeat: price, managementFeeCents: fee },
            seats,
          ).totalPrice;
          if (store.getState().getTotalPrice() !== server) {
            throw new Error(`cliente ≠ servidor: ${price} € + ${fee} c × ${seats}`);
          }
        }
      }
    }
  });
});
