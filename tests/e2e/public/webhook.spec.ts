/**
 * Escenario 3: la notificación servidor-servidor de Redsys, sin navegador.
 *
 * Es el único camino que confirma en producción. A propósito NO se navega a la página de
 * confirmación: fuera de producción esa página autoconfirma, y taparía un webhook roto.
 * La reserva pendiente se crea en BD, igual que la dejaría `initializePayment`.
 */
import { expect, test } from "@playwright/test";

import { makeReservation } from "../../fixtures/factories";
import { IDS, prisma, seedBaseline } from "../support/db";
import { postNotification } from "../support/redsys";

const ORDER_ID = "900000000777";
const SEAT_IDS = ["T2-A1", "T2-A2"];

test.beforeEach(async () => {
  await seedBaseline();

  const event = await prisma.event.findUniqueOrThrow({ where: { id: IDS.open } });
  const seats = await prisma.seat.findMany({ where: { id: { in: SEAT_IDS } } });
  await makeReservation({
    event,
    seats,
    status: "PENDING",
    paymentId: ORDER_ID,
    createdAt: new Date(),
  });
});

test("notificación OK firmada: confirma, ocupa y guarda el recibo", async ({
  request,
}) => {
  const response = await postNotification(request, {
    orderId: ORDER_ID,
    amountCents: "2300",
    ok: true,
    authorisationCode: "654321",
  });
  expect(response.status()).toBe(200);

  const reservation = await prisma.reservation.findFirstOrThrow({
    where: { paymentId: ORDER_ID },
    include: { seatStatuses: true },
  });
  expect(reservation).toMatchObject({
    status: "CONFIRMED",
    paymentStatus: "COMPLETED",
    authorisationCode: "654321",
    paymentDateTime: "14/10/2026 12:00",
    paymentResponseCode: "0000",
  });
  expect(reservation.seatStatuses.map((s) => s.status)).toEqual(["OCCUPIED", "OCCUPIED"]);
});

test("firma corrupta: responde 200 y no toca la reserva", async ({ request }) => {
  const response = await postNotification(
    request,
    { orderId: ORDER_ID, amountCents: "2300", ok: true },
    { tamper: true },
  );
  // 200 aunque la firma no valga: con otro código Redsys reintentaría sin parar.
  expect(response.status()).toBe(200);

  const reservation = await prisma.reservation.findFirstOrThrow({
    where: { paymentId: ORDER_ID },
    include: { seatStatuses: true },
  });
  expect(reservation).toMatchObject({
    status: "PENDING",
    paymentStatus: "PENDING",
    authorisationCode: null,
  });
  expect(reservation.seatStatuses.map((s) => s.status)).toEqual(["RESERVED", "RESERVED"]);
});

test("pago tardío sin asientos: queda para devolver y el cliente lo ve", async ({
  page,
  request,
}) => {
  // La reserva lleva 6 minutos en la pasarela: abrir la página del evento la caduca,
  // como lo haría cualquier otro cliente en producción.
  await prisma.reservation.updateMany({
    where: { paymentId: ORDER_ID },
    data: { createdAt: new Date(Date.now() - 6 * 60 * 1000) },
  });
  await page.goto(`/eventos/${IDS.open}`);
  await expect(page.getByTestId("seat").first()).toBeVisible();

  // Otro cliente aparta uno de sus asientos antes de que llegue el pago.
  const event = await prisma.event.findUniqueOrThrow({ where: { id: IDS.open } });
  const taken = await prisma.seat.findMany({ where: { id: SEAT_IDS[1] } });
  await makeReservation({ event, seats: taken, paymentId: "900000000778" });

  const response = await postNotification(request, {
    orderId: ORDER_ID,
    amountCents: "2300",
    ok: true,
    authorisationCode: "654321",
  });
  expect(response.status()).toBe(200);

  expect(
    await prisma.reservation.findFirstOrThrow({ where: { paymentId: ORDER_ID } }),
  ).toMatchObject({
    status: "CANCELLED",
    paymentStatus: "COMPLETED",
    authorisationCode: "654321",
  });

  await page.goto(`/reserva/confirmacion/${ORDER_ID}`);
  await expect(page.getByTestId("refund-notice")).toBeVisible();
  await expect(page.getByTestId("refund-notice")).toContainText(ORDER_ID);
});
