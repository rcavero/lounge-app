/**
 * Usuarios del panel (P12): la matriz de permisos, la reautenticación y el último ADMIN,
 * con la base real y el login de verdad.
 *
 * Como en `auth-session.test.ts`, la cookie de iron-session es un objeto en memoria:
 * `signIn` entra por `login()` y deja ahí la sesión, y `getSessionData` la comprueba
 * contra la base igual que en producción.
 */
import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminUser } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getSessionData, login } from "@/modules/auth/actions";
import type { SessionData } from "@/modules/auth/types";
import {
  changeUserPassword,
  createUser,
  deleteUser,
  getUserForEdit,
  updateUser,
} from "@/modules/users/actions";

import { makeAdmin, TEST_PASSWORD } from "../fixtures/factories";

type FakeSession = Partial<SessionData> & {
  save: () => Promise<void>;
  destroy: () => void;
};
let cookie: FakeSession;

function emptySession(): FakeSession {
  const session: FakeSession = {
    save: vi.fn(async () => {}),
    destroy: vi.fn(() => {
      for (const key of Object.keys(session)) {
        if (key !== "save" && key !== "destroy") delete session[key as keyof SessionData];
      }
    }),
  };
  return session;
}

vi.mock("@/modules/auth/lib/session", () => ({ getSession: async () => cookie }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.60" }),
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

async function signIn(user: AdminUser): Promise<void> {
  cookie = emptySession();
  await expect(login(null, form(user.email, TEST_PASSWORD))).rejects.toThrow(
    "REDIRECT /admin",
  );
}

const NEW_PASSWORD = "nueva-contrasena-segura";

let me: AdminUser;
let worker: AdminUser;

beforeEach(async () => {
  me = await makeAdmin({ role: "ADMIN", email: "yo@lounge.test" });
  worker = await makeAdmin({ role: "WORKER", email: "worker@lounge.test" });
  vi.spyOn(console, "error").mockImplementation(() => {});
  await signIn(me);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const reload = (user: AdminUser) =>
  prisma.adminUser.findUnique({ where: { id: user.id } });

describe("otro ADMIN es de solo lectura", () => {
  let other: AdminUser;
  beforeEach(async () => {
    other = await makeAdmin({ role: "ADMIN", email: "otro@lounge.test" });
  });

  it("la ficha se ve, sin ningún permiso", async () => {
    const result = await getUserForEdit(other.id);
    expect(result?.user.email).toBe(other.email);
    expect(result?.permissions).toMatchObject({
      canEdit: false,
      canChangeRole: false,
      canChangePassword: false,
      canDelete: false,
    });
  });

  it("no se le editan los datos ni se le baja el rol", async () => {
    const before = await reload(other);
    expect(
      await updateUser(other.id, { email: "x@lounge.test", name: "X", role: "WORKER" }),
    ).toEqual({ success: false, error: "No puedes modificar a otro administrador" });
    expect(await reload(other)).toEqual(before);
  });

  it("no se le cambia la contraseña, ni con la del ADMIN conectado", async () => {
    expect(
      await changeUserPassword(other.id, {
        currentPassword: TEST_PASSWORD,
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      }),
    ).toMatchObject({ success: false });
    expect((await reload(other))?.password).toBe(other.password);
  });

  it("no se le borra", async () => {
    expect(await deleteUser(other.id, { currentPassword: TEST_PASSWORD })).toMatchObject({
      success: false,
    });
    expect(await reload(other)).not.toBeNull();
  });
});

describe("crear usuarios", () => {
  const base = {
    email: "Nuevo@Lounge.test ",
    name: "  Nuevo   Usuario ",
    password: NEW_PASSWORD,
    confirmPassword: NEW_PASSWORD,
  };

  it("un WORKER, sin pedir la contraseña del ADMIN; normaliza y hashea con coste 10", async () => {
    const result = await createUser({ ...base, role: "WORKER" });
    expect(result.success).toBe(true);

    const created = await prisma.adminUser.findUniqueOrThrow({
      where: { email: "nuevo@lounge.test" },
    });
    expect(created).toMatchObject({ name: "Nuevo Usuario", role: "WORKER" });
    expect(bcrypt.getRounds(created.password)).toBe(10);
    expect(await bcrypt.compare(NEW_PASSWORD, created.password)).toBe(true);
  });

  it("la repetición de la contraseña tiene que coincidir", async () => {
    expect(
      await createUser({
        ...base,
        role: "WORKER",
        confirmPassword: "otra-cosa-distinta",
      }),
    ).toEqual({ success: false, error: "Las contraseñas no coinciden" });
    expect(await prisma.adminUser.count()).toBe(2);
  });

  it("un ADMIN pide la contraseña del ADMIN conectado", async () => {
    expect(await createUser({ ...base, role: "ADMIN" })).toEqual({
      success: false,
      error: "Tu contraseña no es correcta",
    });
    expect(
      await createUser({ ...base, role: "ADMIN", currentPassword: "no-es-la-mia" }),
    ).toMatchObject({ success: false });
    expect(await prisma.adminUser.count()).toBe(2);

    expect(
      await createUser({ ...base, role: "ADMIN", currentPassword: TEST_PASSWORD }),
    ).toMatchObject({ success: true });
  });

  it("no repite email", async () => {
    expect(
      await createUser({ ...base, email: worker.email.toUpperCase(), role: "WORKER" }),
    ).toEqual({ success: false, error: "Ya existe un usuario con este email" });
  });
});

describe("editar un WORKER", () => {
  it("nombre y email, sin contraseña", async () => {
    expect(
      await updateUser(worker.id, {
        email: "renombrado@lounge.test",
        name: "Renombrado",
        role: "WORKER",
      }),
    ).toEqual({ success: true });
    expect(await reload(worker)).toMatchObject({
      email: "renombrado@lounge.test",
      name: "Renombrado",
    });
  });

  it("ascenderlo a ADMIN pide la contraseña del ADMIN conectado", async () => {
    const promote = { email: worker.email, name: worker.name, role: "ADMIN" as const };
    expect(await updateUser(worker.id, promote)).toMatchObject({ success: false });
    expect((await reload(worker))?.role).toBe("WORKER");

    expect(
      await updateUser(worker.id, { ...promote, currentPassword: TEST_PASSWORD }),
    ).toEqual({ success: true });
    expect((await reload(worker))?.role).toBe("ADMIN");
  });
});

describe("cambiar contraseñas", () => {
  const change = (currentPassword: string) => ({
    currentPassword,
    newPassword: NEW_PASSWORD,
    confirmPassword: NEW_PASSWORD,
  });

  it("la de un WORKER, con la del ADMIN: corta las sesiones del WORKER", async () => {
    const workerCookie = emptySession();
    cookie = workerCookie;
    await expect(login(null, form(worker.email, TEST_PASSWORD))).rejects.toThrow();
    await signIn(me);

    expect(await changeUserPassword(worker.id, change("no-es-la-mia"))).toEqual({
      success: false,
      error: "Tu contraseña no es correcta",
    });
    expect((await reload(worker))?.password).toBe(worker.password);

    expect(await changeUserPassword(worker.id, change(TEST_PASSWORD))).toEqual({
      success: true,
    });
    expect(await bcrypt.compare(NEW_PASSWORD, (await reload(worker))!.password)).toBe(
      true,
    );

    cookie = workerCookie;
    expect((await getSessionData()).isLoggedIn).toBe(false);
  });

  it("la propia: la sesión del ADMIN sigue valiendo", async () => {
    expect(await changeUserPassword(me.id, change(TEST_PASSWORD))).toEqual({
      success: true,
    });
    expect(await getSessionData()).toMatchObject({ isLoggedIn: true, adminId: me.id });
  });

  it("la nueva se valida antes de tocar nada", async () => {
    expect(
      await changeUserPassword(worker.id, {
        currentPassword: TEST_PASSWORD,
        newPassword: "corta",
        confirmPassword: "corta",
      }),
    ).toMatchObject({ success: false });
    expect((await reload(worker))?.password).toBe(worker.password);
  });

  it("tras 5 contraseñas del ADMIN erróneas, bloquea aunque la sexta sea buena", async () => {
    for (let i = 0; i < 5; i++) {
      await changeUserPassword(worker.id, change(`mala-${i}`));
    }
    expect(await changeUserPassword(worker.id, change(TEST_PASSWORD))).toEqual({
      success: false,
      error: "Demasiados intentos fallidos. Inténtalo de nuevo en 15 minutos.",
    });
    expect((await reload(worker))?.password).toBe(worker.password);
  });
});

describe("eliminar", () => {
  it("un WORKER, sin contraseña", async () => {
    expect(await deleteUser(worker.id)).toEqual({ success: true });
    expect(await reload(worker)).toBeNull();
  });

  it("el último ADMIN no se puede borrar a sí mismo, ni con su contraseña", async () => {
    expect(await deleteUser(me.id, { currentPassword: TEST_PASSWORD })).toEqual({
      success: false,
      error: "Eres el único administrador: crea otro antes de eliminar tu cuenta",
    });
    expect(await reload(me)).not.toBeNull();
  });

  it("el último ADMIN no se puede bajar a WORKER", async () => {
    expect(
      await updateUser(me.id, { email: me.email, name: me.name, role: "WORKER" }),
    ).toMatchObject({ success: false });
    expect((await reload(me))?.role).toBe("ADMIN");
  });

  it("habiendo otro ADMIN, uno se puede borrar a sí mismo con su contraseña, y se cierra su sesión", async () => {
    await makeAdmin({ role: "ADMIN", email: "otro@lounge.test" });

    expect(await deleteUser(me.id)).toMatchObject({ success: false });
    expect(await reload(me)).not.toBeNull();

    expect(await deleteUser(me.id, { currentPassword: TEST_PASSWORD })).toEqual({
      success: true,
    });
    expect(await reload(me)).toBeNull();
    expect(cookie.isLoggedIn).toBeUndefined();
  });
});
