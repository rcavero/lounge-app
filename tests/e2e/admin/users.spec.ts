/**
 * El módulo de usuarios (P12), pulsando como lo haría el ADMIN: alta, cambio de
 * contraseña con su confirmación, borrado, la ficha de otro ADMIN en solo lectura y el
 * último ADMIN que no se puede borrar.
 *
 * Todo con clics y no con `page.goto` a cada pantalla: en P11 un fallo solo aparecía al
 * navegar con `<Link>`, y los tests que cargaban la URL no lo vieron.
 */
import { expect, test, type Page } from "@playwright/test";

import { makeAdmin, TEST_PASSWORD } from "../../fixtures/factories";
import { loginAs } from "../support/auth";
import { IDS, prisma, seedBaseline, WORKER_EMAIL } from "../support/db";

const NEW_PASSWORD = "otra-contrasena-nueva";

test.beforeEach(async () => {
  await seedBaseline();
});

async function openUsers(page: Page) {
  await page.goto("/admin");
  await page.getByTestId("dashboard-users").click();
  await expect(page).toHaveURL("/admin/usuarios");
}

async function openCard(page: Page, id: string) {
  await page.getByTestId(`user-card-${id}`).click();
  await expect(page).toHaveURL(`/admin/usuarios/${id}`);
}

test("alta de un WORKER: la contraseña se repite, y el listado lo confirma", async ({
  page,
}) => {
  await openUsers(page);
  await page.getByRole("link", { name: "Añadir usuario" }).click();
  await expect(page).toHaveURL("/admin/usuarios/nuevo");

  await page.getByTestId("user-name").fill("Camarera Nueva");
  await page.getByTestId("user-email").fill("camarera@lounge.test");
  await page.getByTestId("user-password").fill(NEW_PASSWORD);
  await page.getByTestId("user-password-confirm").fill("no-coincide-con-la-otra");
  await page.getByTestId("user-submit").click();
  await expect(page.getByTestId("user-error")).toHaveText("Las contraseñas no coinciden");

  await page.getByTestId("user-password-confirm").fill(NEW_PASSWORD);
  await page.getByTestId("user-submit").click();

  await expect(page).toHaveURL("/admin/usuarios");
  await expect(page.getByTestId("toast")).toContainText("Usuario creado");
  await expect(page.getByText("camarera@lounge.test")).toBeVisible();
});

test("alta de un ADMIN: pide la contraseña del admin conectado", async ({ page }) => {
  await page.goto("/admin/usuarios/nuevo");
  await page.getByTestId("user-name").fill("Encargada");
  await page.getByTestId("user-email").fill("encargada@lounge.test");
  await page.getByTestId("user-role-ADMIN").click();
  await page.getByTestId("user-password").fill(NEW_PASSWORD);
  await page.getByTestId("user-password-confirm").fill(NEW_PASSWORD);
  await page.getByTestId("user-submit").click();

  const modal = page.getByTestId("user-modal");
  await modal.getByTestId("modal-current-password").fill("no-es-la-mia");
  await modal.getByTestId("modal-submit").click();
  await expect(modal.getByTestId("user-error")).toHaveText(
    "Tu contraseña no es correcta",
  );

  await modal.getByTestId("modal-current-password").fill(TEST_PASSWORD);
  await modal.getByTestId("modal-submit").click();
  await expect(page.getByTestId("toast")).toContainText("Usuario creado");
  expect(
    (
      await prisma.adminUser.findUniqueOrThrow({
        where: { email: "encargada@lounge.test" },
      })
    ).role,
  ).toBe("ADMIN");
});

