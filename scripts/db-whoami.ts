#!/usr/bin/env node
/**
 * ¿Contra qué base de datos estoy trabajando?
 *
 * Antes de aplicar una migración o lanzar el sync hay que estar seguro del
 * entorno: `.env` apunta a producción y `.env.testing` a testing, así que un
 * despiste escribe en la base de datos real.
 *
 * Solo lee. Nunca imprime credenciales: del DATABASE_URL únicamente extrae el
 * identificador del proyecto Supabase, que no es secreto.
 *
 * Uso:  npx tsx scripts/db-whoami.ts
 */

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

function projectRef(url: string | undefined): string {
  if (!url) return "(DATABASE_URL sin definir)";
  const match = url.match(/postgres\.([a-z0-9]+)/);
  return match ? match[1] : "(ref no reconocido)";
}

(async () => {
  console.log(`\n  Proyecto Supabase : ${projectRef(process.env.DATABASE_URL)}`);

  try {
    const [teams, events, reservations, seats, admins, migrations] = await Promise.all([
      prisma.team.count(),
      prisma.event.count(),
      prisma.reservation.count(),
      prisma.seat.count(),
      prisma.adminUser.count(),
      prisma.$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at
      `,
    ]);

    console.log(`  Equipos           : ${teams}`);
    console.log(`  Eventos           : ${events}`);
    console.log(`  Reservas          : ${reservations}`);
    console.log(`  Asientos          : ${seats}`);
    console.log(`  Usuarios admin    : ${admins}`);
    console.log(`  Migraciones aplicadas:`);
    migrations.forEach((m) => console.log(`      · ${m.migration_name}`));

    const withExternalId = await prisma.team.count({
      where: { externalId: { not: null } },
    });
    console.log(`  Equipos con externalId: ${withExternalId} de ${teams}`);
  } catch (error) {
    console.log(`\n  ✗ No se pudo consultar: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    console.log("");
  }
})();
