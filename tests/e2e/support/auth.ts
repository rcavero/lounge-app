/**
 * Sesiones del panel para el E2E. El setup hace login una vez por rol y guarda las
 * cookies aquí; los specs de admin arrancan ya autenticados con `storageState`.
 *
 * La carpeta `.auth/` está gitignorada: son cookies de sesión firmadas con el
 * AUTH_SECRET de tests, que no vale fuera de la base de tests, pero no pintan nada en
 * el repositorio.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const ADMIN_STATE = "tests/e2e/.auth/admin.json";
export const WORKER_STATE = "tests/e2e/.auth/worker.json";

/** Login por el formulario de verdad: sin atajos, que es justo lo que se prueba. */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/admin/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
}
