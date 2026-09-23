import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin, requireAuth } from "./auth-guard";

/**
 * Los dos guardias que protegen las server actions del panel. Son la segunda capa: el
 * middleware protege las páginas, pero una server action es un endpoint que se puede
 * llamar sin pasar por ninguna página.
 *
 * La sesión se sustituye: aquí importa la decisión, no cómo se lee la cookie (eso lo
 * prueba `session.test.ts`, y el login de verdad el E2E).
 */
vi.mock("@/modules/auth/actions", () => ({ getSessionData: vi.fn() }));

const { getSessionData } = await import("@/modules/auth/actions");
const sessionMock = vi.mocked(getSessionData);

type Session = Awaited<ReturnType<typeof getSessionData>>;

function withSession(session: Partial<Session>) {
  sessionMock.mockResolvedValue({ isLoggedIn: false, email: "", ...session } as Session);
}

beforeEach(() => {
  sessionMock.mockReset();
});

describe("requireAuth", () => {
  it("sin sesión lanza Unauthorized", async () => {
    withSession({ isLoggedIn: false });
    await expect(requireAuth()).rejects.toThrow("Unauthorized");
  });

  it("con sesión deja pasar, sea cual sea el rol", async () => {
    withSession({ isLoggedIn: true, role: "WORKER" });
    await expect(requireAuth()).resolves.toBeUndefined();
  });
});

describe("requireAdmin", () => {
  it("sin sesión lanza Forbidden", async () => {
    withSession({ isLoggedIn: false, role: "ADMIN" });
    await expect(requireAdmin()).rejects.toThrow("Forbidden");
  });

  it("un WORKER con sesión no pasa", async () => {
    withSession({ isLoggedIn: true, role: "WORKER" });
    await expect(requireAdmin()).rejects.toThrow("Forbidden");
  });

  it("un ADMIN con sesión pasa", async () => {
    withSession({ isLoggedIn: true, role: "ADMIN" });
    await expect(requireAdmin()).resolves.toBeUndefined();
  });
});
