#!/usr/bin/env node
/**
 * ⚠️  DESTRUCTIVO — solo para ensayar el sync en testing.
 *
 * Devuelve la tabla Team al estado del snapshot: borra los equipos creados por
 * el sync y vacía los externalId. Sirve para repetir la PRIMERA sincronización
 * tantas veces como haga falta, que es la que de verdad importa ensayar antes
 * de tocar producción.
 *
 * Nunca borra equipos que tengan eventos asociados.
 *
 * Exige nombrar explícitamente el proyecto de destino, para que sea imposible
 * ejecutarlo por error contra producción:
 *
 *   set -a && . ./.env.testing && set +a
 *   npx tsx scripts/sync-reset.ts --confirm <project-ref>
 */

import { readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const SNAPSHOT = "scripts/.sync-snapshot.json";

function projectRef(url: string | undefined): string {
  const match = url?.match(/postgres\.([a-z0-9]+)/);
  return match ? match[1] : "";
}

(async () => {
  const flagIndex = process.argv.indexOf("--confirm");
  const confirmed = flagIndex !== -1 ? process.argv[flagIndex + 1] : undefined;
  const actual = projectRef(process.env.DATABASE_URL);

  if (!confirmed || confirmed !== actual) {
    console.log(`\n  ✗ Reset abortado.`);
    console.log(`    Conectado al proyecto : ${actual || "(desconocido)"}`);
    console.log(`    Confirmado con --confirm: ${confirmed ?? "(nada)"}`);
    console.log(`\n    Vuelve a lanzarlo con:  --confirm ${actual}\n`);
    await prisma.$disconnect();
    process.exit(1);
  }

  if (!existsSync(SNAPSHOT)) {
    console.log(`\n  ✗ No existe ${SNAPSHOT}. Ejecuta antes: sync-verify.ts snapshot\n`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const snapshot: Array<{
    id: string;
    name: string;
    shortName: string;
    league: string;
  }> = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  const original = new Set(snapshot.map((t) => t.id));

  const current = await prisma.team.findMany({
    select: {
      id: true,
      _count: { select: { homeEvents: true, awayEvents: true } },
    },
  });

  const creados = current.filter((t) => !original.has(t.id));
  const borrables = creados.filter((t) => t._count.homeEvents + t._count.awayEvents === 0);
  const conEventos = creados.length - borrables.length;

  console.log(`\n  Proyecto            : ${actual}`);
  console.log(`  Equipos ahora       : ${current.length}`);
  console.log(`  En el snapshot      : ${original.size}`);
  console.log(`  Creados por el sync : ${creados.length}`);
  console.log(`  Se borrarán         : ${borrables.length}`);
  if (conEventos > 0) {
    console.log(`  Se conservan (tienen eventos): ${conEventos}`);
  }

  const deleted = await prisma.team.deleteMany({
    where: { id: { in: borrables.map((t) => t.id) } },
  });
  const cleared = await prisma.team.updateMany({ data: { externalId: null } });

  // Restaurar los nombres originales es imprescindible para que el ensayo sea
  // fiel: el sync los reescribe con los de ESPN, y si no se deshace, la
  // siguiente pasada emparejaría contra nombres que producción no tiene.
  const survivors = new Set(
    (await prisma.team.findMany({ select: { id: true } })).map((t) => t.id)
  );
  const restorable = snapshot.filter((t) => survivors.has(t.id));

  for (let i = 0; i < restorable.length; i += 50) {
    await prisma.$transaction(
      restorable.slice(i, i + 50).map((t) =>
        prisma.team.update({
          where: { id: t.id },
          data: { name: t.name, shortName: t.shortName, league: t.league },
        })
      )
    );
  }

  console.log(
    `\n  ✓ Borrados: ${deleted.count}   ·   externalId vaciados: ${cleared.count}` +
      `   ·   nombres restaurados: ${restorable.length}\n`
  );

  await prisma.$disconnect();
})();
