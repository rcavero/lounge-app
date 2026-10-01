import { describe, expect, it } from "vitest";

import { accessTokenMatches, newAccessToken } from "./access-token";

describe("newAccessToken", () => {
  it("son 22 caracteres base64url, que no hay que escapar en una URL", () => {
    expect(newAccessToken()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("no se repite", () => {
    const tokens = new Set(Array.from({ length: 1000 }, newAccessToken));
    expect(tokens.size).toBe(1000);
  });
});

describe("accessTokenMatches", () => {
  const KEY = "llave-de-la-reserva-01";

  it("con la misma llave, abre", () => {
    expect(accessTokenMatches(KEY, KEY)).toBe(true);
  });

  it.each([
    ["sin llave", undefined],
    ["con null", null],
    ["vacía", ""],
    ["con otra", "llave-de-la-reserva-02"],
    ["con un carácter de más", `${KEY}x`],
    ["con uno de menos", KEY.slice(0, -1)],
  ])("%s, no abre", (_, given) => {
    expect(accessTokenMatches(KEY, given)).toBe(false);
  });

  it("una reserva de antes del cambio, sin llave guardada, abre con cualquier cosa", () => {
    expect(accessTokenMatches(null, undefined)).toBe(true);
    expect(accessTokenMatches(null, "lo-que-sea")).toBe(true);
  });
});
