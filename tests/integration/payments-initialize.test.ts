/**
 * `initializePayment` contra Postgres real: lo que pasa en la base de datos cuando un
 * cliente pulsa RESERVAR, antes de que salga hacia la pasarela.
 *
 * Es el único punto donde se decide cuánto se cobra y qué asientos se apartan, así que
 * los tests miran las filas, no solo el valor devuelto.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Event, Seat, SeatStatusType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getReservationByOrderId, initializePayment } from "@/modules/payments/actions";

import { freezeClock } from "../fixtures/clock";
import {
  hours,
  makeEvent,
  makeReservation,
  makeSeatStatuses,
  makeSeats,
  minutes,
  seatStatesOf,
  TEST_NOW,
} from "../fixtures/factories";

let seats: Seat[];
let event: Event;

beforeEach(async () => {
  freezeClock();
  // La action deja una traza por reserva creada; en los tests solo es ruido.
  vi.spyOn(console, "log").mockImplementation(() => {});

  seats = await makeSeats(4);
  event = await makeEvent();
  await makeSeatStatuses(event.id, seats);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Lo que va firmado hacia Redsys, decodificado. */
function signedParams(formBody: { Ds_MerchantParameters: string } | undefined) {
  expect(formBody).toBeDefined();
  return JSON.parse(
    Buffer.from(formBody!.Ds_MerchantParameters, "base64").toString("utf8"),
  );
}

/** Foto de todo lo que `initializePayment` podría escribir. */
async function snapshotWrites() {
  return {
    reservations: await prisma.reservation.count(),
    seatStatuses: await prisma.seatStatus.findMany({
      select: { id: true, status: true, reservationId: true },
      orderBy: { id: "asc" },
    }),
  };
}

describe("initializePayment — camino feliz", () => {
  it("crea la reserva PENDING, aparta los asientos y congela el desglose", async () => {
    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id, seats[1].id],
      customerName: "  Ana   María  ",
    });

    expect(result).toMatchObject({ success: true });

    const reservation = await prisma.reservation.findFirstOrThrow();
    expect(reservation).toMatchObject({
      eventId: event.id,
      customerName: "Ana María",
      numberOfSeats: 2,
      seatPriceCents: 1000,
      managementFeeCents: 150,
      status: "PENDING",
      paymentStatus: "PENDING",
    });
    // 2 × (10,00 € + 1,50 €)
    expect(reservation.totalPrice.toString()).toBe("23");

    const states = await seatStatesOf(event.id);
    expect(states[seats[0].id]).toEqual({
      status: "RESERVED",
      reservationId: reservation.id,
    });
    expect(states[seats[1].id]).toEqual({
      status: "RESERVED",
      reservationId: reservation.id,
    });
    // Los que no eligió, intactos.
    expect(states[seats[2].id]).toEqual({ status: "AVAILABLE", reservationId: null });
    expect(states[seats[3].id]).toEqual({ status: "AVAILABLE", reservationId: null });
  });

  it("el paymentId son los últimos 12 dígitos del reloj y es el pedido que se firma", async () => {
    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id],
      customerName: "Ana",
    });

    const reservation = await prisma.reservation.findFirstOrThrow();
    expect(reservation.paymentId).toMatch(/^\d{12}$/);
    expect(reservation.paymentId).toBe(String(TEST_NOW.getTime()).slice(-12));

    expect(signedParams(result.formBody).DS_MERCHANT_ORDER).toBe(reservation.paymentId);
  });

  it("firma hacia el banco el mismo importe que guarda, en céntimos", async () => {
    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id, seats[1].id],
      customerName: "Ana",
    });

    const params = signedParams(result.formBody);
    expect(params.DS_MERCHANT_AMOUNT).toBe("2300");
    expect(params.DS_MERCHANT_CURRENCY).toBe("978");
    // Solo tarjeta: sin esto el TPV ofrece también Bizum.
    expect(params.DS_MERCHANT_PAYMETHODS).toBe("C");
  });

  it("las vueltas de Redsys apuntan a la ruta de retorno, no a las páginas", async () => {
    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id],
      customerName: "Ana",
    });

    const { paymentId } = await prisma.reservation.findFirstOrThrow();
    const params = signedParams(result.formBody);

    expect(params.DS_MERCHANT_URLOK).toBe(
      `http://localhost:3100/api/payments/return/${paymentId}?r=ok`,
    );
    expect(params.DS_MERCHANT_URLKO).toBe(
      `http://localhost:3100/api/payments/return/${paymentId}?r=ko&eventId=${event.id}`,
    );
    expect(params.DS_MERCHANT_MERCHANTURL).toBe(
      "http://localhost:3100/api/payments/notify",
    );
  });

  it("un importe que no es múltiplo de euro se guarda y se firma exacto", async () => {
    // 3 × (10,00 € + 0,50 €) = 31,50 €. Con coma flotante y sin céntimos enteros, este
    // es el tipo de importe que acaba en 31.499999…
    const halfFee = await makeEvent({ managementFeeCents: 50 });
    await makeSeatStatuses(halfFee.id, seats);

    const result = await initializePayment({
      eventId: halfFee.id,
      seatIds: [seats[0].id, seats[1].id, seats[2].id],
      customerName: "Ana",
    });

    const reservation = await prisma.reservation.findFirstOrThrow();
    expect(reservation.totalPrice.toString()).toBe("31.5");
    expect(signedParams(result.formBody).DS_MERCHANT_AMOUNT).toBe("3150");
  });

  it("un evento sin gastos de gestión cobra solo el asiento", async () => {
    const noFee = await makeEvent({ managementFeeCents: 0 });
    await makeSeatStatuses(noFee.id, seats);

    const result = await initializePayment({
      eventId: noFee.id,
      seatIds: [seats[0].id],
      customerName: "Ana",
    });

    const reservation = await prisma.reservation.findFirstOrThrow();
    expect(reservation.managementFeeCents).toBe(0);
    expect(signedParams(result.formBody).DS_MERCHANT_AMOUNT).toBe("1000");
  });
});

