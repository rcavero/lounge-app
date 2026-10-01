import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EVENT_RETENTION_MS,
  eventRetentionCutoff,
  PENDING_RESERVATION_TTL_MS,
  pendingExpiryCutoff,
} from "./expiry";

const NOW = new Date("2026-10-14T10:00:00.000Z");

afterEach(() => {
  vi.useRealTimers();
});

describe("reserva pendiente", () => {
  it("caduca a los 5 minutos, no a los 30", () => {
    // La cifra que el cron escondía en una variable llamada `thirtyMinutesAgo`.
    expect(PENDING_RESERVATION_TTL_MS).toBe(5 * 60 * 1000);
  });

  it("el corte es ahora menos 5 minutos", () => {
    expect(pendingExpiryCutoff(NOW).toISOString()).toBe("2026-10-14T09:55:00.000Z");
  });

  it("sin argumento usa el reloj", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });

    expect(pendingExpiryCutoff()).toEqual(pendingExpiryCutoff(NOW));
  });
});

describe("evento jugado", () => {
  it("se conserva 90 días", () => {
    expect(EVENT_RETENTION_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("el corte son 90 días exactos de 24 horas, contados en milisegundos", () => {
    // No en días de calendario: si en medio hubiera un cambio de hora, el corte se
    // desplazaría una hora respecto a la medianoche. Postgres compara instantes, igual.
    const cutoff = eventRetentionCutoff(NOW);

    expect(NOW.getTime() - cutoff.getTime()).toBe(90 * 86_400_000);
    expect(cutoff.toISOString()).toBe("2026-07-16T10:00:00.000Z");
  });

  it("sin argumento usa el reloj", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });

    expect(eventRetentionCutoff()).toEqual(eventRetentionCutoff(NOW));
  });

  it("no modifica la fecha que recibe", () => {
    const now = new Date(NOW);

    eventRetentionCutoff(now);
    pendingExpiryCutoff(now);

    expect(now).toEqual(NOW);
  });
});
