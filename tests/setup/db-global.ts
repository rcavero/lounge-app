/**
 * `globalSetup` del proyecto `integration`: prepara la base de datos UNA vez, antes de
 * que corra ningún fichero de test.
 *
 * Corre en el proceso principal de Vitest, no en los workers, así que carga el entorno
 * por su cuenta: `setupFiles` todavía no se ha ejecutado aquí.
 */
import { execSync } from "node:child_process";

import { requireDbEnv } from "../../scripts/lib/require-db-env";

import "./env";

/**
 * Oculta la contraseña de la URL antes de imprimirla. La de Docker no es un secreto,
 * pero el día que alguien apunte esto a otro sitio el log no tiene por qué contarlo.
 */
function describeTarget(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`;
  } catch {
    return "(DATABASE_URL no es una URL válida)";
  }
}

export function setup(): void {
  /**
   * La puerta. Esta suite hace TRUNCATE de todas las tablas en cada test, así que solo
   * puede correr contra la base de datos de tests. `.env.test` se autodeclara con
   * `DB_ENV=test`; producción y testing declaran lo suyo y no pasan de aquí.
   */
  requireDbEnv("test");

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. Copia .env.example a .env.test y levanta la base de " +
        "datos con `npm run db:up`.",
    );
  }

  console.log(`\n  Base de datos de tests: ${describeTarget(url)}`);

  /**
   * `migrate deploy` y no `db push`: el CHECK `reservation_total_matches_breakdown` que
   * garantiza que el total cuadra con el desglose vive como SQL crudo dentro de la
   * migración `add_management_fee`, no en `schema.prisma`. Con `db push` la base de
   * tests no lo tendría y los tests que lo comprueban pasarían en falso.
   *
   * Es idempotente: si no hay migraciones pendientes, no hace nada.
   */
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}
