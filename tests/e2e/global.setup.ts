/**
 * Proyecto `setup`: corre antes que cualquier spec y, si falla, no corre ninguno.
 *
 * 1. Siembra la base de tests.
 * 2. Comprueba con un canario que el servidor Next lee ESA base.
 * 3. Hace login una vez por rol y guarda las cookies.
 */
import { expect, test as setup } from "@playwright/test";

import { TEST_PASSWORD } from "../fixtures/factories";

import { ADMIN_STATE, WORKER_STATE, loginAs } from "./support/auth";
import { ADMIN_EMAIL, IDS, WORKER_EMAIL, prisma, seedBaseline } from "./support/db";

setup("sembrar la base de tests", async () => {
  await seedBaseline();
});

/**
 * La puerta del lado del servidor. `requireDbEnv` protege el proceso de Playwright,
 * pero el que escribe cuando un spec pulsa PAGAR es el servidor Next, que es otro
 * proceso y podría estar leyendo otra base: un fichero `.env` de otro entorno que Next cargara, o un
 * servidor ya levantado en el 3100 con otro entorno (`reuseExistingServer`).
 *
 * El canario es un evento con un id que solo existe en la base recién sembrada. Si la
 * portada no lo muestra, el servidor no está mirando aquí y no corre ningún escenario.
 */
setup("el servidor lee la base de tests (canario)", async ({ page }) => {
  const canary = `e2e-canary-${Date.now()}`;
  await prisma.event.create({
    data: {
      id: canary,
      title: "Canario vs Canario",
      homeTeamName: "Canario",
      awayTeamName: "Canario",
      eventDate: new Date(Date.now() + 30 * 60 * 60 * 1000),
    },
  });

  await page.goto("/");
  await expect(
    page.locator(`[data-event-id="${canary}"]`),
    "El servidor del 3100 no ve el evento recién sembrado: no está usando lounge_test. " +
      "¿Hay otro servidor levantado en ese puerto?",
  ).toBeVisible();
  await expect(page.locator(`[data-event-id="${IDS.open}"]`)).toBeVisible();

  await prisma.event.delete({ where: { id: canary } });
});

setup("login como ADMIN", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD);
  await page.context().storageState({ path: ADMIN_STATE });
});

setup("login como WORKER", async ({ page }) => {
  await loginAs(page, WORKER_EMAIL, TEST_PASSWORD);
  await page.context().storageState({ path: WORKER_STATE });
});
