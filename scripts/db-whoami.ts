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

/**
 * Describe el destino sin exponer credenciales: el ref del proyecto si es Supabase,
 * y host:puerto/base si es la base local de Docker. Nunca imprime la URL entera.
 */
function describeTarget(url: string | undefined): string {
  if (!url) return "(DATABASE_URL sin definir)";

  const supabase = url.match(/postgres\.([a-z0-9]+)/);
  if (supabase) return `Supabase ${supabase[1]}`;

  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(destino no reconocido)";
  }
}

(async () => {
  // El entorno autodeclarado va primero: es la respuesta a "¿dónde estoy?" y lo que
  // leen los guardarraíles. El destino real va debajo para poder contrastarlo.
  const dbEnv = (process.env.DB_ENV ?? "").trim() || "⚠️  SIN DECLARAR";
  console.log(`\n  Entorno (DB_ENV)  : ${dbEnv}`);
  console.log(`  Destino           : ${describeTarget(process.env.DATABASE_URL)}`);

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
