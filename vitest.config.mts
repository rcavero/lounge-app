import { fileURLToPath } from "node:url";
import { defaultExclude, defineConfig } from "vitest/config";

/**
 * Huso horario de los tests, fijado ANTES de que Vitest arranque ningún worker.
 *
 * No es cosmético: `monthRange` (reservations/actions) construye fechas con
 * `new Date(year, month, ...)`, que son constructores LOCALES. Sin fijar el huso,
 * los tests de informes mensuales pasan en Madrid y fallan en CI, que corre en UTC:
 * el primer día del mes a las 00:00 locales cae en el mes anterior.
 *
 * Se asigna sin condición, no con `??=`: Madrid no es una preferencia del que ejecuta
 * los tests, es el huso del negocio —un bar de Valencia— y el que usan las fechas que
 * se guardan. Dejar que la variable del entorno mandara solo serviría para que la suite
 * diera resultados distintos en cada máquina.
 *
 * Los workers heredan `process.env` del proceso principal, y este fichero se evalúa
 * antes de que arranque ninguno.
 */
process.env.TZ = "Europe/Madrid";

/**
 * El único alias del proyecto (`@/*` → `src/*`, ver tsconfig.json).
 *
 * Se escribe a mano en lugar de instalar `vite-tsconfig-paths`: es un alias, son dos
 * líneas, y una dependencia menos que mantener. Tampoco hay `@vitejs/plugin-react`:
 * Vite ya transforma `.tsx` con esbuild respetando el `jsx: "react-jsx"` del tsconfig,
 * y lo único que aportaría el plugin es Fast Refresh, que en tests no existe.
 */
const resolve = {
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
  },
};

/**
 * Ningún test vive bajo `src/app/`: el App Router escanea ese árbol para descubrir
 * rutas y un `page.test.tsx` suelto se convierte en una ruta de la aplicación. Los
 * tests de handlers viven en `tests/integration/` e importan la ruta:
 *
 *   import { POST } from "@/app/api/payments/notify/route";
 */
const exclude = [...defaultExclude, "src/app/**"];

export default defineConfig({
  test: {
    projects: [
      {
        resolve,
        test: {
          name: "unit",
          environment: "node",
          include: [
            // Colocados junto al módulo que prueban.
            "src/**/*.test.ts",
            // Y los que no son de ningún módulo: el andamiaje, invariantes globales.
            "tests/unit/**/*.test.ts",
          ],
          exclude,
          setupFiles: ["./tests/setup/env.ts"],
        },
      },
      {
        resolve,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          exclude,
          setupFiles: ["./tests/setup/env.ts", "./tests/setup/ui.ts"],
        },
      },
      {
        resolve,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // Migra la base de tests una vez, antes de todo.
          globalSetup: ["./tests/setup/db-global.ts"],
          // Y la deja vacía antes de cada test.
          setupFiles: ["./tests/setup/env.ts", "./tests/setup/db-each.ts"],
          /**
           * Un solo proceso y un fichero cada vez. Todos los tests comparten la MISMA
           * base de datos y cada uno empieza con un TRUNCATE: en paralelo se borrarían
           * las filas unos a otros y los fallos serían intermitentes, que es la peor
           * clase de fallo. Se paga en segundos y se cobra en determinismo.
           *
           * `isolate` se queda en su valor por defecto (true): cada fichero estrena
           * proceso y, con él, su propio cliente de Prisma. Desactivarlo iría más
           * rápido a cambio de compartir el caché de módulos entre ficheros, que es
           * justo la clase de acoplamiento que esta suite intenta evitar.
           */
          pool: "forks",
          maxWorkers: 1,
          fileParallelism: false,
          // Levantar el cliente de Prisma y migrar tarda más que un test puro.
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // Cliente generado por Prisma: no es código nuestro.
        "src/generated/**",
        "src/**/*.test.{ts,tsx}",
        // Solo declaraciones de tipos: no hay nada que ejecutar.
        "src/**/types/**",
      ],
      /**
       * Umbrales SOLO sobre las capas que no son interfaz: dominio, `lib/` y `config/`.
       * Nunca sobre `app/` ni `components/`: un porcentaje global obliga a probar JSX
       * decorativo, y la cobertura acaba siendo una cifra que se persigue en vez de una
       * red de seguridad. La interfaz la cubren los tests de componentes donde decide
       * algo, y el E2E.
       *
       * Se miden con la suite ENTERA (`npm run test:coverage`, que necesita Docker): hay
       * código de `lib/` que solo ejercita la integración, como `receipt.ts` y
       * `apply-payment-outcome.ts`, que escriben en la base. En CI corre en el job `db`.
       *
       * Valores del 23 de septiembre de 2026, al fijarlos: dominio y config al 100 % de
       * líneas; `lib/` al 97 % de líneas y 96 % de ramas. Lo que falta son ramas que
       * dependen del entorno (producción o no) en `prisma.ts` y `redsys.ts`. Los
       * umbrales dejan margen para un cambio pequeño sin test, no para uno grande.
       */
      thresholds: {
        "src/modules/**/domain/**": {
          lines: 95,
          statements: 95,
          functions: 95,
          branches: 90,
        },
        "src/**/config/**": { lines: 95, statements: 95, functions: 95, branches: 90 },
        "src/**/lib/**": { lines: 90, statements: 90, functions: 90, branches: 90 },
      },
    },
  },
});
