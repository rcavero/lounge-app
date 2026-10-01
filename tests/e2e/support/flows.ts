/**
 * Pasos del flujo público que comparten varios escenarios.
 */
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Un asiento del plano público, por su código. */
export function seat(page: Page, code: string): Locator {
  return page.locator(`[data-testid="seat"][data-seat-code="${code}"]`);
}

/** Abre la página de un evento y acepta las condiciones, que salen siempre al entrar. */
export async function openEvent(page: Page, eventId: string): Promise<void> {
  await page.goto(`/eventos/${eventId}`);
  await page.getByTestId("conditions-accept").click();
}

/** Selecciona asientos, pulsa RESERVAR y escribe el nombre. No paga. */
export async function selectSeatsAndName(
  page: Page,
  codes: string[],
  customerName: string,
): Promise<void> {
  for (const code of codes) {
    await seat(page, code).click();
    await expect(seat(page, code)).toHaveAttribute("data-seat-state", "SELECTED");
  }
  await page.getByTestId("reserve-button").click();
  await expect(page.getByTestId("name-modal")).toBeVisible();
  await page.getByTestId("customer-name-input").fill(customerName);
}
