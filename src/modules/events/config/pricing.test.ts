import { describe, expect, it } from "vitest";

import {
  DEFAULT_MANAGEMENT_FEE_CENTS,
  MANAGEMENT_FEE_OPTIONS_CENTS,
  centsToEuros,
  isValidManagementFeeCents,
  safeManagementFeeCents,
} from "./pricing";

describe("MANAGEMENT_FEE_OPTIONS_CENTS", () => {
  it("va de 0 a 500 céntimos en pasos de 50", () => {
    expect(MANAGEMENT_FEE_OPTIONS_CENTS).toEqual([
      0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500,
    ]);
  });

  it("incluye el valor por defecto de 1,50 €", () => {
    // Si el defecto no estuviera en la lista, safeManagementFeeCents devolvería un
    // valor que la propia validación rechaza.
    expect(DEFAULT_MANAGEMENT_FEE_CENTS).toBe(150);
    expect(MANAGEMENT_FEE_OPTIONS_CENTS).toContain(DEFAULT_MANAGEMENT_FEE_CENTS);
  });
});

describe("isValidManagementFeeCents", () => {
  it.each(MANAGEMENT_FEE_OPTIONS_CENTS)("acepta %i", (cents) => {
    expect(isValidManagementFeeCents(cents)).toBe(true);
  });

  it.each([
    ["uno menos que un valor válido", 149],
    ["por encima del máximo", 501],
    ["un múltiplo de 50 por encima del máximo", 550],
    ["negativo", -50],
    ["con decimales", 150.5],
    ["en euros en vez de céntimos", 1.5],
    ["NaN", Number.NaN],
    ["infinito", Number.POSITIVE_INFINITY],
  ])("rechaza un número %s: %s", (_label, value) => {
    expect(isValidManagementFeeCents(value)).toBe(false);
  });

  it.each([
    ["un string numérico", "150"],
    ["null", null],
    ["undefined", undefined],
    ["un booleano", true],
    ["un array", [150]],
  ])("rechaza %s", (_label, value) => {
    // Lo que llega de un formulario puede ser un string: "150" no es 150 y no se cuela.
    expect(isValidManagementFeeCents(value)).toBe(false);
  });
});

describe("safeManagementFeeCents", () => {
  it("devuelve el valor tal cual si es válido", () => {
    expect(safeManagementFeeCents(250)).toBe(250);
    expect(safeManagementFeeCents(500)).toBe(500);
  });

  it("respeta el 0: un evento sin gastos de gestión no cobra 1,50 €", () => {
    // La trampa del falsy. Si alguien lo reescribe como `value || DEFAULT`, este test
    // es lo único que avisa antes de que un evento gratuito empiece a cobrar.
    expect(safeManagementFeeCents(0)).toBe(0);
  });

  it("cae al valor por defecto si no llega nada", () => {
    expect(safeManagementFeeCents(undefined)).toBe(DEFAULT_MANAGEMENT_FEE_CENTS);
  });

  it("cae al valor por defecto si llega algo fuera de la lista", () => {
    // Nunca se escribe en la BD un importe que el admin no podía elegir.
    expect(safeManagementFeeCents(149)).toBe(DEFAULT_MANAGEMENT_FEE_CENTS);
    expect(safeManagementFeeCents(-50)).toBe(DEFAULT_MANAGEMENT_FEE_CENTS);
    expect(safeManagementFeeCents(Number.NaN)).toBe(DEFAULT_MANAGEMENT_FEE_CENTS);
  });
});

describe("centsToEuros", () => {
  it("divide entre 100", () => {
    expect(centsToEuros(150)).toBe(1.5);
    expect(centsToEuros(0)).toBe(0);
    expect(centsToEuros(500)).toBe(5);
  });
});
