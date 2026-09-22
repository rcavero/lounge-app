/**
 * Entorno de los tests. Lo cargan los tres proyectos de Vitest.
 *
 * Vitest NO lee ficheros `.env` por su cuenta (comprobado con la 5.0): al worker le
 * llega un `process.env` sin nada del proyecto. Y eso rompe antes de empezar, porque
 * `src/lib/redsys.ts` valida sus tres variables **en tiempo de import** y lanza si
 * falta alguna. Cualquier test que importe `payments/actions` o la ruta `notify`
 * arrastra ese import, aunque no toque la pasarela.
 *
 * Que `redsys.ts` explote al importarse es deliberado —un despliegue sin credenciales
 * revienta en el deploy y no cuando un cliente intenta pagar—, así que los tests se
 * adaptan a él y no al revés. Son estas cinco líneas.
 *
 * Orden de precedencia, de más fuerte a más débil:
 *   1. Lo que ya venga en `process.env` (lo que inyecta CI).
 *   2. `.env.test`, si existe (desarrollo local).
 *   3. Los valores por defecto de aquí abajo.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnvFile } from "dotenv";

/**
 * Se resuelve contra `process.cwd()` —la raíz del proyecto, que es desde donde Vitest
 * arranca— y no contra `import.meta.url`: en el proyecto `ui` el entorno es jsdom, y
 * ahí `import.meta.url` no es una URL `file:`, así que `fileURLToPath` revienta.
 */
const ENV_FILE = resolve(process.cwd(), ".env.test");

// `dotenv` no pisa lo que ya esté definido, así que CI gana sin hacer nada.
if (existsSync(ENV_FILE)) {
  loadEnvFile({ path: ENV_FILE, quiet: true });
}

function fallback(key: string, value: string): void {
  if (!process.env[key]) process.env[key] = value;
}

/**
 * Credenciales **públicas** del sandbox genérico de Redsys, las que documenta el propio
 * Redsys para que cualquiera pruebe. No son las del comercio: el FUC real es otro y su
 * clave no está en el repositorio ni lo estará.
 *
 * Están aquí y no solo en `.env.test` para que la suite arranque en un clon limpio y en
 * CI, donde ese fichero no existe porque está gitignorado.
 */
fallback("REDSYS_ENV", "sandbox");
fallback("REDSYS_MERCHANT_CODE", "999008881");
fallback("REDSYS_TERMINAL", "1");
fallback("REDSYS_SECRET_KEY", "sq7HjrUOBfKmC576ILgskD5srU870gJ7");

// Secretos de usar y tirar. iron-session exige 32 caracteres como mínimo.
fallback("AUTH_SECRET", "test-auth-secret-no-vale-para-nada-32");
fallback("CRON_SECRET", "test-cron-secret");

// El 3100 es el puerto en el que Playwright levanta la app, para no chocar con el
// `npm run dev` del 3000. Aquí importa porque `BASE_URL` se firma en el pago.
fallback("NEXT_PUBLIC_BASE_URL", "http://localhost:3100");

/**
 * `DB_ENV` y `DATABASE_URL` **no llevan valor por defecto**, a propósito.
 *
 * Son las dos variables que deciden qué base de datos se vacía con un TRUNCATE en cada
 * test de integración. Un valor por defecto las convertiría en algo que "ya funciona"
 * sin que nadie lo haya dicho, y bastaría con tener exportada una `DATABASE_URL`
 * cualquiera en la shell para que la suite la tomara por la de tests.
 *
 * Sin ellas, `tests/setup/db-global.ts` aborta con un mensaje que explica qué falta.
 * Los tests unitarios y de UI no las necesitan.
 */
