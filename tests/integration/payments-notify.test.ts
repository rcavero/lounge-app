/**
 * El camino servidor-servidor del dinero: la notificación firmada que Redsys manda a
 * `/api/payments/notify`, y la vuelta del navegador por `/api/payments/return/[orderId]`.
 *
 * Las notificaciones se firman de verdad, con las credenciales públicas del sandbox y el
 * mismo código que usa `scripts/simulate-redsys-notify.ts`. La ruta verifica esa firma
 * igual que en producción: no se mockea nada de Redsys.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as notify } from "@/app/api/payments/notify/route";
import {
  GET as returnGet,
  POST as returnPost,
} from "@/app/api/payments/return/[orderId]/route";
import type { Event, Reservation, Seat } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { initializePayment } from "@/modules/payments/actions";
import { PAID_WITHOUT_SEATS } from "@/modules/payments/domain/outcome";
import { recordPaymentReceipt } from "@/modules/payments/lib/receipt";
import { expirePendingReservation } from "@/modules/reservations/lib/expire";

import {
  signRedsysNotification,
  toFormBody,
  type RedsysNotificationInput,
} from "../../scripts/lib/redsys-notification";
import { freezeClock } from "../fixtures/clock";
import {
  makeEvent,
  makeReservation,
  makeSeatStatuses,
  makeSeats,
  seatStatesOf,
  TEST_NOW,
} from "../fixtures/factories";

/**
 * Una clave 3DES bien formada (32 caracteres en base64, 24 bytes) que no es la del
 * comercio. Firma sin error, pero la ruta tiene que rechazar lo que firma.
 */
const OTHER_KEY = "A".repeat(32);

let seats: Seat[];
let event: Event;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  freezeClock();
  vi.spyOn(console, "log").mockImplementation(() => {});
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  seats = await makeSeats(4);
  event = await makeEvent();
  await makeSeatStatuses(event.id, seats);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Una notificación firmada para la reserva, con su importe exacto salvo que se diga. */
function signedFor(
  reservation: Reservation,
  overrides: Partial<RedsysNotificationInput> = {},
) {
  return signRedsysNotification({
    secretKey: process.env.REDSYS_SECRET_KEY!,
    merchantCode: process.env.REDSYS_MERCHANT_CODE!,
    terminal: process.env.REDSYS_TERMINAL!,
    orderId: reservation.paymentId!,
    amountCents: String(Math.round(Number(reservation.totalPrice) * 100)),
    ok: true,
    date: "14/10/2026",
    hour: "12:00",
    ...overrides,
  });
}

function postNotify(body: URLSearchParams) {
  return notify(
    new Request("http://localhost:3100/api/payments/notify", { method: "POST", body }),
  );
}

async function reload(reservation: Reservation) {
  return prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
}

describe("POST /api/payments/notify — pago autorizado", () => {
  it("confirma la reserva, ocupa los asientos y responde 200 OK", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0], seats[1]] });

    const response = await postNotify(toFormBody(signedFor(reservation)));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");

    expect(await reload(reservation)).toMatchObject({
      status: "CONFIRMED",
      paymentStatus: "COMPLETED",
      confirmedAt: TEST_NOW,
    });
    const states = await seatStatesOf(event.id);
    expect(states[seats[0].id]).toEqual({
      status: "OCCUPIED",
      reservationId: reservation.id,
    });
    expect(states[seats[1].id]).toEqual({
      status: "OCCUPIED",
      reservationId: reservation.id,
    });
  });

  it("guarda el recibo tal y como lo manda Redsys", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });

    await postNotify(toFormBody(signedFor(reservation, { authorisationCode: "U6N2PG" })));

    expect(await reload(reservation)).toMatchObject({
      authorisationCode: "U6N2PG",
      paymentDateTime: "14/10/2026 12:00",
      paymentResponseCode: "0000",
    });
  });

  it("un importe que no cuadra deja traza de auditoría, pero confirma igual", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });

    await postNotify(toFormBody(signedFor(reservation, { amountCents: "999" })));

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("IMPORTE DISCREPANTE"),
    );
    expect((await reload(reservation)).status).toBe("CONFIRMED");
  });

  it("con el importe exacto no hay traza de descuadre", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0], seats[1]] });

    await postNotify(toFormBody(signedFor(reservation)));

    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("POST /api/payments/notify — pago denegado", () => {
  it("cancela la reserva y libera los asientos", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0], seats[1]] });

    const response = await postNotify(toFormBody(signedFor(reservation, { ok: false })));

    expect(response.status).toBe(200);
    expect(await reload(reservation)).toMatchObject({
      status: "CANCELLED",
      paymentStatus: "FAILED",
      confirmedAt: null,
    });
    const states = await seatStatesOf(event.id);
    expect(states[seats[0].id]).toEqual({ status: "AVAILABLE", reservationId: null });
    expect(states[seats[1].id]).toEqual({ status: "AVAILABLE", reservationId: null });
  });

  it("también anota el recibo, sin código de autorización", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });

    await postNotify(toFormBody(signedFor(reservation, { ok: false })));

    expect(await reload(reservation)).toMatchObject({
      authorisationCode: null,
      paymentDateTime: "14/10/2026 12:00",
      paymentResponseCode: "0190",
    });
  });
});

