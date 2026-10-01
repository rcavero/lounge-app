/**
 * El aviso de «Pagos a devolver» del panel (RCA-276): una reserva cobrada y anulada,
 * como la deja el webhook cuando el pago llega tarde y sus asientos ya son de otro.
 */
import { expect, test } from "@playwright/test";

import { makeReservation } from "../../fixtures/factories";
import { WORKER_STATE } from "../support/auth";
import { IDS, prisma, seedBaseline } from "../support/db";

const ORDER_ID = "900000000888";

test.beforeEach(async () => {
  await seedBaseline();

  const event = await prisma.event.findUniqueOrThrow({ where: { id: IDS.open } });
  const reservation = await makeReservation({
    event,
    seats: [],
    status: "EXPIRED",
    paymentId: ORDER_ID,
  });
  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      status: "CANCELLED",
      paymentStatus: "COMPLETED",
      authorisationCode: "U6N2PG",
    },
  });
});

test("el ADMIN ve el pago con su pedido y autorización, y lo marca como devuelto", async ({
  page,
}) => {
  await page.goto("/admin");

  const item = page.getByTestId("refund-item");
  await expect(item).toHaveCount(1);
  await expect(item).toContainText(ORDER_ID);
  await expect(item).toContainText("U6N2PG");

  await page.getByTestId("mark-refunded").click();

  await expect(page.getByTestId("refund-alert")).toHaveCount(0);
  expect(
    await prisma.reservation.findFirstOrThrow({ where: { paymentId: ORDER_ID } }),
  ).toMatchObject({ status: "CANCELLED", paymentStatus: "REFUNDED" });
});

test.describe("como WORKER", () => {
  test.use({ storageState: WORKER_STATE });

  test("ve el aviso, pero no el botón", async ({ page }) => {
    await page.goto("/admin");

    await expect(page.getByTestId("refund-item")).toHaveCount(1);
    await expect(page.getByTestId("mark-refunded")).toHaveCount(0);
  });
});
