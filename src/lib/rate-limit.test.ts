import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El contador vive en un Map a nivel de módulo: sin un módulo nuevo por test, los
// fallos de un caso contarían en el siguiente.
type RateLimit = typeof import("./rate-limit");
let rateLimit: RateLimit;

const IP = "203.0.113.7";
const OTHER_IP = "198.51.100.23";
const MINUTE = 60 * 1000;
const WINDOW = 15 * MINUTE;
const T0 = new Date("2026-09-22T20:00:00Z");

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  vi.resetModules();
  rateLimit = await import("./rate-limit");
});

afterEach(() => {
  vi.useRealTimers();
});

function fail(times: number, ip = IP): void {
  for (let i = 0; i < times; i++) rateLimit.recordFailedLogin(ip);
}

function advance(ms: number): void {
  vi.setSystemTime(new Date(Date.now() + ms));
}

describe("rate-limit del login", () => {
  it("una IP sin fallos no está bloqueada", () => {
    expect(rateLimit.isLoginBlocked(IP)).toBe(false);
  });

  it("4 fallos no bloquean", () => {
    fail(4);
    expect(rateLimit.isLoginBlocked(IP)).toBe(false);
  });

  it("5 fallos bloquean", () => {
    fail(5);
    expect(rateLimit.isLoginBlocked(IP)).toBe(true);
  });

  it("el bloqueo es por IP: otra IP sigue pudiendo intentarlo", () => {
    fail(5);
    expect(rateLimit.isLoginBlocked(OTHER_IP)).toBe(false);
  });

  it("un login correcto borra los fallos acumulados", () => {
    // clearLoginAttempts es lo que llama login() tras validar la contraseña.
    fail(5);
    rateLimit.clearLoginAttempts(IP);
    expect(rateLimit.isLoginBlocked(IP)).toBe(false);
  });

  it("borrar los fallos de una IP no afecta a otra", () => {
    fail(5);
    fail(5, OTHER_IP);
    rateLimit.clearLoginAttempts(IP);
    expect(rateLimit.isLoginBlocked(OTHER_IP)).toBe(true);
  });
});

describe("la ventana de 15 minutos", () => {
  it("el bloqueo dura hasta 15 minutos después del primer fallo, ni un milisegundo más", () => {
    fail(5);

    advance(WINDOW - 1);
    expect(rateLimit.isLoginBlocked(IP)).toBe(true);

    advance(1);
    expect(rateLimit.isLoginBlocked(IP)).toBe(false);
  });

  it("la ventana es fija: se cuenta desde el primer fallo, no desde el último", () => {
    // Cuatro fallos al principio y el quinto a los 14 minutos: el bloqueo acaba a los
    // 15, no a los 29.
    fail(4);
    advance(14 * MINUTE);
    fail(1);
    expect(rateLimit.isLoginBlocked(IP)).toBe(true);

    advance(MINUTE);
    expect(rateLimit.isLoginBlocked(IP)).toBe(false);
  });

  it("los fallos de una ventana caducada no suman en la siguiente", () => {
    fail(4);
    advance(WINDOW);

    // Si se sumaran, este sería el quinto fallo y bloquearía.
    fail(1);
    expect(rateLimit.isLoginBlocked(IP)).toBe(false);

    fail(3);
    expect(rateLimit.isLoginBlocked(IP)).toBe(false);
    fail(1);
    expect(rateLimit.isLoginBlocked(IP)).toBe(true);
  });
});