describe("POST /api/payments/notify — lo que no es una notificación válida", () => {
  it("firma de otra clave: responde 200 y no toca la reserva", async () => {
    // 200 y no 4xx: con un error, Redsys reintentaría la notificación en bucle.
    const reservation = await makeReservation({ event, seats: [seats[0]] });
    const before = await reload(reservation);

    const forged = signedFor(reservation, { secretKey: OTHER_KEY });
    const response = await postNotify(toFormBody(forged));

    expect(response.status).toBe(200);
    expect(await reload(reservation)).toEqual(before);
    expect((await seatStatesOf(event.id))[seats[0].id].status).toBe("RESERVED");
  });

  it("parámetros manipulados tras firmar: responde 200 y no toca la reserva", async () => {
    // Alguien intercepta una notificación de KO y la reescribe como OK sin poder firmarla.
    const reservation = await makeReservation({ event, seats: [seats[0]] });
    const before = await reload(reservation);
    const genuineKo = signedFor(reservation, { ok: false });
    const genuineOk = signedFor(reservation, { ok: true });

    const tampered = {
      ...genuineKo,
      Ds_MerchantParameters: genuineOk.Ds_MerchantParameters,
    };
    const response = await postNotify(toFormBody(tampered));

    expect(response.status).toBe(200);
    expect(await reload(reservation)).toEqual(before);
  });

  it("sin cuerpo: responde 200 y no escribe nada", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });
    const before = await reload(reservation);

    const response = await postNotify(new URLSearchParams());

    expect(response.status).toBe(200);
    expect(await reload(reservation)).toEqual(before);
  });

  it("pedido desconocido: responde 200 y no escribe nada", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });
    const before = await reload(reservation);

    const response = await postNotify(
      toFormBody(signedFor(reservation, { orderId: "000000000000" })),
    );

    expect(response.status).toBe(200);
    expect(await reload(reservation)).toEqual(before);
  });
});

/**
 * El webhook actúa SIN filtro de estado, a diferencia del respaldo de las páginas.
 * Estos tests fijan lo que hace cuando la notificación llega sobre una reserva que ya
 * no está pendiente.
 */
describe("POST /api/payments/notify — reserva que ya no está pendiente", () => {
  it("COMPORTAMIENTO ACTUAL: un KO sobre una reserva CONFIRMED la cancela y libera sus asientos", async () => {
    const reservation = await makeReservation({
      event,
      seats: [seats[0]],
      status: "CONFIRMED",
    });

    await postNotify(toFormBody(signedFor(reservation, { ok: false })));

    expect((await reload(reservation)).status).toBe("CANCELLED");
    expect((await seatStatesOf(event.id))[seats[0].id]).toEqual({
      status: "AVAILABLE",
      reservationId: null,
    });
  });
});

/**
 * RCA-276. Una reserva PENDING caduca a los 5 minutos: la caduca `getSeatsForEvent` en
 * cuanto cualquiera abre la página del evento. Si el cliente tarda más que eso en la
 * pasarela (un 3D Secure lento basta) y el pago sale bien, la notificación llega tarde.
 *
 * Antes la reserva pasaba a CONFIRMED sin asientos: se cobraba, el ticket salía vacío y
 * los asientos se podían vender a otro. Ahora se recuperan si siguen libres, y si no,
 * la reserva queda cobrada y anulada para que el bar devuelva el dinero.
 */
