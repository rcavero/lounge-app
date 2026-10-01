/**
 * Escenario 7 (parte pública): el ticket y el recibo del pago se descargan como PDF.
 *
 * No se inspecciona el contenido del PDF, solo que se genera un PDF de verdad con el
 * nombre esperado: lo que va dentro ya lo fijan los tests de componentes. Aquí importa
 * que jsPDF carga y genera en un navegador real, que es lo que ningún otro test ve.
 */
import { readFile } from "node:fs/promises";

import { expect, test, type Download } from "@playwright/test";

import { makeReservation } from "../../fixtures/factories";
import { IDS, prisma, seedBaseline } from "../support/db";
import { lastOpenedBlobHeader, recordWindowOpen } from "../support/pdf";

const ORDER_ID = "900000000888";

test.beforeEach(async () => {
  await seedBaseline();
  const event = await prisma.event.findUniqueOrThrow({ where: { id: IDS.open } });
  const seats = await prisma.seat.findMany({ where: { id: { in: ["T1-A4", "T1-A5"] } } });
  const reservation = await makeReservation({
    event,
    seats,
    status: "CONFIRMED",
    paymentId: ORDER_ID,
    createdAt: new Date(),
  });
  await prisma.reservation.update({
    where: { id: reservation.id },
    data: { authorisationCode: "112233", paymentDateTime: "14/10/2026 12:00" },
  });
});

async function expectPdf(download: Download, filename: RegExp) {
  expect(download.suggestedFilename()).toMatch(filename);
  const bytes = await readFile(await download.path());
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
}

test("ticket y recibo en PDF @slow", async ({ page }) => {
  await recordWindowOpen(page);
  await page.goto(`/reserva/confirmacion/${ORDER_ID}`);
  await expect(page.getByTestId("ticket")).toBeVisible();

  // El ticket se descarga y además se abre en otra pestaña.
  const [ticket] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("ticket-pdf").click(),
  ]);
  await expectPdf(ticket, /^ticket-.+\.pdf$/);
  expect(await lastOpenedBlobHeader(page)).toBe("%PDF-");

  const [receipt] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("receipt-pdf").click(),
  ]);
  await expectPdf(receipt, new RegExp(`^recibo-${ORDER_ID}\\.pdf$`));
});
