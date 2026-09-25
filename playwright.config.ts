/**
 * E2E con Playwright. Estrategia completa en MASTER_IA.md → 3.4.
 *
 *   npm run e2e          construye, levanta la app en el 3100 y pasa los escenarios
 *   npm run e2e:report   abre el último informe HTML
 *
 * Necesita la base de Docker levantada (`npm run db:up`) y Chromium instalado
 * (`npx playwright install chromium`).
 */
import { defineConfig, devices } from "@playwright/test";

import { requireDbEnv } from "./scripts/lib/require-db-env";
import { ADMIN_STATE } from "./tests/e2e/support/auth";

// Carga `.env.test` y los valores por defecto del sandbox, igual que Vitest. Lo que ya
// venga en el entorno (CI) manda.
import "./tests/setup/env";

/**
 * La puerta, antes de levantar nada. El servidor Next hereda este `process.env`, así
 * que si aquí no es la base de tests, allí tampoco.
 */
requireDbEnv("test");

/**
 * El huso del negocio, también para el servidor: los informes mensuales construyen las
 * fechas con constructores locales. Mismo motivo que en vitest.config.mts.
 */
process.env.TZ = "Europe/Madrid";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",

  /**
   * Un solo worker y en serie: todos los specs comparten la base de datos y la
   * resiembran enteras. En paralelo se pisarían.
   */
  workers: 1,
  fullyParallel: false,

  /**
   * Sin reintentos, tampoco en CI. Un test que pasa a la segunda es un test inestable,
   * y un reintento automático lo esconde en vez de señalarlo.
   */
  retries: 0,
  forbidOnly: !!process.env.CI,

  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"], ["html"]],

  use: {
    baseURL: BASE_URL,
    // La UI elige idioma por `navigator.language`; sin esto, un runner en inglés vería
    // otra app.
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      // Lo que ve el cliente, en un móvil: es como se usa.
      name: "public",
      testMatch: /public\/.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "admin",
      testMatch: /admin\/.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: ADMIN_STATE },
    },
  ],

  /**
   * `next build` + `next start`, nunca `next dev`: en Windows el modo dev compila cada
   * ruta en el primer acceso, y el primer test de cada ruta se pasaría 20-40 s
   * esperando. Es la receta de un E2E inestable.
   *
   * Next lee por su cuenta `.env` (y `.env.production`, si existiera) al construir y al
   * arrancar, pero las variables que ya están en el entorno ganan a las de los ficheros,
   * y aquí van todas las que importan. El fichero de producción se llama `.env.prod`
   * precisamente para que Next no lo cargue nunca solo (ver MASTER_IA, P9.2). Aun así no se da por hecho: el canario de `global.setup.ts` comprueba que
   * el servidor lee la misma base que acaba de sembrar el setup.
   *
   * En local se reutiliza un servidor que ya esté en el 3100, para iterar sin
   * reconstruir. En CI, siempre uno nuevo.
   */
  webServer: {
    command: `npx next build && npx next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 5 * 60 * 1000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
