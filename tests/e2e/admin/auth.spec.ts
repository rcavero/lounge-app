/**
 * Escenario 4: login, rate limit por IP y roles.
 *
 * El rate limit vive en un `Map` en memoria del servidor y dura 15 minutos. Dos
 * consecuencias para estos tests:
 *
 * - Cada test que falla logins usa su propia IP en `x-forwarded-for`, que es de donde
 *   la action la saca. Sin eso, los fallos se acumularían sobre 127.0.0.1 —la IP del
 *   login del setup— y con un servidor reutilizado la siguiente ejecución no podría ni
 *   entrar.
 * - Las IPs llevan un componente aleatorio: el `Map` sobrevive entre ejecuciones mientras
 *   no se reinicie el servidor.
 */
import { expect, test, type Browser } from "@playwright/test";

import { TEST_PASSWORD } from "../../fixtures/factories";
import { WORKER_STATE } from "../support/auth";
import { ADMIN_EMAIL, seedBaseline } from "../support/db";

const NO_SESSION = { cookies: [], origins: [] };

/** Una IP de documentación (TEST-NET-2) distinta en cada llamada. */
function randomIp(): string {
  return `198.51.100.${Math.floor(Math.random() * 254) + 1}`;
}

/** Un contexto sin sesión que se presenta desde `ip`. */
async function visitorFrom(browser: Browser, ip: string) {
  const context = await browser.newContext({
    storageState: NO_SESSION,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  return { context, page: await context.newPage() };
}

/**
 * Un intento de login que espera a la respuesta de la server action. Sin esperarla, dos
 * intentos seguidos se pisan —el botón está deshabilitado mientras el anterior sigue
 * pendiente— y una aserción sobre el mensaje de error pasa en falso con el mensaje que
 * dejó el intento anterior.
 */
async function tryLogin(page: import("@playwright/test").Page, password: string) {
  await page.getByTestId("login-email").fill(ADMIN_EMAIL);
  await page.getByTestId("login-password").fill(password);
  await expect(page.getByTestId("login-submit")).toBeEnabled();
  await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/admin/login"),
    ),
    page.getByTestId("login-submit").click(),
  ]);
}

test.beforeEach(async () => {
  await seedBaseline();
});

test.describe("sin sesión", () => {
  test.use({ storageState: NO_SESSION });

  test("el panel redirige al login", async ({ page }) => {
    await page.goto("/admin/eventos");
    await expect(page).toHaveURL("/admin/login");
  });
});

test("credenciales incorrectas: error y sigue en el login", async ({ browser }) => {
  const { context, page } = await visitorFrom(browser, randomIp());
  await page.goto("/admin/login");

  await tryLogin(page, "no-es-la-contrasena");
  await expect(page.getByTestId("login-error")).toHaveText("Credenciales incorrectas");
  await expect(page).toHaveURL("/admin/login");

  await context.close();
});

test("5 fallos desde una IP la bloquean; desde otra se entra", async ({ browser }) => {
  const blockedIp = randomIp();
  const { context, page } = await visitorFrom(browser, blockedIp);
  await page.goto("/admin/login");

  for (let attempt = 1; attempt <= 5; attempt++) {
    await tryLogin(page, `mala-${attempt}`);
    await expect(page.getByTestId("login-error")).toHaveText("Credenciales incorrectas");
  }

  // El sexto intento ya no se evalúa: ni con la contraseña buena.
  await tryLogin(page, TEST_PASSWORD);
  await expect(page.getByTestId("login-error")).toContainText("Demasiados intentos");
  await expect(page).toHaveURL("/admin/login");
  await context.close();

  // El bloqueo es por IP, no por cuenta: la misma cuenta entra desde otra.
  let otherIp = randomIp();
  while (otherIp === blockedIp) otherIp = randomIp();
  const other = await visitorFrom(browser, otherIp);
  await other.page.goto("/admin/login");
  await tryLogin(other.page, TEST_PASSWORD);
  await expect(other.page).toHaveURL(/\/admin$/);
  await other.context.close();
});

test("ADMIN ve las cuatro secciones del panel", async ({ page }) => {
  await page.goto("/admin");
  for (const card of ["events", "reservations", "seats", "users"]) {
    await expect(page.getByTestId(`dashboard-${card}`)).toBeVisible();
  }
});

test.describe("como WORKER", () => {
  test.use({ storageState: WORKER_STATE });

  test("solo ve «Administrar reservas»", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByTestId("dashboard-reservations")).toBeVisible();
    for (const card of ["events", "seats", "users"]) {
      await expect(page.getByTestId(`dashboard-${card}`)).toHaveCount(0);
    }
  });
});
