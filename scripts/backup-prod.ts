#!/usr/bin/env node
/**
 * Volcado completo de la base de datos a un JSON restaurable.
 *
 * Se hace antes de aplicar migraciones que tocan datos ya existentes. La única del
 * lote de septiembre de 2026 que reescribe filas es `20260825120000_add_management_fee`
 * (reconstruye `seatPriceCents` de todas las reservas a partir de `totalPrice`), así
 * que esto es la red por debajo de ese backfill.
 *
 * Solo lee. Nunca imprime credenciales: del DATABASE_URL únicamente extrae el
 * identificador del proyecto Supabase, que no es secreto.
 *
 * Uso: cargar explícitamente el entorno de PRODUCCIÓN (`.env.production`) y ejecutar:
 *   npx tsx scripts/backup-prod.ts
 *
 * ⚠️ No te fíes del nombre del fichero que hayas cargado. La comprobación que cuenta es
 * la PRIMERA LÍNEA de salida, que imprime el ref del proyecto Supabase: si no es el de
 * producción —o dice "(ref no reconocido)"— estás contra otra base de datos. Aborta.
 *
 * El fichero resultante lleva datos personales de clientes reales (nombre, email,
 * teléfono) y los hashes bcrypt de los usuarios admin. `backups/*.json` está en
 * .gitignore: NO commitearlo.
 */

import { writeFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

/**
 * El orden es el de las dependencias: así un restore se puede hacer de arriba abajo
 * sin violar ninguna clave ajena.
 */
const TABLES = [
  "AdminUser",
  "Team",
  "Seat",
  "ZoneLabel",
  "Event",
  "Reservation",
  "SeatStatus",
] as const;

/** Igual que en scripts/db-whoami.ts: identifica el proyecto sin imprimir credenciales. */
function projectRef(url: string | undefined): string {
  if (!url) return "(DATABASE_URL sin definir)";
  const match = url.match(/postgres\.([a-z0-9]+)/);
  return match ? match[1] : "(ref no reconocido)";
}

/**
 * `Reservation.totalPrice` es `Decimal` y `JSON.stringify` no lo serializa solo.
 * decimal.js define `toJSON`, así que llega aquí ya convertido a string; el
 * duck-typing cubre el caso de que algún día deje de definirlo, y el `bigint` está
 * porque una consulta cruda devuelve los `int8` de Postgres como tal.
 */
function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { toFixed?: unknown }).toFixed === "function"
  ) {
    return String(value);
  }
  return value;
}

/** Sello de tiempo local, legible y ordenable: 2026-09-02-1015 */
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

(async () => {
  const ref = projectRef(process.env.DATABASE_URL);
  console.log(`\n  Proyecto Supabase : ${ref}`);

  try {
    // `SELECT *` en crudo y no el cliente de Prisma a propósito: el cliente está
    // generado a partir del esquema NUEVO y pide columnas que la base todavía no
    // tiene, así que reventaría justo cuando más falta hace el backup. En crudo se
    // vuelca lo que hay de verdad, antes o después de migrar.
    const data: Record<string, unknown[]> = {};
    for (const table of TABLES) {
      data[table] = await prisma.$queryRawUnsafe<unknown[]>(
        `SELECT * FROM "${table}" ORDER BY "id"`
      );
    }

    const migrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at
    `;

    const dump = {
      meta: {
        projectRef: ref,
        takenAt: new Date().toISOString(),
        migrationsApplied: migrations.map((m) => m.migration_name),
      },
      ...data,
    };

    const path = `backups/prod-${stamp()}.json`;
    writeFileSync(path, JSON.stringify(dump, replacer, 2), "utf8");

    console.log(`  Migraciones       : ${migrations.length}\n`);
    for (const table of TABLES) {
      console.log(`  ${table.padEnd(18)}: ${data[table].length}`);
    }
    console.log(`\n  ✓ Escrito en ${path}`);
    console.log(`    Lleva datos personales: no commitear (está en .gitignore).\n`);
  } catch (error) {
    console.log(`\n  ✗ Falló: ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