describe("POST /api/payments/notify — el pago llega con la reserva ya caducada", () => {
  /** Una reserva caducada por el camino real, con el rastro en sus asientos. */
  async function expired(seatList: Seat[]) {
    const reservation = await makeReservation({ event, seats: seatList });
    expect(await expirePendingReservation(reservation.id)).toBe(true);
    return reservation;
  }

  async function someoneElseReserves(seatList: Seat[], onEvent: Event = event) {
    const result = await initializePayment({
      eventId: onEvent.id,
      seatIds: seatList.map((s) => s.id),
      customerName: "Luis",
    });
    expect(result.success).toBe(true);
    return prisma.reservation.findFirstOrThrow({ where: { customerName: "Luis" } });
  }

  it("si los asientos siguen libres, los recupera y confirma", async () => {
    const reservation = await expired([seats[0], seats[1]]);

    await postNotify(toFormBody(signedFor(reservation)));

    expect(await reload(reservation)).toMatchObject({
      status: "CONFIRMED",
      paymentStatus: "COMPLETED",
      confirmedAt: TEST_NOW,
    });
    const states = await seatStatesOf(event.id);
    for (const seat of [seats[0], seats[1]]) {
      expect(states[seat.id]).toEqual({
        status: "OCCUPIED",
        reservationId: reservation.id,
      });
    }
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("si otro cliente ha cogido uno, queda cobrada y anulada, y no toca el suyo", async () => {
    const reservation = await expired([seats[0], seats[1]]);
    const luis = await someoneElseReserves([seats[1]]);

    await postNotify(toFormBody(signedFor(reservation, { authorisationCode: "U6N2PG" })));

    expect(await reload(reservation)).toMatchObject({
      status: "CANCELLED",
      paymentStatus: "COMPLETED",
      confirmedAt: null,
      // El recibo se guarda igual: el bar lo necesita para localizar la devolución.
      authorisationCode: "U6N2PG",
    });
    const states = await seatStatesOf(event.id);
    // Ni medio rescate: el que seguía libre queda libre, y sin rastro.
    expect(states[seats[0].id]).toEqual({ status: "AVAILABLE", reservationId: null });
    expect(states[seats[1].id]).toEqual({ status: "RESERVED", reservationId: luis.id });
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("COBRADA SIN ASIENTOS"),
    );
  });

  it("si el bar ha bloqueado uno entretanto, queda cobrada y anulada", async () => {
    const reservation = await expired([seats[0]]);
    await prisma.seatStatus.updateMany({
      where: { eventId: event.id, seatId: seats[0].id },
      data: { status: "BLOCKED" },
    });

    await postNotify(toFormBody(signedFor(reservation)));

    expect(await reload(reservation)).toMatchObject(PAID_WITHOUT_SEATS);
    expect((await seatStatesOf(event.id))[seats[0].id]).toEqual({
      status: "BLOCKED",
      reservationId: null,
    });
  });

  it("si el asiento está vendido en un partido que se solapa, queda cobrada y anulada", async () => {
    const reservation = await expired([seats[0]]);
    const overlapping = await makeEvent({
      title: "Otro partido",
      eventDate: new Date(event.eventDate.getTime() + 60 * 60 * 1000),
    });
    await makeSeatStatuses(overlapping.id, seats);
    await someoneElseReserves([seats[0]], overlapping);

    await postNotify(toFormBody(signedFor(reservation)));

    expect(await reload(reservation)).toMatchObject(PAID_WITHOUT_SEATS);
    expect((await seatStatesOf(event.id))[seats[0].id].status).toBe("AVAILABLE");
  });

  it("una EXPIRED sin rastro, de antes de este cambio, queda cobrada y anulada", async () => {
    // Las caducadas antes del despliegue soltaron el vínculo: no hay forma de saber
    // qué asientos eran, así que no se puede rescatar nada.
    const reservation = await makeReservation({
      event,
      seats: [seats[0]],
      status: "EXPIRED",
    });

    await postNotify(toFormBody(signedFor(reservation)));

    expect(await reload(reservation)).toMatchObject(PAID_WITHOUT_SEATS);
    expect((await seatStatesOf(event.id))[seats[0].id].status).toBe("AVAILABLE");
  });

  it("una notificación repetida tras el rescate no cambia nada", async () => {
    const reservation = await expired([seats[0]]);
    const body = toFormBody(signedFor(reservation));

    await postNotify(body);
    const afterFirst = await reload(reservation);
    await postNotify(body);

    // `updatedAt` sí cambia: una notificación repetida vuelve a escribir lo mismo,
    // como ya hacía con una reserva confirmada a tiempo.
    expect(await reload(reservation)).toEqual({
      ...afterFirst,
      updatedAt: expect.any(Date),
    });
    expect((await seatStatesOf(event.id))[seats[0].id].status).toBe("OCCUPIED");
  });

  it("una notificación repetida no reabre una devolución ya hecha", async () => {
    const reservation = await expired([seats[0]]);
    await someoneElseReserves([seats[0]]);
    await postNotify(toFormBody(signedFor(reservation)));
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { paymentStatus: "REFUNDED" },
    });

    await postNotify(toFormBody(signedFor(reservation)));

    expect(await reload(reservation)).toMatchObject({
      status: "CANCELLED",
      paymentStatus: "REFUNDED",
    });
  });

  it("un OK después de un KO de la misma reserva queda cobrado y anulado", async () => {
    // El KO suelta el vínculo, así que no hay rastro que rescatar.
    const reservation = await makeReservation({ event, seats: [seats[0]] });
    await postNotify(toFormBody(signedFor(reservation, { ok: false })));

    await postNotify(toFormBody(signedFor(reservation)));

    expect(await reload(reservation)).toMatchObject(PAID_WITHOUT_SEATS);
  });
});

