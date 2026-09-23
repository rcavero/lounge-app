import { vi } from "vitest";

import { TEST_NOW } from "./factories";

/**
 * Congela `Date` —y solo `Date`— en `TEST_NOW`.
 *
 * Solo `Date` porque los temporizadores tienen que seguir siendo reales: Prisma y el
 * driver de Postgres los usan por debajo, y con `setTimeout` falso una consulta se
 * quedaría esperando para siempre.
 *
 * Quien lo llame restaura con `vi.useRealTimers()` en su `afterEach`.
 */
export function freezeClock(at: Date = TEST_NOW): void {
  vi.useFakeTimers({ toFake: ["Date"], now: at });
}
