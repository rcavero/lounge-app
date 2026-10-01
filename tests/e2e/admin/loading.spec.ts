/**
 * Los estados de carga del panel (RCA-282): al pulsar una tarjeta, el skeleton con el
 * título de la página de destino sale antes que los datos.
 */
import { expect, test } from "@playwright/test";

import { WORKER_STATE } from "../support/auth";
import { IDS, seedBaseline } from "../support/db";
import { holdNavigation, prefetchOf } from "../support/navigation";

test.beforeEach(async () => {
  await seedBaseline();
});

test("del panel a Configurar Eventos: el título sale al instante, la lista después", async ({
  page,
}) => {
  const release = await holdNavigation(page, "/admin/eventos");
  const prefetched = prefetchOf(page, "/admin/eventos");
  await page.goto("/admin");
  await prefetched;

  await page.getByTestId("dashboard-events").click();

  const skeleton = page.getByTestId("admin-skeleton");
  await expect(skeleton).toBeVisible();
  await expect(skeleton).toContainText("Configurar Eventos");
  await expect(skeleton).toHaveAttribute("role", "status");

  release();

  await expect(skeleton).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Configurar Eventos" })).toBeVisible();
});

test.describe("como WORKER", () => {
  test.use({ storageState: WORKER_STATE });

  test("de las reservas a las de un evento: skeleton de detalle, luego la lista", async ({
    page,
  }) => {
    const path = `/admin/reservas/${IDS.open}`;
    const release = await holdNavigation(page, path);
    const prefetched = prefetchOf(page, path);
    await page.goto("/admin/reservas");
    await prefetched;

    await page.locator(`a[href="${path}"]`).first().click();

    const skeleton = page.getByTestId("admin-skeleton");
    await expect(skeleton).toContainText("Reservas del evento");

    release();

    await expect(skeleton).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  });
});
