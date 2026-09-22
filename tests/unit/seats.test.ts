import { describe, expect, it } from "vitest";

import { DEFAULT_SEAT_POSITIONS } from "@/modules/seating/constants";

import { SEED_SEATS } from "../../prisma/seats";

describe("SEED_SEATS", () => {
  it("son los 47 asientos del local", () => {
    expect(SEED_SEATS).toHaveLength(47);
  });

  it("id y code coinciden en todos", () => {
    // Lo fijó el seed original. Después scripts/rename-seats.ts cambia `code` y deja
    // `id` intacto, porque SeatStatus.seatId es clave ajena contra él.
    for (const seat of SEED_SEATS) expect(seat.code).toBe(seat.id);
  });

  it("no hay ids repetidos, tampoco ignorando mayúsculas", () => {
    // Seat_code_key es único; y los códigos se comparan sin distinguir mayúsculas.
    const lower = SEED_SEATS.map((seat) => seat.id.toLowerCase());
    expect(new Set(lower).size).toBe(SEED_SEATS.length);
  });

  it("los códigos cumplen las reglas del renombrado", () => {
    // Máximo 10 caracteres: son 80 mm de ticket con tres códigos por línea.
    for (const seat of SEED_SEATS) {
      expect(seat.code, seat.code).toMatch(/^[A-Za-z0-9_\-/.]{1,10}$/);
    }
  });

  it("todas las posiciones caen dentro del plano (0-100 %)", () => {
    for (const seat of SEED_SEATS) {
      expect(seat.posX, seat.id).toBeGreaterThanOrEqual(0);
      expect(seat.posX, seat.id).toBeLessThanOrEqual(100);
      expect(seat.posY, seat.id).toBeGreaterThanOrEqual(0);
      expect(seat.posY, seat.id).toBeLessThanOrEqual(100);
    }
  });

  it("el reparto por zona es 10 / 12 / 25", () => {
    const count = (zone: string) =>
      SEED_SEATS.filter((seat) => seat.zone === zone).length;
    expect([count("TV1"), count("TV2"), count("PROJECTOR")]).toEqual([10, 12, 25]);
  });
});

describe("DEFAULT_SEAT_POSITIONS", () => {
  it("coincide con las posiciones del seed", () => {
    // Es lo que restaura el botón "Resetear" de /admin/asientos. Hoy son una copia
    // exacta del seed; si una cambiara sin la otra, resetear dejaría el plano en un
    // estado que no corresponde a ninguna base de datos recién creada.
    const fromSeed = SEED_SEATS.map(({ id, posX, posY }) => ({ id, posX, posY }));
    expect(DEFAULT_SEAT_POSITIONS).toEqual(fromSeed);
  });
});
