import { afterEach, describe, expect, it, vi } from "vitest";

// BASE_URL es una constante que se calcula al importar el módulo: cada caso necesita
// fijar el entorno y después importar un módulo nuevo.
async function baseUrlWith(env: {
  NEXT_PUBLIC_BASE_URL?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_URL?: string;
}): Promise<string> {
  // Cadena vacía y no undefined: tests/setup/env.ts pone NEXT_PUBLIC_BASE_URL por
  // defecto, y el módulo trata "" igual que una variable sin definir.
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", env.NEXT_PUBLIC_BASE_URL ?? "");
  vi.stubEnv("VERCEL_BRANCH_URL", env.VERCEL_BRANCH_URL ?? "");
  vi.stubEnv("VERCEL_URL", env.VERCEL_URL ?? "");
  vi.resetModules();
  const { BASE_URL } = await import("./base-url");
  return BASE_URL;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("BASE_URL", () => {
  it("usa NEXT_PUBLIC_BASE_URL por encima de todo", async () => {
    // En producción es el dominio que sale impreso en el recibo de pago: tiene que
    // ganar a las URLs que inyecta Vercel.
    await expect(
      baseUrlWith({
        NEXT_PUBLIC_BASE_URL: "https://reservas.example.com",
        VERCEL_BRANCH_URL: "app-git-main.vercel.app",
        VERCEL_URL: "app-abc123.vercel.app",
      }),
    ).resolves.toBe("https://reservas.example.com");
  });

  it("sin ella, usa la URL estable de la rama con https", async () => {
    // La URL de rama no cambia entre despliegues; la de despliegue sí. Por eso va
    // antes: las URLs de retorno de Redsys tienen que seguir valiendo.
    await expect(
      baseUrlWith({
        VERCEL_BRANCH_URL: "app-git-testing.vercel.app",
        VERCEL_URL: "app-abc123.vercel.app",
      }),
    ).resolves.toBe("https://app-git-testing.vercel.app");
  });

  it("sin rama, usa la URL del despliegue con https", async () => {
    await expect(baseUrlWith({ VERCEL_URL: "app-abc123.vercel.app" })).resolves.toBe(
      "https://app-abc123.vercel.app",
    );
  });

  it("sin ninguna, cae a localhost:3000", async () => {
    await expect(baseUrlWith({})).resolves.toBe("http://localhost:3000");
  });

  it("COMPORTAMIENTO ACTUAL: no quita la barra final", async () => {
    // Quien la usa concatena "/api/...": con una barra final en la variable de
    // Vercel, las URLs firmadas saldrían con "//". Es un error de configuración, no
    // del código, pero conviene saber que nada lo corrige.
    await expect(
      baseUrlWith({ NEXT_PUBLIC_BASE_URL: "https://reservas.example.com/" }),
    ).resolves.toBe("https://reservas.example.com/");
  });
});
