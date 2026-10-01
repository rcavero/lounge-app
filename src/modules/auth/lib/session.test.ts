import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession, sessionOptions } from "./session";

/**
 * La cookie de sesión del panel: qué nombre y qué banderas lleva. Una regresión aquí
 * (perder `httpOnly`, o `sameSite`) no la vería ningún test funcional: el login seguiría
 * funcionando igual, pero la cookie quedaría expuesta.
 *
 * `cookies()` de Next se sustituye por un almacén en memoria.
 */
const store = new Map<string, string>();
const setCalls: Array<{ name: string; value: string; options: Record<string, unknown> }> =
  [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      store.has(name) ? { name, value: store.get(name)! } : undefined,
    set: (name: string, value: string, options: Record<string, unknown> = {}) => {
      store.set(name, value);
      setCalls.push({ name, value, options });
    },
  }),
}));

beforeEach(() => {
  store.clear();
  setCalls.length = 0;
});

describe("sessionOptions", () => {
  it("cookie propia, httpOnly y sameSite lax, de 7 días", () => {
    expect(sessionOptions.cookieName).toBe("lounge-admin-session");
    expect(sessionOptions.cookieOptions).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
  });

  it("secure solo en producción: en local y en tests se sirve por http", () => {
    expect(process.env.NODE_ENV).not.toBe("production");
    expect(sessionOptions.cookieOptions?.secure).toBe(false);
  });
});

describe("getSession", () => {
  it("sin cookie, la sesión está vacía", async () => {
    const session = await getSession();
    expect(session.isLoggedIn).toBeUndefined();
  });

  it("guardar escribe la cookie cifrada, y se puede volver a leer", async () => {
    const session = await getSession();
    session.isLoggedIn = true;
    session.role = "ADMIN";
    await session.save();

    expect(setCalls).toHaveLength(1);
    const [cookie] = setCalls;
    expect(cookie.name).toBe("lounge-admin-session");
    // Cifrada: el rol no viaja en claro.
    expect(cookie.value).not.toContain("ADMIN");
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "lax" });

    const again = await getSession();
    expect(again).toMatchObject({ isLoggedIn: true, role: "ADMIN" });
  });
});