test("cambiar la contraseña de un WORKER pide la del admin, y el WORKER entra con la nueva", async ({
  page,
  browser,
}) => {
  await openUsers(page);
  await openCard(page, IDS.worker);
  await page.getByTestId("user-change-password").click();

  const modal = page.getByTestId("user-modal");
  await modal.getByTestId("modal-current-password").fill("no-es-la-mia");
  await modal.getByTestId("modal-new-password").fill(NEW_PASSWORD);
  await modal.getByTestId("modal-confirm-password").fill(NEW_PASSWORD);
  await modal.getByTestId("modal-submit").click();
  await expect(modal.getByTestId("user-error")).toHaveText(
    "Tu contraseña no es correcta",
  );

  await modal.getByTestId("modal-current-password").fill(TEST_PASSWORD);
  await modal.getByTestId("modal-submit").click();
  await expect(page.getByTestId("user-modal")).toHaveCount(0);
  await expect(page.getByTestId("toast")).toContainText("Contraseña cambiada");

  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  await loginAs(await context.newPage(), WORKER_EMAIL, NEW_PASSWORD);
  await context.close();
});

test("cambiar la propia contraseña no cierra la sesión", async ({ page }) => {
  await openUsers(page);
  await openCard(page, IDS.admin);
  await page.getByTestId("user-change-password").click();

  const modal = page.getByTestId("user-modal");
  await modal.getByTestId("modal-current-password").fill(TEST_PASSWORD);
  await modal.getByTestId("modal-new-password").fill(NEW_PASSWORD);
  await modal.getByTestId("modal-confirm-password").fill(NEW_PASSWORD);
  await modal.getByTestId("modal-submit").click();
  await expect(page.getByTestId("toast")).toContainText("Contraseña cambiada");

  await page.locator('header a[href="/admin/usuarios"]').click(); // la flecha de volver
  await expect(page).toHaveURL("/admin/usuarios");
});

test("eliminar un WORKER, con el modal de confirmación", async ({ page }) => {
  await openUsers(page);
  await openCard(page, IDS.worker);
  await page.getByTestId("user-delete").click();
  await page.getByTestId("user-modal").getByTestId("modal-submit").click();

  await expect(page).toHaveURL("/admin/usuarios");
  await expect(page.getByTestId("toast")).toContainText("Usuario eliminado");
  await expect(page.getByTestId(`user-card-${IDS.worker}`)).toHaveCount(0);
});

test("la ficha de otro ADMIN es de solo lectura", async ({ page }) => {
  const other = await makeAdmin({ role: "ADMIN", email: "otra-admin@lounge.test" });

  await openUsers(page);
  await openCard(page, other.id);

  await expect(page.getByTestId("user-readonly")).toBeVisible();
  for (const control of ["user-submit", "user-change-password", "user-delete"]) {
    await expect(page.getByTestId(control)).toHaveCount(0);
  }
});

test("el último ADMIN no se puede eliminar, y se le explica", async ({ page }) => {
  await openUsers(page);
  await openCard(page, IDS.admin);
  await page.getByTestId("user-delete").click();

  await expect(page.getByTestId("toast")).toContainText(
    "Eres el único administrador: crea otro antes de eliminar tu cuenta",
  );
  await expect(page.getByTestId("user-modal")).toHaveCount(0);
  expect(await prisma.adminUser.count({ where: { id: IDS.admin } })).toBe(1);
});

test("ascender a un WORKER pide la contraseña, y después su ficha es de solo lectura", async ({
  page,
}) => {
  await openUsers(page);
  await openCard(page, IDS.worker);
  await page.getByTestId("user-role-ADMIN").click();
  await page.getByTestId("user-submit").click();

  const modal = page.getByTestId("user-modal");
  await modal.getByTestId("modal-current-password").fill(TEST_PASSWORD);
  await modal.getByTestId("modal-submit").click();

  await expect(page.getByTestId("toast")).toContainText("Cambios guardados");
  await expect(page.getByTestId("user-readonly")).toBeVisible();
  expect(
    (await prisma.adminUser.findUniqueOrThrow({ where: { id: IDS.worker } })).role,
  ).toBe("ADMIN");
});
