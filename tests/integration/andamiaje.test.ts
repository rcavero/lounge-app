/**
 * Comprueba la tubería de integración, no el producto: que hay una base de datos
 * real detrás, que está migrada y que cada test la recibe vacía.
 *
 * Requiere Docker levantado (`npm run db:up`).
 */
import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";

const UN_EVENTO = {
  title: "Partido de prueba",
  eventDate: new Date("2026-10-01T20:00:00Z"),
};

describe("andamiaje de integración", () => {
  it("habla con un PostgreSQL de verdad", async () => {
    const [row] = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;

    expect(row.ok).toBe(1);
  });

  it("tiene las migraciones aplicadas", async () => {
    const applied = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) AS count
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;

    expect(Number(applied[0].count)).toBeGreaterThan(0);
  });

  it("tiene el CHECK que vive en SQL crudo, no en schema.prisma", async () => {
    /**
     * `reservation_total_matches_breakdown` se declara a mano dentro de la migración
     * `add_management_fee`. Prisma no lo conoce, así que una base creada con
     * `db push` —en lugar de `migrate deploy`— no lo tendría y los tests del
     * invariante del dinero pasarían sin que la base lo estuviera garantizando.
     */
    const constraints = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname
      FROM pg_constraint
      WHERE conname = 'reservation_total_matches_breakdown'
    `;

    expect(constraints).toHaveLength(1);
  });

  it("deja que la base rechace un total que no cuadra con el desglose", async () => {
    const event = await prisma.event.create({ data: UN_EVENTO });

    // 2 asientos × (10,00 € + 1,50 €) son 23,00 €, no 10,00 €.
    await expect(
      prisma.reservation.create({
        data: {
          eventId: event.id,
          customerName: "Ramon",
          customerEmail: "prueba@example.com",
          numberOfSeats: 2,
          totalPrice: 10,
          seatPriceCents: 1000,
          managementFeeCents: 150,
        },
      }),
    ).rejects.toThrow();
  });

  it("acepta el total que sí cuadra", async () => {
    const event = await prisma.event.create({ data: UN_EVENTO });

    const reservation = await prisma.reservation.create({
      data: {
        eventId: event.id,
        customerName: "Ramon",
        customerEmail: "prueba@example.com",
        numberOfSeats: 2,
        totalPrice: 23,
        seatPriceCents: 1000,
        managementFeeCents: 150,
      },
    });

    expect(Number(reservation.totalPrice)).toBe(23);
  });

  it("aísla los tests entre sí: aquí se escribe", async () => {
    expect(await prisma.event.count()).toBe(0);

    await prisma.event.create({ data: UN_EVENTO });

    expect(await prisma.event.count()).toBe(1);
  });

  it("aísla los tests entre sí: y aquí ya no está", async () => {
    // Lo que escribió el test anterior tiene que haber desaparecido con el TRUNCATE
    // de `tests/setup/db-each.ts`. Si este test falla, la suite entera deja de ser
    // fiable: los tests pasarían o no según el orden en que se ejecuten.
    expect(await prisma.event.count()).toBe(0);
  });
});
