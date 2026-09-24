/**
 * Los estados de carga (RCA-280). Lo que pidió Ramón: que al pulsar un evento no
 * parezca que no ha pasado nada durante los 2–3 s que tarda la siguiente pantalla.
 *
 * El servidor de tests contesta en milisegundos, así que el retraso se fabrica:
 * `holdNavigation` retiene la petición RSC de la navegación hasta que el test la suelta.
 * Las precargas (`next-router-prefetch`) pasan sin retener, porque son justo lo que
 * permite a `<Link>` pintar el skeleton sin esperar al servidor.
 */
import { expect, test, type Page } from "@playwright/test";

import { IDS, seedBaseline } from "../support/db";
import { openEvent } from "../support/flows";

test.beforeEach(async () => {
  await seedBaseline();
});

async function holdNavigation(page: Page, path: string) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));

  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      const headers = route.request().headers();
      if (headers["rsc"] === "1" && !headers["next-router-prefetch"]) await released;
      await route.continue();
    },
  );

  return release;
}

test("al pulsar un evento, el skeleton sale antes que el plano", async ({ page }) => {
  const path = `/eventos/${IDS.open}`;
  const release = await holdNavigation(page, path);
  const prefetched = page.waitForRequest(
    (r) => new URL(r.url()).pathname === path && !!r.headers()["next-router-prefetch"],
  );

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
