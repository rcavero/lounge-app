/**
 * `setupFiles` del proyecto `integration`: deja la base de datos vacía antes de CADA
 * test.
 *
 * Aislamiento por borrado y no por transacción-que-se-deshace, porque el código bajo
 * prueba abre sus propias transacciones (`prisma.$transaction` en el flujo de pago) y
 * envolverlo todo en una transacción externa cambiaría lo que se está midiendo.
 *
 * El precio es que los tests no pueden correr en paralelo. Por eso el proyecto
 * `integration` usa `singleFork` y `fileParallelism: false`.
 */
import { afterAll, beforeEach } from "vitest";

import { requireDbEnv } from "../../scripts/lib/require-db-env";

import "./env";

import { prisma } from "@/lib/prisma";

/**
 * La misma puerta que en `db-global.ts`, repetida a propósito.
 *
 * Aquella corre en el proceso principal; esta corre en el worker, que es donde de
 * verdad se ejecuta el TRUNCATE. La comprobación va donde está el daño.
 */
requireDbEnv("test");

/**
 * Se calcula una vez y se reutiliza. Preguntar al catálogo en vez de mantener una lista
 * a mano significa que una tabla nueva entra sola: una lista escrita a mano se queda
 * desactualizada en la primera migración y el síntoma es un test que falla por datos
 * que creía borrados.
 */
let truncateAll: string | null = null;

async function buildTruncateStatement(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = current_schema()
      AND tablename <> '_prisma_migrations'
  `;

  if (rows.length === 0) {
    throw new Error(
      "La base de datos de tests no tiene ninguna tabla. ¿Se aplicaron las " +
        "migraciones? Revisa la salida de `prisma migrate deploy`.",
    );
  }

  const tables = rows.map((row) => `"${row.tablename}"`).join(", ");

  // Una sola sentencia con todas las tablas: `CASCADE` resuelve las claves ajenas y
  // `RESTART IDENTITY` devuelve las secuencias a su valor inicial.
  return `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`;
}

beforeEach(async () => {
  truncateAll ??= await buildTruncateStatement();
  await prisma.$executeRawUnsafe(truncateAll);
});

afterAll(async () => {
  await prisma.$disconnect();
});
