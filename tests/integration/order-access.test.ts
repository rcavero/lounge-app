/**
 * El nº de pedido ya no basta para abrir una reserva (RCA-285).
 *
 * El nº de pedido son los 12 últimos dígitos de `Date.now()`: se adivina sabiendo más o
 * menos cuándo se compró. Con él, la página de confirmación enseñaba el ticket de otro
 * cliente, y la de error cancelaba una reserva a medio pagar. Ahora cada reserva lleva
 * una llave aleatoria que solo conoce quien la ha comprado, porque viaja en las URL de
 * vuelta que la app firma para Redsys.
 *
 * Las reservas anteriores al cambio no tienen llave y se siguen abriendo sin ella: sus
 * URL ya están en manos de sus clientes y no se pueden reescribir. La retención de 90
 * días las acaba borrando.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Event, Seat } from "@/generated/prisma";
import { GET as returnGet } from "@/app/api/payments/return/[orderId]/route";
import { prisma } from "@/lib/prisma";
import { getReservationByOrderId, initializePayment } from "@/modules/payments/actions";
import {
  cancelReservationByOrderId,
  confirmReservationByOrderId,
  hasReservationAccess,
} from "@/modules/payments/lib/return-pages";

import { freezeClock } from "../fixtures/clock";
import {
  makeEvent,
  makeReservation,
  makeSeatStatuses,
  makeSeats,
} from "../fixtures/factories";

const KEY = "llave-de-la-reserva-de-ana-0123456789";

let seats: Seat[];
let event: Event;

beforeEach(async () => {
  freezeClock();
  vi.spyOn(console, "log").mockImplementation(() => {});

  seats = await makeSeats(4);
  event = await makeEvent();
  await makeSeatStatuses(event.id, seats);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function signedParams(formBody: { Ds_MerchantParameters: string } | undefined) {
  return JSON.parse(
    Buffer.from(formBody!.Ds_MerchantParameters, "base64").toString("utf8"),
  );
}

describe("initializePayment reparte una llave por reserva", () => {
  it("aleatoria, de al menos 128 bits y distinta en cada reserva", async () => {
    await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id],
      customerName: "Ana",
    });
    await initializePayment({
      eventId: event.id,
      seatIds: [seats[1].id],
      customerName: "Eva",
    });

    const tokens = (await prisma.reservation.findMany()).map((r) => r.accessToken);
    expect(tokens).toHaveLength(2);
    for (const token of tokens) {
      // 16 bytes en base64url son 22 caracteres.
      expect(token).toMatch(/^[A-Za-z0-9_-]{22,}$/);
    }
    expect(tokens[0]).not.toBe(tokens[1]);
  });

  it("las dos vueltas de Redsys la llevan: es lo único que la hace llegar al cliente", async () => {
    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id],
      customerName: "Ana",
    });

    const { paymentId, accessToken } = await prisma.reservation.findFirstOrThrow();
    const params = signedParams(result.formBody);

    expect(params.DS_MERCHANT_URLOK).toBe(
      `http://localhost:3100/api/payments/return/${paymentId}?r=ok&t=${accessToken}`,
    );
    expect(params.DS_MERCHANT_URLKO).toBe(
      `http://localhost:3100/api/payments/return/${paymentId}?r=ko&eventId=${event.id}&t=${accessToken}`,
    );
  });
});

describe("la vuelta del navegador pasa la llave a las páginas", () => {
  function get(orderId: string, query: string) {
    return returnGet(
      new Request(`http://localhost:3100/api/payments/return/${orderId}?${query}`),
      { params: Promise.resolve({ orderId }) },
    );
  }

  it("OK: a la confirmación, con la llave", async () => {
    const response = await get("900000000001", `r=ok&t=${KEY}`);
    expect(response.headers.get("location")).toBe(
      `http://localhost:3100/reserva/confirmacion/900000000001?t=${KEY}`,
    );
  });

  it("KO: a la página de error, con el pedido, el evento y la llave", async () => {
    const response = await get("900000000001", `r=ko&eventId=${event.id}&t=${KEY}`);
    expect(response.headers.get("location")).toBe(
      `http://localhost:3100/reserva/error?orderId=900000000001&eventId=${event.id}&t=${KEY}`,
    );
  });
});

describe("el ticket solo se entrega con la llave", () => {
  it("sin llave, con otra o con una más corta, no hay ticket", async () => {
    const reservation = await makeReservation({
      event,
      seats: [seats[0]],
      status: "CONFIRMED",
      accessToken: KEY,
    });
    const orderId = reservation.paymentId!;

    expect(await getReservationByOrderId(orderId)).toBeNull();
    expect(await getReservationByOrderId(orderId, null)).toBeNull();
    expect(await getReservationByOrderId(orderId, "")).toBeNull();
    expect(await getReservationByOrderId(orderId, `${KEY}x`)).toBeNull();
    expect(await getReservationByOrderId(orderId, KEY.slice(0, -1))).toBeNull();
    expect(await hasReservationAccess(orderId, "otra")).toBe(false);
  });

  it("con la suya, sí", async () => {
    const reservation = await makeReservation({
      event,
      seats: [seats[0]],
      status: "CONFIRMED",
      accessToken: KEY,
    });

    expect(await hasReservationAccess(reservation.paymentId!, KEY)).toBe(true);
    expect(await getReservationByOrderId(reservation.paymentId!, KEY)).toMatchObject({
      id: reservation.id,
      customerName: "Ana",
    });
  });

  it("una reserva de antes del cambio, sin llave, se sigue abriendo sin ella", async () => {
    const legacy = await makeReservation({
      event,
      seats: [seats[0]],
      status: "CONFIRMED",
    });

    expect(await hasReservationAccess(legacy.paymentId!, undefined)).toBe(true);
    expect(await getReservationByOrderId(legacy.paymentId!)).toMatchObject({
      id: legacy.id,
    });
  });

  it("un pedido que no existe no da acceso", async () => {
    expect(await hasReservationAccess("000000000000", KEY)).toBe(false);
  });
});

describe("confirmReservationByOrderId ya no es una server action", () => {
  it("en producción no confirma nada: allí solo confirma el webhook", async () => {
    vi.stubEnv("REDSYS_ENV", "production");
    const reservation = await makeReservation({ event, seats: [seats[0]] });

    await confirmReservationByOrderId(reservation.paymentId!);

    const after = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(after.status).toBe("PENDING");
  });

  it("fuera de producción sigue confirmando: es el respaldo cuando el webhook no llega", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });

    await confirmReservationByOrderId(reservation.paymentId!);

    const after = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(after.status).toBe("CONFIRMED");
  });

  it("cancelar también vive fuera de las acciones", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });

    await cancelReservationByOrderId(reservation.paymentId!);

    const after = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(after.status).toBe("CANCELLED");
  });
});

describe("las acciones públicas ya no exportan confirmar ni cancelar", () => {
  it("payments/actions solo expone iniciar el pago y leer el ticket", async () => {
    const actions = await import("@/modules/payments/actions");
    expect(Object.keys(actions).sort()).toEqual([
      "getReservationByOrderId",
      "initializePayment",
    ]);
  });
});
