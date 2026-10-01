/**
 * Escenario 7 (parte de admin): el informe mensual de reservas se abre como PDF en otra
 * pestaña. La siembra deja un evento pasado con una reserva cobrada, así que siempre
 * hay al menos un mes con informe.
 */
import { expect, test } from "@playwright/test";

import { seedBaseline } from "../support/db";
import { lastOpenedBlobHeader, recordWindowOpen } from "../support/pdf";

test.beforeEach(async () => {
  await seedBaseline();
});

test("informe mensual en PDF @slow", async ({ page }) => {
  await recordWindowOpen(page);
  await page.goto("/admin/reservas");
  await page.getByRole("button", { name: /Informes de reservas/ }).click();

  const month = page
    .getByRole("button")
    .filter({ hasText: /\d{4}/ })
    .filter({
      hasText: /\d+ eventos?/,
    });
  await expect(month.first()).toBeVisible();
  await month.first().click();

  expect(await lastOpenedBlobHeader(page)).toBe("%PDF-");
});
