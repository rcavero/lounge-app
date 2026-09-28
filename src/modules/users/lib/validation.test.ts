import { describe, expect, it } from "vitest";

import {
  normalizeEmail,
  normalizeName,
  passwordBytes,
  validateEmail,
  validateName,
  validateNewPassword,
} from "./validation";

describe("validateNewPassword", () => {
  it("acepta 8 caracteres que coinciden", () => {
    expect(validateNewPassword("abcdefgh", "abcdefgh")).toBeNull();
  });

  it("rechaza menos de 8", () => {
    expect(validateNewPassword("1234567", "1234567")).toMatch(/al menos 8/);
  });

  it("rechaza si la repetición no coincide", () => {
    expect(validateNewPassword("una-contrasena", "otra-contrasena")).toBe(
      "Las contraseñas no coinciden",
    );
  });

  it("el límite de bcrypt es en bytes: 72 «a» valen, 73 no", () => {
    expect(validateNewPassword("a".repeat(72), "a".repeat(72))).toBeNull();
    expect(validateNewPassword("a".repeat(73), "a".repeat(73))).toBe(
      "La contraseña es demasiado larga",
    );
  });

  it("un emoji son 4 bytes: 18 emojis son 72 bytes aunque sean 36 unidades de JS", () => {
    const ball = String.fromCodePoint(0x26bd); // 3 bytes
    const beer = String.fromCodePoint(0x1f37a); // 4 bytes
    expect(passwordBytes(ball)).toBe(3);
    expect(passwordBytes(beer)).toBe(4);
    expect(validateNewPassword(beer.repeat(18), beer.repeat(18))).toBeNull();
    expect(validateNewPassword(beer.repeat(19), beer.repeat(19))).toBe(
      "La contraseña es demasiado larga",
    );
  });
});

describe("email y nombre", () => {
  it("normaliza el email a minúsculas y sin espacios", () => {
    expect(normalizeEmail("  Ana@Lounge.TEST ")).toBe("ana@lounge.test");
  });

  it("valida la forma del email", () => {
    expect(validateEmail("ana@lounge.test")).toBeNull();
    expect(validateEmail("ana@lounge")).toBe("Email no válido");
  });

  it("el nombre es obligatorio y como mucho de 60 caracteres", () => {
    expect(validateName(normalizeName("   "))).toBe("El nombre es obligatorio");
    expect(validateName("a".repeat(60))).toBeNull();
    expect(validateName("a".repeat(61))).toMatch(/60/);
  });

  it("colapsa los espacios del nombre", () => {
    expect(normalizeName("  Ana   María ")).toBe("Ana María");
  });
});
