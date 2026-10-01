/**
 * Escenario 2: el banco rechaza el pago. El cliente vuelve por la URLKO, la reserva se
 * cancela y los asientos quedan libres para otro.
 */
import { expect, test } from "@playwright/test";

import { IDS, prisma, seedBaseline } from "../support/db";
import { openEvent, seat, selectSeatsAndName } from "../support/flows";
import { interceptRedsys } from "../support/redsys";

test.beforeEach(async () => {
  await seedBaseline();
});

test("pago rechazado: reserva cancelada y asientos liberados", async ({ page }) => {
  await openEvent(page, IDS.open);
  await selectSeatsAndName(page, ["T1-B1", "T1-B2"], "Luis");

  const sent = interceptRedsys(page, "ko");
  await page.getByTestId("pay-button").click();
  const { orderId } = await sent;

  // Con la llave de la reserva (`t`): sin ella, la página no cancelaría (RCA-285).
  await expect(page).toHaveURL(
    new RegExp(`/reserva/error\\?orderId=${orderId}&eventId=${IDS.open}&t=[\\w-]{22}$`),
  );
  await expect(page.getByRole("heading", { name: "Pago no completado" })).toBeVisible();

  const reservation = await prisma.reservation.findFirstOrThrow({
    where: { paymentId: orderId },
  });
  expect(reservation).toMatchObject({ status: "CANCELLED", paymentStatus: "FAILED" });

  const seats = await prisma.seatStatus.findMany({
    where: { eventId: IDS.open, seatId: { in: ["T1-B1", "T1-B2"] } },
  });
  expect(seats).toHaveLength(2);
  for (const s of seats) {
    expect(s).toMatchObject({ status: "AVAILABLE", reservationId: null });
  }

  // Y en el plano vuelven a estar disponibles para cualquiera.
  await openEvent(page, IDS.open);
  await expect(seat(page, "T1-B1")).toHaveAttribute("data-seat-state", "AVAILABLE");
  await expect(seat(page, "T1-B2")).toHaveAttribute("data-seat-state", "AVAILABLE");
});
