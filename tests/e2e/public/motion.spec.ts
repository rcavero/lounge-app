/**
 * Las animaciones respetan «reducir movimiento» del sistema (RCA-284). Todas van con
 * `motion-safe:`: aquí se comprueba en el navegador, con la preferencia emulada, que de
 * verdad no queda ninguna.
 */
import { expect, test, type Page } from "@playwright/test";

import { IDS, seedBaseline } from "../support/db";

test.beforeEach(async () => {
  await seedBaseline();
});

/** El nombre de la animación de la tarjeta de un evento en la portada. */
function animationOf(page: Page) {
  return page
    .locator(`[data-event-id="${IDS.open}"]`)
    .locator("xpath=..")
    .evaluate((el) => getComputedStyle(el).animationName);
}

test("sin preferencia, las tarjetas de la portada entran animadas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  expect(await animationOf(page)).toBe("enter");
});

test("con «reducir movimiento», ninguna animación", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  expect(await animationOf(page)).toBe("none");

  // Tampoco en el plano, ni en el modal de condiciones, ni en el pulso de un skeleton.
  await page.goto(`/eventos/${IDS.open}`);
  const animated = await page.evaluate(
    () =>
      [...document.querySelectorAll("*")].filter(
        (el) => getComputedStyle(el).animationName !== "none",
      ).length,
  );
  expect(animated).toBe(0);
});
