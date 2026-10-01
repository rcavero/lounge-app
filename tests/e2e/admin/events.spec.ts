/**
 * Escenario 5: alta y edición de eventos desde el panel, y su efecto en lo público.
 */
import { expect, test, type Page } from "@playwright/test";

import { hours, makeEvent } from "../../fixtures/factories";
import { TEAMS, prisma, seedBaseline } from "../support/db";
import { openEvent, seat } from "../support/flows";

test.beforeEach(async () => {
  await seedBaseline();
});

/** "YYYY-MM-DD" del día de Madrid, que es lo que espera el `<input type="date">`. */
function madridDate(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(date);
}

/** Fecha y hora del evento nuevo: mañana a las 21:00. */
async function fillDateTime(page: Page) {
  await page.getByTestId("event-date").fill(madridDate(new Date(Date.now() + hours(24))));
  await page.getByTestId("event-time").fill("21:00");
}

async function submitAndBackToList(page: Page) {
  await page.getByTestId("event-submit").click();
  await expect(page).toHaveURL("/admin/eventos");
}

test("alta de un partido de fútbol: título y 47 asientos", async ({ page }) => {
  await page.goto("/admin/eventos/nuevo");
  await expect(page.getByTestId("event-competition")).toHaveValue("La Liga");

  await page.getByTestId("event-home-team").selectOption(TEAMS.home.id);
  await page.getByTestId("event-away-team").selectOption(TEAMS.away.id);
  await fillDateTime(page);
  await submitAndBackToList(page);

  const event = await prisma.event.findFirstOrThrow({
    where: { homeTeamId: TEAMS.home.id },
    include: { _count: { select: { seatStatuses: true } } },
  });
  // El título se construye con los nombres cortos de los equipos.
  expect(event).toMatchObject({
    title: "Real Madrid vs Barcelona",
    competition: "La Liga",
    awayTeamId: TEAMS.away.id,
    pricePerSeat: 10,
    managementFeeCents: 150,
    status: "UPCOMING",
  });
  expect(event._count.seatStatuses).toBe(47);
  expect(madridDate(event.eventDate)).toBe(madridDate(new Date(Date.now() + hours(24))));
});

test("alta de Fórmula 1: el formulario se queda en un solo campo", async ({ page }) => {
  await page.goto("/admin/eventos/nuevo");
  await page.getByTestId("event-competition").selectOption("Fórmula 1");

  // Motor: ni equipos ni visitante, solo el Gran Premio.
  await expect(page.getByTestId("event-home-team")).toHaveCount(0);
  await expect(page.getByTestId("event-away-name")).toHaveCount(0);
  await page.getByTestId("event-grand-prix").fill("Gran Premio de España");
  await fillDateTime(page);
  await submitAndBackToList(page);

  const event = await prisma.event.findFirstOrThrow({
    where: { competition: "Fórmula 1" },
    include: { _count: { select: { seatStatuses: true } } },
  });
  expect(event).toMatchObject({
    title: "Gran Premio de España",
    homeTeamName: "Gran Premio de España",
    awayTeamName: null,
    homeTeamId: null,
  });
  expect(event._count.seatStatuses).toBe(47);
});

test("cambiar los gastos de gestión cambia el precio del plano público", async ({
  page,
}) => {
  const event = await makeEvent({
    title: "Real Madrid vs Barcelona",
    competition: "La Liga",
    homeTeamId: TEAMS.home.id,
    awayTeamId: TEAMS.away.id,
    eventDate: new Date(Date.now() + hours(24)),
  });
  const seats = await prisma.seat.findMany();
  await prisma.seatStatus.createMany({
    data: seats.map((s) => ({ eventId: event.id, seatId: s.id })),
  });

  // Antes: 10 € + 1,50 €.
  await openEvent(page, event.id);
  await seat(page, "T1-A1").click();
  await expect(page.getByTestId("selection-total")).toHaveText("11,50€");

  await page.goto(`/admin/eventos/${event.id}`);
  await page.getByTestId("event-fee").selectOption("300");
  await submitAndBackToList(page);

  const updated = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
  expect(updated.managementFeeCents).toBe(300);

  // Después: 10 € + 3,00 €.
  await openEvent(page, event.id);
  await seat(page, "T1-A1").click();
  await expect(page.getByTestId("selection-total")).toHaveText("13,00€");
});