describe("initializePayment — asientos no disponibles", () => {
  it.each(["RESERVED", "OCCUPIED", "BLOCKED"] as const)(
    "rechaza un asiento %s del mismo evento y dice cuál",
    async (status) => {
      await prisma.seatStatus.updateMany({
        where: { eventId: event.id, seatId: seats[1].id },
        data: { status },
      });
      const before = await snapshotWrites();

      const result = await initializePayment({
        eventId: event.id,
        seatIds: [seats[0].id, seats[1].id],
        customerName: "Ana",
      });

      expect(result).toEqual({
        success: false,
        error: `Asientos no disponibles: ${seats[1].code}`,
      });
      // Ni la reserva, ni el asiento libre que sí estaba disponible.
      expect(await snapshotWrites()).toEqual(before);
    },
  );

  it("lista todos los asientos que fallan, no solo el primero", async () => {
    await prisma.seatStatus.updateMany({
      where: { eventId: event.id, seatId: { in: [seats[0].id, seats[2].id] } },
      data: { status: "OCCUPIED" },
    });

    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id, seats[1].id, seats[2].id],
      customerName: "Ana",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain(seats[0].code);
    expect(result.error).toContain(seats[2].code);
    expect(result.error).not.toContain(seats[1].code);
  });
});

describe("initializePayment — eventos solapados", () => {
  /**
   * El local es uno: si dos partidos coinciden en el tiempo, un asiento vendido en uno
   * está ocupado en el otro. El solape usa `<` estricto, así que dos partidos pegados
   * (uno empieza justo cuando termina el otro) NO se solapan.
   */
  async function otherEventWithSeatTaken(
    eventDate: Date,
    status: SeatStatusType = "RESERVED",
  ) {
    const other = await makeEvent({ title: "Otro partido", eventDate });
    await makeSeatStatuses(other.id, seats, { [seats[0].id]: status });
    return other;
  }

  it("rechaza un asiento tomado en un evento que se solapa", async () => {
    await otherEventWithSeatTaken(new Date(event.eventDate.getTime() + minutes(60)));
    const before = await snapshotWrites();

    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id],
      customerName: "Ana",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Algunos asientos no están disponibles porque están reservados en otro evento " +
        `simultáneo: ${seats[0].code}`,
    );
    expect(await snapshotWrites()).toEqual(before);
  });

  it("acepta si el otro evento empieza justo cuando termina este", async () => {
    // Este dura 120 minutos.
    await otherEventWithSeatTaken(new Date(event.eventDate.getTime() + minutes(120)));

    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id],
      customerName: "Ana",
    });

    expect(result.success).toBe(true);
  });

  it("acepta si el otro evento termina justo cuando empieza este", async () => {
    await otherEventWithSeatTaken(new Date(event.eventDate.getTime() - minutes(120)));

    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id],
      customerName: "Ana",
    });

    expect(result.success).toBe(true);
  });

  it("un asiento BLOQUEADO en el evento solapado no impide reservar", async () => {
    // Bloquear es cosa de cada partido: solo RESERVED y OCCUPIED viajan entre eventos.
    await otherEventWithSeatTaken(
      new Date(event.eventDate.getTime() + minutes(60)),
      "BLOCKED",
    );

    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id],
      customerName: "Ana",
    });

    expect(result.success).toBe(true);
  });

  it.each(["FINISHED", "CANCELLED"] as const)(
    "ignora un evento solapado que está %s",
    async (status) => {
      const other = await otherEventWithSeatTaken(
        new Date(event.eventDate.getTime() + minutes(60)),
      );
      await prisma.event.update({ where: { id: other.id }, data: { status } });

      const result = await initializePayment({
        eventId: event.id,
        seatIds: [seats[0].id],
        customerName: "Ana",
      });

      expect(result.success).toBe(true);
    },
  );
});

