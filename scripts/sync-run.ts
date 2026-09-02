#!/usr/bin/env node
/**
 * Ejecuta el sync de equipos contra la base de datos del entorno actual.
 *
 * Es el mismo código que corre el cron (lib/team-sync), así que sirve para
 * probarlo en local sin tener que desplegar ni construir la cabecera de
 * CRON_SECRET.
 *
 * Exporta antes las credenciales del entorno correcto:
 *   set -a && . ./.env.testing && set +a
 *   npx tsx scripts/sync-run.ts
 */

import { PrismaClient } from "../src/generated/prisma";
import { syncTeams } from "../src/modules/football-data/lib/team-sync";

const prisma = new PrismaClient();

function projectRef(url: string | undefined): string {
  const match = url?.match(/postgres\.([a-z0-9]+)/);
  return match ? match[1] : "(desconocido)";
}

(async () => {
  const ref = projectRef(process.env.DATABASE_URL);
  console.log(`\n  Sync de equipos contra el proyecto Supabase: ${ref}`);
  console.log(`  ${new Date().toISOString()}\n`);

  const started = Date.now();
  const result = await syncTeams();
  const elapsed = Date.now() - started;

  console.log(`\n  ${"─".repeat(60)}`);
  console.log(`  Creados      : ${result.created}`);
  console.log(`  Actualizados : ${result.updated}`);
  console.log(`  Errores      : ${result.errors.length}`);
  result.errors.forEach((e) => console.log(`      · ${e}`));
  console.log(`  Duración     : ${elapsed} ms`);
  console.log("");

  await prisma.$disconnect();
  process.exit(result.errors.length > 0 ? 1 : 0);
})();
