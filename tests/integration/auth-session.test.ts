/**
 * La sesión del panel se comprueba contra la base (RCA-286, R1), el login tarda lo mismo
 * exista o no el email (R6), y el panel no se puede quedar sin ADMIN.
 *
 * La cookie de iron-session se sustituye por un objeto en memoria: lo que se prueba es
 * qué se guarda en ella al entrar y qué se decide al leerla, con la base de verdad.
 */
import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminUser } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getSessionData, login } from "@/modules/auth/actions";
import { passwordFingerprint } from "@/modules/auth/lib/session-data";
import type { SessionData } from "@/modules/auth/types";
import { deleteUser, updateUser } from "@/modules/users/actions";

import { makeAdmin, TEST_PASSWORD } from "../fixtures/factories";

type FakeSession = Partial<SessionData> & {
  save: () => Promise<void>;
  destroy: () => void;
};
let cookie: FakeSession;

function emptySession(): FakeSession {
  return { save: vi.fn(async () => {}), destroy: vi.fn() };
}

vi.mock("@/modules/auth/lib/session", () => ({ getSession: async () => cookie }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.50" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

function form(email: string, password: string): FormData {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

/** Entra por el login de verdad y deja la cookie en `cookie`. */
async function signIn(user: AdminUser): Promise<void> {
  await expect(login(null, form(user.email, TEST_PASSWORD))).rejects.toThrow(
    "REDIRECT /admin",
  );
}

let admin: AdminUser;
let worker: AdminUser;

beforeEach(async () => {
  cookie = emptySession();
  admin = await makeAdmin({ role: "ADMIN" });
  worker = await makeAdmin({ role: "WORKER" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("login", () => {
  it("guarda en la cookie la huella de la contraseña, no la contraseña ni el hash", async () => {
    await signIn(worker);

    expect(cookie).toMatchObject({
      isLoggedIn: true,
      adminId: worker.id,
      pwd: passwordFingerprint(worker.password),
    });
    expect(JSON.stringify(cookie)).not.toContain(worker.password);
  });

  it("con un email que no existe también calcula bcrypt (R6)", async () => {
    const compare = vi.spyOn(bcrypt, "compare");

    const result = await login(null, form("nadie@lounge.test", "lo-que-sea-123"));

    expect(result).toEqual({ error: "Credenciales incorrectas" });
    expect(compare).toHaveBeenCalledTimes(1);
  });
});

describe("getSessionData comprueba la cookie contra la base (R1)", () => {
  it("una sesión recién abierta vale, con el rol de la base", async () => {
    await signIn(worker);
    expect(await getSessionData()).toEqual({
      isLoggedIn: true,
      email: worker.email,
      role: "WORKER",
      adminId: worker.id,
    });
  });

  it("si se borra el usuario, su sesión cae", async () => {
    await signIn(worker);
    await prisma.adminUser.delete({ where: { id: worker.id } });

    expect((await getSessionData()).isLoggedIn).toBe(false);
  });

  it("si se le cambia la contraseña, su sesión cae", async () => {
    await signIn(worker);
    await prisma.adminUser.update({
      where: { id: worker.id },
      data: { password: await bcrypt.hash("otra-contrasena", 10) },
    });

    expect((await getSessionData()).isLoggedIn).toBe(false);
  });

  it("si se le quita el rol de ADMIN, deja de serlo sin esperar a que caduque la cookie", async () => {
    await signIn(admin);
    await prisma.adminUser.update({ where: { id: admin.id }, data: { role: "WORKER" } });

    expect(await getSessionData()).toMatchObject({ isLoggedIn: true, role: "WORKER" });
  });

  it("el rol de la cookie no cuenta: manda el de la base", async () => {
    await signIn(worker);
    cookie.role = "ADMIN";

    expect((await getSessionData()).role).toBe("WORKER");
  });

  it("una cookie anterior a este cambio, sin huella, no vale", async () => {
    Object.assign(cookie, {
      isLoggedIn: true,
      adminId: admin.id,
      email: admin.email,
      role: "ADMIN",
    });

    expect((await getSessionData()).isLoggedIn).toBe(false);
  });

  it("sin cookie, no hay sesión", async () => {
    expect(await getSessionData()).toMatchObject({ isLoggedIn: false, role: "WORKER" });
  });
});

describe("el panel no se queda sin ADMIN", () => {
  beforeEach(async () => {
    await signIn(admin);
  });

  const asWorker = (user: AdminUser) => ({
    email: user.email,
    name: user.name,
    role: "WORKER" as const,
  });

  it("no se le puede quitar el rol al último ADMIN", async () => {
    expect(await updateUser(admin.id, asWorker(admin))).toEqual({
      success: false,
      error: "Tiene que quedar al menos un administrador",
    });
    expect(
      (await prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } })).role,
    ).toBe("ADMIN");
  });

  it("con otro ADMIN, sí", async () => {
    await makeAdmin({ role: "ADMIN", email: "otro-admin@lounge.test" });
    expect(await updateUser(admin.id, asWorker(admin))).toEqual({ success: true });
  });

  it("nadie se puede borrar a sí mismo", async () => {
    expect(await deleteUser(admin.id)).toEqual({
      success: false,
      error: "No puedes eliminar tu propio usuario",
    });
    expect(await prisma.adminUser.count({ where: { id: admin.id } })).toBe(1);
  });

  it("borrar a otro usuario sigue funcionando", async () => {
    expect(await deleteUser(worker.id)).toEqual({ success: true });
  });
});