describe("initializePayment — entradas inválidas no escriben nada", () => {
  it.each([
    ["una letra", "a"],
    ["un emoji", "Ana " + String.fromCodePoint(0x1f600)],
    ["solo espacios", "     "],
    ["25 caracteres", "A".repeat(25)],
  ])("nombre inválido (%s): cero escrituras", async (_label, customerName) => {
    const before = await snapshotWrites();

    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id],
      customerName,
    });

    expect(result).toEqual({
      success: false,
      error: "Indica un nombre o alias válido (entre 2 y 24 caracteres)",
    });
    expect(await snapshotWrites()).toEqual(before);
  });

  it("sin asientos: cero escrituras", async () => {
    const before = await snapshotWrites();

    const result = await initializePayment({
      eventId: event.id,
      seatIds: [],
      customerName: "Ana",
    });

    expect(result).toEqual({ success: false, error: "No hay asientos seleccionados" });
    expect(await snapshotWrites()).toEqual(before);
  });

  it("evento inexistente: cero escrituras", async () => {
    const before = await snapshotWrites();

    const result = await initializePayment({
      eventId: "no-existe",
      seatIds: [seats[0].id],
      customerName: "Ana",
    });

    expect(result).toEqual({ success: false, error: "Evento no encontrado" });
    expect(await snapshotWrites()).toEqual(before);
  });
});

/**
 * Lo que el servidor comprueba aunque la interfaz ya lo impida. `initializePayment` es
 * una server action: un endpoint público al que cualquiera puede llamar con los
 * argumentos que quiera. Antes de RCA-277 todo esto se vendía; ahora se rechaza sin
 * escribir nada.
 */
