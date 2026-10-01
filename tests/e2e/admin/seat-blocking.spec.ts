/**
 * Escenario 6: el bar bloquea asientos para un evento y el cliente deja de poder
 * reservarlos; al desbloquearlos, vuelven.
 */
import { expect, test, type Page } from "@playwright/test";

import { IDS, prisma, seedBaseline } from "../support/db";
import { openEvent, seat } from "../support/flows";

const CODES = ["T2-B1", "T2-B2", "T2-B3"];

test.beforeEach(async () => {
  await seedBaseline();
});

function blockSeat(page: Page, code: string) {
  return page.locator(`[data-testid="block-seat"][data-seat-code="${code}"]`);
}

async function toggleAndSave(page: Page, expectedState: "BLOCKED" | "AVAILABLE") {
  await page.goto(`/admin/reservas/${IDS.open}/bloquear`);
  for (const code of CODES) {
    await blockSeat(page, code).click();
    await expect(blockSeat(page, code)).toHaveAttribute("data-seat-state", expectedState);
  }
  await page.getByTestId("save-blocks").click();
  await expect(page).toHaveURL(`/admin/reservas/${IDS.open}`);
}

async function seatStates(): Promise<string[]> {
  const rows = await prisma.seatStatus.findMany({
    where: { eventId: IDS.open, seatId: { in: CODES } },
    orderBy: { seatId: "asc" },
  });
  return rows.map((r) => r.status);
}

test("bloquear tres asientos los quita del plano público; desbloquear los devuelve", async ({
  page,
}) => {
  await toggleAndSave(page, "BLOCKED");
  expect(await seatStates()).toEqual(["BLOCKED", "BLOCKED", "BLOCKED"]);

  await openEvent(page, IDS.open);
  for (const code of CODES) {
    await expect(seat(page, code)).toHaveAttribute("data-seat-state", "BLOCKED");
    await expect(seat(page, code)).toBeDisabled();
  }

  await toggleAndSave(page, "AVAILABLE");
  expect(await seatStates()).toEqual(["AVAILABLE", "AVAILABLE", "AVAILABLE"]);

  await openEvent(page, IDS.open);
  for (const code of CODES) {
    await expect(seat(page, code)).toHaveAttribute("data-seat-state", "AVAILABLE");
    await expect(seat(page, code)).toBeEnabled();
  }
});
