/**
 * Los estados de carga (RCA-280). Lo que pidió Ramón: que al pulsar un evento no
 * parezca que no ha pasado nada durante los 2–3 s que tarda la siguiente pantalla.
 *
 * El servidor de tests contesta en milisegundos, así que el retraso se fabrica con
 * `holdNavigation` (support/navigation.ts).
 */
import { expect, test } from "@playwright/test";

import { IDS, seedBaseline } from "../support/db";
import { openEvent } from "../support/flows";
import { holdNavigation, prefetchOf } from "../support/navigation";

test.beforeEach(async () => {
  await seedBaseline();
});

test("al pulsar un evento, el skeleton sale antes que el plano", async ({ page }) => {
  const path = `/eventos/${IDS.open}`;
  const release = await holdNavigation(page, path);
  const prefetched = prefetchOf(page, path);

  await page.goto("/");
  await prefetched;
  await page.locator(`[data-event-id="${IDS.open}"]`).click();

  const skeleton = page.getByTestId("event-skeleton");
  await expect(skeleton).toBeVisible();
  // Anunciado a los lectores de pantalla, no solo dibujado.
  await expect(skeleton).toHaveAttribute("role", "status");
  await expect(skeleton).toContainText("Cargando los asientos…");
  await expect(page.getByTestId("seat")).toHaveCount(0);

  release();

  await expect(page.getByTestId("seat").first()).toBeVisible();
  await expect(skeleton).toHaveCount(0);
});

test("al volver a la portada, el skeleton de la lista sale antes que los eventos", async ({
  page,
}) => {
  await openEvent(page, IDS.open);

  const release = await holdNavigation(page, "/");
  await page.locator('header a[href="/"]').click();

  await expect(page.getByTestId("home-skeleton")).toBeVisible();
  await expect(page.getByTestId("event-row")).toHaveCount(0);

  release();

  await expect(page.getByTestId("event-row").first()).toBeVisible();
  await expect(page.getByTestId("home-skeleton")).toHaveCount(0);
});

test("pulsando antes de que la precarga llegue, la tarjeta pulsada muestra su spinner", async ({
  page,
}) => {
  const path = `/eventos/${IDS.open}`;
  const release = await holdNavigation(page, path, { includePrefetch: true });

  await page.goto("/");
  const row = page.locator(`[data-event-id="${IDS.open}"]`);
  await row.click();

  // Sin precarga no hay skeleton que pintar: lo que responde es la propia tarjeta.
  await expect(row.getByTestId("link-pending")).toHaveAttribute("data-pending", "true");
  // Y solo la pulsada.
  await expect(page.locator('[data-testid="link-pending"][data-pending]')).toHaveCount(1);

  release();

  await expect(page.getByTestId("seat").first()).toBeVisible();
});