describe("initializePayment — lo que ya no confía al cliente", () => {
  async function eventAt(offsetMs: number) {
    const other = await makeEvent({ eventDate: new Date(TEST_NOW.getTime() + offsetMs) });
    await makeSeatStatuses(other.id, seats);
    return other;
  }

  it("no vende un evento que empieza en una hora", async () => {
    // La ventana solo la aplicaba EventRow en la portada; por enlace directo se compraba.
    const soon = await eventAt(hours(1));
    const before = await snapshotWrites();

    const result = await initializePayment({
      eventId: soon.id,
      seatIds: [seats[0].id],
      customerName: "Ana",
    });

    expect(result).toEqual({
      success: false,
      error:
        "Se han cerrado las reservas para este evento porque faltan menos de 4 horas para su inicio",
    });
    expect(await snapshotWrites()).toEqual(before);
  });

  it("no vende un evento a más de 48 h", async () => {
    const early = await eventAt(hours(72));

    const result = await initializePayment({
      eventId: early.id,
      seatIds: [seats[0].id],
      customerName: "Ana",
    });

    expect(result).toEqual({
      success: false,
      error: "Las reservas se desbloquearán 48 horas antes del evento",
    });
  });

  it("vende en los dos bordes de la ventana: a 48 h y a 4 h justas", async () => {
    for (const offset of [hours(48), hours(4)]) {
      const edge = await eventAt(offset);
      const result = await initializePayment({
        eventId: edge.id,
        seatIds: [seats[0].id],
        customerName: "Ana",
      });
      expect(result.success).toBe(true);
    }
  });

  it.each(["FINISHED", "CANCELLED"] as const)("no vende un evento %s", async (status) => {
    await prisma.event.update({ where: { id: event.id }, data: { status } });
    const before = await snapshotWrites();

    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id],
      customerName: "Ana",
    });

    expect(result).toEqual({
      success: false,
      error: "Este evento ya no admite reservas",
    });
    expect(await snapshotWrites()).toEqual(before);
  });

  it("un asiento repetido no se cobra dos veces: no escribe nada", async () => {
    const before = await snapshotWrites();

    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id, seats[0].id],
      customerName: "Ana",
    });

    expect(result).toEqual({
      success: false,
      error: "Hay asientos repetidos en la selección",
    });
    expect(await snapshotWrites()).toEqual(before);
  });

  it("un asiento que no existe no se cobra: no escribe nada", async () => {
    const before = await snapshotWrites();

    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id, "asiento-inventado"],
      customerName: "Ana",
    });

    expect(result).toEqual({
      success: false,
      error: "Alguno de los asientos no existe en este evento",
    });
    expect(await snapshotWrites()).toEqual(before);
  });
});

describe("congelación del desglose", () => {
  it("cambiar el precio y los gastos del evento no reescribe una reserva hecha", async () => {
    await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id, seats[1].id],
      customerName: "Ana",
    });

    await prisma.event.update({
      where: { id: event.id },
      data: { pricePerSeat: 25, managementFeeCents: 500 },
    });

    const reservation = await prisma.reservation.findFirstOrThrow();
    expect(reservation.seatPriceCents).toBe(1000);
    expect(reservation.managementFeeCents).toBe(150);
    expect(reservation.totalPrice.toString()).toBe("23");

    // Y el ticket lee la reserva, no el evento.
    const ticket = await getReservationByOrderId(reservation.paymentId!);
    expect(ticket).toMatchObject({
      seatPriceCents: 1000,
      managementFeeCents: 150,
      totalPrice: 23,
    });
  });

  it("la siguiente reserva ya sale con el precio nuevo", async () => {
    await prisma.event.update({
      where: { id: event.id },
      data: { pricePerSeat: 25, managementFeeCents: 500 },
    });

    const result = await initializePayment({
      eventId: event.id,
      seatIds: [seats[0].id],
      customerName: "Ana",
    });

    const reservation = await prisma.reservation.findFirstOrThrow();
    expect(reservation.seatPriceCents).toBe(2500);
    expect(reservation.managementFeeCents).toBe(500);
    expect(signedParams(result.formBody).DS_MERCHANT_AMOUNT).toBe("3000");
  });
});

describe("el CHECK reservation_total_matches_breakdown", () => {
  it("rechaza actualizar una reserva a un total que no cuadra", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });

    await expect(
      prisma.reservation.update({
        where: { id: reservation.id },
        data: { totalPrice: 10 },
      }),
    ).rejects.toThrow(/reservation_total_matches_breakdown/);
  });

  it("rechaza cambiar el número de asientos sin cambiar el total", async () => {
    const reservation = await makeReservation({ event, seats: [seats[0]] });

    await expect(
      prisma.reservation.update({
        where: { id: reservation.id },
        data: { numberOfSeats: 2 },
      }),
    ).rejects.toThrow(/reservation_total_matches_breakdown/);
  });

  it("rechaza un céntimo de diferencia", async () => {
    await expect(
      prisma.reservation.create({
        data: {
          eventId: event.id,
          customerName: "Ana",
          customerEmail: "cliente@lounge.com",
          numberOfSeats: 1,
          totalPrice: 11.49,
          seatPriceCents: 1000,
          managementFeeCents: 150,
        },
      }),
    ).rejects.toThrow(/reservation_total_matches_breakdown/);
  });
});
