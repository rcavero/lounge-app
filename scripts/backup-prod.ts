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
 * Uso:
 *   set -a && . ./.env && set +a     # ⚠️ .env apunta a PRODUCCIÓN
 *   npx tsx scripts/backup-prod.ts
 *
 * El fichero resultante lleva datos personales de clientes reales (nombre, email,
 * teléfono) y los hashes bcrypt de los usuarios admin. `backups/*.json` está en
 * .gitignore: NO commitearlo.
 */

import { writeFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

/** Igual que en scripts/db-whoami.ts: identifica el proyecto sin imprimir credenciales. */
function projectRef(url: string | undefined): string {
  if (!url) return "(DATABASE_URL sin definir)";
  const match = url.match(/postgres\.([a-z0-9]+)/);
  return match ? match[1] : "(ref no reconocido)";
}

/**
 * `Reservation.totalPrice` es `Decimal` y `JSON.stringify` no lo serializa solo.
 * decimal.js define `toJSON`, así que llega aquí ya convertido a string; el
 * `instanceof`-por-forma cubre el caso de que algún día deje de definirlo, y el
 * `bigint` está por si se añade una columna `BigInt` más adelante.
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
    // El orden es el de las dependencias: así un restore se puede hacer de arriba
    // abajo sin violar ninguna clave ajena.
    const [adminUsers, teams, seats, zoneLabels, events, reservations, seatStatuses] =
      await Promise.all([
        prisma.adminUser.findMany(),
        prisma.team.findMany(),
        prisma.seat.findMany(),
        prisma.zoneLabel.findMany(),
        prisma.event.findMany(),
        prisma.reservation.findMany(),
        prisma.seatStatus.findMany(),
      ]);

    const migrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at
    `;

    const dump = {
      meta: {
        projectRef: ref,
        takenAt: new Date().toISOString(),
        migrationsApplied: migrations.map((m) => m.migration_name),
      },
      adminUsers,
      teams,
      seats,
      zoneLabels,
      events,
      reservations,
      seatStatuses,
    };

    const path = `backups/prod-${stamp()}.json`;
    writeFileSync(path, JSON.stringify(dump, replacer, 2), "utf8");

    console.log(`  Migraciones       : ${migrations.length}\n`);
    console.log(`  Usuarios admin    : ${adminUsers.length}`);
    console.log(`  Equipos           : ${teams.length}`);
    console.log(`  Asientos          : ${seats.length}`);
    console.log(`  Carteles de zona  : ${zoneLabels.length}`);
    console.log(`  Eventos           : ${events.length}`);
    console.log(`  Reservas          : ${reservations.length}`);
    console.log(`  Estados de asiento: ${seatStatuses.length}\n`);
    console.log(`  ✓ Escrito en ${path}`);
    console.log(`    Lleva datos personales: no commitear (está en .gitignore).\n`);
  } catch (error) {
    console.log(`\n  ✗ Falló: ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
