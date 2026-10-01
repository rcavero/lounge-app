/**
 * Comprueba la tubería de tests, no el producto.
 *
 * Si algo de esto falla, no hay ningún bug en la aplicación: está mal montado el
 * andamiaje, y el resto de la suite estaría midiendo otra cosa.
 */
import { describe, expect, it } from "vitest";

import bcrypt from "bcryptjs";

import { formatEuros } from "@/lib/utils";

import { TEST_PASSWORD, TEST_PASSWORD_HASH } from "../fixtures/factories";

describe("andamiaje de tests", () => {
  it("resuelve el alias @/ contra src/", () => {
    // Si el alias no estuviera configurado, el import de arriba ni siquiera cargaría.
    expect(formatEuros(34.5)).toBe("34,50");
  });

  it("corre con el huso horario de España", () => {
    expect(process.env.TZ).toBe("Europe/Madrid");
  });

  it("interpreta los constructores locales de Date en hora española", () => {
    /**
     * Este es el motivo real de fijar el huso. `monthRange`, en los informes
     * mensuales, construye los límites del mes con `new Date(year, month, ...)`, que
     * es un constructor LOCAL. En UTC —como corre CI— el 1 de enero a las 00:00 sería
     * otro instante y el informe de enero se comería la última hora de diciembre.
     */
    expect(new Date(2026, 0, 1, 0, 0, 0).toISOString()).toBe("2025-12-31T23:00:00.000Z");

    // Y en verano el desfase es de dos horas, no de una.
    expect(new Date(2026, 6, 1, 0, 0, 0).toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });

  it("el hash fijo de los usuarios de test corresponde a TEST_PASSWORD", async () => {
    // Si alguien cambia la contraseña y no el hash, el login del E2E falla sin explicar
    // por qué.
    expect(await bcrypt.compare(TEST_PASSWORD, TEST_PASSWORD_HASH)).toBe(true);
  });

  it("usa el sandbox público de Redsys y nunca el comercio real", () => {
    expect(process.env.REDSYS_ENV).not.toBe("production");
    expect(process.env.REDSYS_MERCHANT_CODE).toBe("999008881");
    expect(process.env.REDSYS_SECRET_KEY).toBeTruthy();
  });
});
