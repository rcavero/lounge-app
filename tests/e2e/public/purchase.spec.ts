/**
 * Escenario 1: la compra completa, de la portada al ticket, con comprobación en BD.
 *
 * Pasa por el camino del NAVEGADOR: la pasarela se intercepta y devuelve al cliente a la
 * URLOK, y la página de confirmación autoconfirma (fuera de producción no espera al
 * webhook). El camino del webhook se prueba aparte, en `webhook.spec.ts`.
 */
import { expect, test } from "@playwright/test";

import { IDS, prisma, seedBaseline } from "../support/db";
import { openEvent, seat, selectSeatsAndName } from "../support/flows";
import { interceptRedsys } from "../support/redsys";

test.beforeEach(async () => {
  await seedBaseline();
});

test("la portada bloquea los eventos fuera de la ventana de reserva", async ({
  page,
}) => {
  await page.goto("/");

  const tooEarly = page.locator(`[data-event-id="${IDS.tooEarly}"]`);
  await expect(tooEarly).toHaveAttribute("data-locked", "true");
  await tooEarly.click();
  await expect(tooEarly.getByTestId("event-row-tooltip")).toContainText("48 horas");
  await expect(page).toHaveURL("/");

  const tooLate = page.locator(`[data-event-id="${IDS.tooLate}"]`);
  await expect(tooLate).toHaveAttribute("data-locked", "true");
  await tooLate.click();
  await expect(tooLate.getByTestId("event-row-tooltip")).toContainText(
    "menos de 4 horas",
  );
  await expect(page).toHaveURL("/");

  // El evento pasado no sale en la portada.
  await expect(page.locator(`[data-event-id="${IDS.past}"]`)).toHaveCount(0);

  const open = page.locator(`[data-event-id="${IDS.open}"]`);
  await expect(open).toHaveAttribute("data-locked", "false");
  await open.click();
  await expect(page).toHaveURL(`/eventos/${IDS.open}`);
});

test("compra de dos asientos: ticket, importe y estado en BD", async ({ page }) => {
  await openEvent(page, IDS.open);

  // Selección: 2 × (10 € + 1,50 € de gastos) = 23 €.
  await selectSeatsAndName(page, ["T1-A1", "T1-A2"], "a");
  await expect(page.getByTestId("selection-total")).toHaveText("23,00€");

  // Un nombre demasiado corto ni siquiera deja pulsar PAGAR.
  await expect(page.getByTestId("pay-button")).toBeDisabled();

  // Uno con caracteres fuera de la lista blanca da error y no sale de la página.
  await page.getByTestId("customer-name-input").fill("Ana <3");
  await page.getByTestId("pay-button").click();
  await expect(page.getByTestId("name-error")).toBeVisible();
  await expect(page).toHaveURL(`/eventos/${IDS.open}`);

  const sent = interceptRedsys(page, "ok");
  await page.getByTestId("customer-name-input").fill("Ana García");
  await page.getByTestId("pay-button").click();

  const { orderId, amountCents } = await sent;
  // Lo firmado para el banco: 12 dígitos y el importe en céntimos.
  expect(orderId).toMatch(/^\d{12}$/);
  expect(amountCents).toBe("2300");

  // Con la llave de la reserva (`t`): sin ella, la página no existe (RCA-285).
  await expect(page).toHaveURL(
    new RegExp(`/reserva/confirmacion/${orderId}\\?t=[\\w-]{22}$`),
  );
  const ticket = page.getByTestId("ticket");
  await expect(ticket).toContainText("Ana García");
  await expect(page.getByTestId("ticket-seats")).toHaveText(/T1-A1/);
  await expect(page.getByTestId("ticket-seats")).toHaveText(/T1-A2/);
  await expect(page.getByTestId("ticket-total")).toHaveText("23,00€");

  const reservation = await prisma.reservation.findFirstOrThrow({
    where: { paymentId: orderId },
    include: { seatStatuses: { include: { seat: true } } },
  });
  expect(reservation).toMatchObject({
    eventId: IDS.open,
    customerName: "Ana García",
    status: "CONFIRMED",
    paymentStatus: "COMPLETED",
    numberOfSeats: 2,
    seatPriceCents: 1000,
    managementFeeCents: 150,
  });
  expect(Number(reservation.totalPrice)).toBe(23);
  expect(reservation.confirmedAt).not.toBeNull();
  expect(reservation.seatStatuses.map((s) => [s.seat.code, s.status]).sort()).toEqual([
    ["T1-A1", "OCCUPIED"],
    ["T1-A2", "OCCUPIED"],
  ]);

  // Los dos asientos quedan ocupados y no se pueden pulsar...
  await openEvent(page, IDS.open);
  for (const code of ["T1-A1", "T1-A2"]) {
    await expect(seat(page, code)).toHaveAttribute("data-seat-state", "OCCUPIED");
    await expect(seat(page, code)).toBeDisabled();
  }
  await expect(seat(page, "T1-A3")).toHaveAttribute("data-seat-state", "AVAILABLE");

  // ...también en el evento que se solapa con este: es el mismo local a la misma hora.
  await openEvent(page, IDS.overlap);
  for (const code of ["T1-A1", "T1-A2"]) {
    await expect(seat(page, code)).toHaveAttribute("data-seat-state", "OCCUPIED");
    await expect(seat(page, code)).toBeDisabled();
  }
});
