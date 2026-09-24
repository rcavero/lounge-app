/**
 * La ventana de reservas por enlace directo (RCA-277). La portada ya bloqueaba los
 * eventos fuera de ventana (ver purchase.spec.ts), pero la URL del evento enseñaba el
 * plano y dejaba pagar.
 */
import { expect, test } from "@playwright/test";

import { IDS, prisma, seedBaseline } from "../support/db";

test.beforeEach(async () => {
  await seedBaseline();
});

const CLOSED = [
  { id: IDS.tooEarly, label: "a 72 h", text: "48 horas antes" },
  { id: IDS.tooLate, label: "a 2 h", text: "menos de 4 horas" },
  { id: IDS.past, label: "ya jugado", text: "menos de 4 horas" },
];

for (const { id, label, text } of CLOSED) {
  test(`evento ${label}: sin plano, con el motivo`, async ({ page }) => {
    await page.goto(`/eventos/${id}`);

    await expect(page.getByTestId("booking-closed")).toContainText(text);
    await expect(page.getByTestId("seat")).toHaveCount(0);
  });
}

test("evento cancelado en ventana: sin plano", async ({ page }) => {
  await prisma.event.update({ where: { id: IDS.open }, data: { status: "CANCELLED" } });

  await page.goto(`/eventos/${IDS.open}`);

  await expect(page.getByTestId("booking-closed")).toContainText("ya no admite reservas");
  await expect(page.getByTestId("seat")).toHaveCount(0);
});

test("evento en ventana: el plano de siempre", async ({ page }) => {
  await page.goto(`/eventos/${IDS.open}`);

  await expect(page.getByTestId("seat").first()).toBeVisible();
  await expect(page.getByTestId("booking-closed")).toHaveCount(0);
});
