/**
 * Las páginas de vuelta del pago solo se abren con la llave de la reserva (RCA-285).
 *
 * El nº de pedido son los 12 últimos dígitos de `Date.now()`: sabiendo más o menos a
 * qué hora compró alguien, se adivina. Sin la llave, la confirmación enseñaba su ticket
 * y la página de error le cancelaba la reserva mientras pagaba.
 */
import { expect, test } from "@playwright/test";

import { makeReservation } from "../../fixtures/factories";
import { IDS, prisma, seedBaseline } from "../support/db";

const ORDER_ID = "900000000777";
const KEY = "llave-de-la-reserva-de-ana-0123456789";

async function reservationWithKey(status: "PENDING" | "CONFIRMED") {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: IDS.open } });
  const seats = await prisma.seat.findMany({ where: { id: { in: ["T1-A4"] } } });
  return makeReservation({
    event,
    seats,
    status,
    paymentId: ORDER_ID,
    accessToken: KEY,
    createdAt: new Date(),
  });
}

test.beforeEach(async () => {
  await seedBaseline();
});

test("la confirmación de otro, sin su llave o con otra, no existe", async ({ page }) => {
  await reservationWithKey("CONFIRMED");

  for (const url of [
    `/reserva/confirmacion/${ORDER_ID}`,
    `/reserva/confirmacion/${ORDER_ID}?t=otra-llave`,
  ]) {
    // El estado HTTP no sirve de prueba: la página tiene loading.tsx, así que la
    // respuesta ya ha salido con 200 cuando notFound() corta el streaming. Lo que
    // importa es qué se entrega: la pantalla de 404 y ni un dato de la reserva.
    const response = await page.goto(url);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(page.getByTestId("ticket")).toHaveCount(0);
    const html = (await response?.text()) ?? "";
    expect(html).not.toContain("T1-A4");
  }
});

test("fuera de producción, la confirmación sin llave no autoconfirma la reserva de otro", async ({
  page,
}) => {
  const reservation = await reservationWithKey("PENDING");

  await page.goto(`/reserva/confirmacion/${ORDER_ID}`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();

  const after = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservation.id },
  });
  expect(after.status).toBe("PENDING");
});

test("con su llave, el cliente ve su ticket", async ({ page }) => {
  await reservationWithKey("CONFIRMED");

  await page.goto(`/reserva/confirmacion/${ORDER_ID}?t=${KEY}`);
  await expect(page.getByTestId("ticket")).toContainText("Ana");
});

test("la página de error, sin la llave, no cancela la reserva de otro", async ({
  page,
}) => {
  const reservation = await reservationWithKey("PENDING");

  await page.goto(`/reserva/error?orderId=${ORDER_ID}&eventId=${IDS.open}`);
  await expect(page.getByRole("heading", { name: "Pago no completado" })).toBeVisible();

  const after = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservation.id },
  });
  expect(after.status).toBe("PENDING");
  const seat = await prisma.seatStatus.findFirstOrThrow({
    where: { eventId: IDS.open, seatId: "T1-A4" },
  });
  expect(seat.status).toBe("RESERVED");
});