describe("recordPaymentReceipt", () => {
  it("gana el primero que escribe", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });

    await recordPaymentReceipt(reservation.paymentId!, {
      authorisationCode: "111111",
      date: "14/10/2026",
      hour: "12:00",
      responseCode: "0000",
    });
    await recordPaymentReceipt(reservation.paymentId!, {
      authorisationCode: "222222",
      date: "14/10/2026",
      hour: "12:05",
      responseCode: "0000",
    });

    expect(await reload(reservation)).toMatchObject({
      authorisationCode: "111111",
      paymentDateTime: "14/10/2026 12:00",
    });
  });

  it("sin fecha ni hora no escribe nada", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });

    await recordPaymentReceipt(reservation.paymentId!, {
      authorisationCode: "111111",
      responseCode: "0000",
    });

    expect(await reload(reservation)).toMatchObject({
      authorisationCode: null,
      paymentDateTime: null,
      paymentResponseCode: null,
    });
  });

  it("no cambia el estado de la reserva", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });

    await recordPaymentReceipt(reservation.paymentId!, {
      date: "14/10/2026",
      hour: "12:00",
    });

    expect((await reload(reservation)).status).toBe("PENDING");
  });
});

describe("/api/payments/return/[orderId] — la vuelta del navegador", () => {
  function returnRequest(
    orderId: string,
    query: string,
    body?: URLSearchParams,
  ): [Request, { params: Promise<{ orderId: string }> }] {
    return [
      new Request(`http://localhost:3100/api/payments/return/${orderId}?${query}`, {
        method: body ? "POST" : "GET",
        body,
      }),
      { params: Promise.resolve({ orderId }) },
    ];
  }

  it("POST con la notificación firmada: 303 a la confirmación y anota el recibo", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });
    const orderId = reservation.paymentId!;

    const response = await returnPost(
      ...returnRequest(orderId, "r=ok", toFormBody(signedFor(reservation))),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `http://localhost:3100/reserva/confirmacion/${orderId}`,
    );
    const after = await reload(reservation);
    expect(after.paymentDateTime).toBe("14/10/2026 12:00");
    // Solo anota el recibo: confirmar sigue siendo cosa del webhook o de la página.
    expect(after.status).toBe("PENDING");
    expect((await seatStatesOf(event.id))[seats[0].id].status).toBe("RESERVED");
  });

  it("KO: 303 a la página de error con el pedido y el evento", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });
    const orderId = reservation.paymentId!;

    const response = await returnGet(
      ...returnRequest(orderId, `r=ko&eventId=${event.id}`),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `http://localhost:3100/reserva/error?orderId=${orderId}&eventId=${event.id}`,
    );
    // Tampoco cancela: eso lo hace la página al cargar.
    expect((await reload(reservation)).status).toBe("PENDING");
  });

  it("no anota el recibo si el pedido de la URL no es el firmado", async () => {
    // El orderId de la URL lo controla quien navega; el firmado, no.
    const victim = await makeReservation({ event, seats: [seats[0]] });
    const attacker = await makeReservation({ event, seats: [seats[1]] });

    const response = await returnPost(
      ...returnRequest(victim.paymentId!, "r=ok", toFormBody(signedFor(attacker))),
    );

    expect(response.status).toBe(303);
    expect((await reload(victim)).paymentDateTime).toBeNull();
    expect((await reload(attacker)).paymentDateTime).toBeNull();
  });

  it("con la firma mal, el cliente llega igual a su pantalla y no se anota nada", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });
    const forged = signedFor(reservation, { secretKey: OTHER_KEY });

    const response = await returnPost(
      ...returnRequest(reservation.paymentId!, "r=ok", toFormBody(forged)),
    );

    expect(response.status).toBe(303);
    expect((await reload(reservation)).paymentDateTime).toBeNull();
  });
});
