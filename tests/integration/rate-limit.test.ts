/**
 * Límite de intentos del login, contra la base (RCA-286, R2).
 *
 * Antes era un Map en memoria y vivía en los tests unitarios. Los casos son los mismos;
 * lo nuevo es que el contador lo comparten todas las instancias, que dos fallos
 * simultáneos cuentan dos y que el cron borra las ventanas vencidas.
 *
 * Solo se congela `Date` (ver `freezeClock`): las horas de la ventana salen del reloj de
 * la app, no del de Postgres, justamente para poder moverlo aquí.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  clearLoginAttempts,
  deleteExpiredLoginAttempts,
  isLoginBlocked,
  recordFailedLogin,
} from "@/lib/rate-limit";

import { freezeClock } from "../fixtures/clock";

const IP = "203.0.113.7";
const OTHER_IP = "198.51.100.23";
const MINUTE = 60 * 1000;
const WINDOW = 15 * MINUTE;
const T0 = new Date("2026-09-22T20:00:00Z");

beforeEach(() => {
  freezeClock(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

async function fail(times: number, ip = IP): Promise<void> {
  for (let i = 0; i < times; i++) await recordFailedLogin(ip);
}

function advance(ms: number): void {
  vi.setSystemTime(new Date(Date.now() + ms));
}

describe("rate-limit del login", () => {
  it("una IP sin fallos no está bloqueada", async () => {
    expect(await isLoginBlocked(IP)).toBe(false);
  });

  it("4 fallos no bloquean", async () => {
    await fail(4);
    expect(await isLoginBlocked(IP)).toBe(false);
  });

  it("5 fallos bloquean", async () => {
    await fail(5);
    expect(await isLoginBlocked(IP)).toBe(true);
  });

  it("el bloqueo es por IP: otra IP sigue pudiendo intentarlo", async () => {
    await fail(5);
    expect(await isLoginBlocked(OTHER_IP)).toBe(false);
  });

  it("un login correcto borra los fallos acumulados", async () => {
    // clearLoginAttempts es lo que llama login() tras validar la contraseña.
    await fail(5);
    await clearLoginAttempts(IP);
    expect(await isLoginBlocked(IP)).toBe(false);
  });

  it("borrar los fallos de una IP no afecta a otra", async () => {
    await fail(5);
    await fail(5, OTHER_IP);
    await clearLoginAttempts(IP);
    expect(await isLoginBlocked(OTHER_IP)).toBe(true);
  });

  it("dos fallos simultáneos cuentan dos: la suma es atómica", async () => {
    // Con un leer-y-escribir en dos pasos, los cinco leerían 0 y escribirían 1.
    await Promise.all(Array.from({ length: 5 }, () => recordFailedLogin(IP)));
    expect(await isLoginBlocked(IP)).toBe(true);
    expect(
      (await prisma.loginAttempt.findUniqueOrThrow({ where: { key: IP } })).count,
    ).toBe(5);
  });
});

describe("la ventana de 15 minutos", () => {
  it("el bloqueo dura hasta 15 minutos después del primer fallo, ni un milisegundo más", async () => {
    await fail(5);

    advance(WINDOW - 1);
    expect(await isLoginBlocked(IP)).toBe(true);

    advance(1);
    expect(await isLoginBlocked(IP)).toBe(false);
  });

  it("la ventana es fija: se cuenta desde el primer fallo, no desde el último", async () => {
    // Cuatro fallos al principio y el quinto a los 14 minutos: el bloqueo acaba a los
    // 15, no a los 29.
    await fail(4);
    advance(14 * MINUTE);
    await fail(1);
    expect(await isLoginBlocked(IP)).toBe(true);

    advance(MINUTE);
    expect(await isLoginBlocked(IP)).toBe(false);
  });

  it("los fallos de una ventana caducada no suman en la siguiente", async () => {
    await fail(4);
    advance(WINDOW);

    // Si se sumaran, este sería el quinto fallo y bloquearía.
    await fail(1);
    expect(await isLoginBlocked(IP)).toBe(false);

    await fail(3);
    expect(await isLoginBlocked(IP)).toBe(false);
    await fail(1);
    expect(await isLoginBlocked(IP)).toBe(true);
  });

  it("la ventana se guarda en UTC: resetAt es el primer fallo más 15 minutos", async () => {
    // Si la conversión de zona fallara, la ventana se desplazaría una o dos horas.
    await fail(1);
    const row = await prisma.loginAttempt.findUniqueOrThrow({ where: { key: IP } });
    expect(row.resetAt.toISOString()).toBe(new Date(T0.getTime() + WINDOW).toISOString());
  });
});

describe("limpieza de ventanas vencidas", () => {
  it("borra solo las vencidas", async () => {
    await fail(1);
    advance(10 * MINUTE);
    await fail(1, OTHER_IP);
    advance(5 * MINUTE); // la de IP vence ahora; la de OTHER_IP, dentro de 10 minutos

    expect(await deleteExpiredLoginAttempts()).toBe(1);
    expect(await prisma.loginAttempt.findMany({ select: { key: true } })).toEqual([
      { key: OTHER_IP },
    ]);
  });
});
