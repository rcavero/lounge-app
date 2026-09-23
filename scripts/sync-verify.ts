#!/usr/bin/env node
/**
 * Verificación del sync de equipos.
 *
 *   npx tsx scripts/sync-verify.ts snapshot   → guarda el estado previo
 *   npx tsx scripts/sync-verify.ts report     → compara y busca problemas
 *
 * Comprueba lo que la checklist de MIGRACION_API_FUTBOL.md §9 exige a mano:
 * equipos huérfanos, duplicados y desplegables vacíos.
 *
 * Recuerda exportar las credenciales del entorno correcto antes de ejecutarlo:
 *   set -a && . ./.env.testing && set +a
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import {
  COMPETITION_LEAGUES,
  COMPETITIONS,
} from "../src/modules/football-data/config/competitions";
import { normalizeTeamName } from "../src/modules/football-data/lib/team-sync";
import { getScheduledMatches } from "../src/modules/football-data/lib/api-client";
import { toSuggestion } from "../src/modules/football-data/lib/suggestions";

const prisma = new PrismaClient();
const SNAPSHOT = "scripts/.sync-snapshot.json";

interface SnapshotTeam {
  id: string;
  name: string;
  shortName: string;
  league: string;
  externalId: number | null;
  logo: string | null;
  events: number;
}

async function loadTeams(): Promise<SnapshotTeam[]> {
  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      shortName: true,
      league: true,
      externalId: true,
      logo: true,
      _count: { select: { homeEvents: true, awayEvents: true } },
    },
    orderBy: { name: "asc" },
  });
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    league: t.league,
    externalId: t.externalId,
    logo: t.logo,
    events: t._count.homeEvents + t._count.awayEvents,
  }));
}

async function snapshot() {
  const teams = await loadTeams();
  writeFileSync(SNAPSHOT, JSON.stringify(teams, null, 2));
  const conEventos = teams.filter((t) => t.events > 0).length;
  console.log(
    `\n  Snapshot guardado: ${teams.length} equipos (${conEventos} con eventos asociados)`,
  );
  console.log(`  Fichero: ${SNAPSHOT}\n`);
}

async function report() {
  const after = await loadTeams();
  const before: SnapshotTeam[] = existsSync(SNAPSHOT)
    ? JSON.parse(readFileSync(SNAPSHOT, "utf8"))
    : [];

  console.log("\n  " + "═".repeat(74));
  console.log("  INFORME DE VERIFICACIÓN DEL SYNC");
  console.log("  " + "═".repeat(74));

  console.log(`\n  Equipos antes : ${before.length}`);
  console.log(
    `  Equipos ahora : ${after.length}   (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length})`,
  );

  // ── 1. Huérfanos: sin externalId pero con eventos ───────────────────────
  const huerfanos = after.filter((t) => t.externalId === null && t.events > 0);
  console.log(`\n  1) Equipos SIN externalId que tienen eventos: ${huerfanos.length}`);
  if (huerfanos.length === 0) {
    console.log("     ✓ El re-emparejado fue perfecto");
  } else {
    console.log("     ⚠ Estos no se re-emparejaron y hay que revisarlos a mano:");
    huerfanos
      .sort((a, b) => b.events - a.events)
      .forEach((t) =>
        console.log(
          `        · ${t.name.padEnd(30)} liga=${t.league.padEnd(22)} eventos=${t.events}`,
        ),
      );
  }

  // ── 2. Duplicados por nombre normalizado ────────────────────────────────
  const porNombre = new Map<string, SnapshotTeam[]>();
  for (const t of after) {
    const key = normalizeTeamName(t.name);
    if (!key) continue;
    if (!porNombre.has(key)) porNombre.set(key, []);
    porNombre.get(key)!.push(t);
  }
  const duplicados = [...porNombre.entries()].filter(([, ts]) => ts.length > 1);
  console.log(
    `\n  2) Posibles duplicados (mismo nombre normalizado): ${duplicados.length}`,
  );
  if (duplicados.length === 0) {
    console.log("     ✓ Sin duplicados");
  } else {
    for (const [key, ts] of duplicados) {
      console.log(`     ⚠ "${key}"`);
      ts.forEach((t) =>
        console.log(
          `        · id=${t.id.padEnd(24)} ${t.name.padEnd(28)} liga=${t.league.padEnd(20)} extId=${t.externalId ?? "null"} eventos=${t.events}`,
        ),
      );
    }
  }

  // ── 3. Desplegables vacíos ──────────────────────────────────────────────
  //     Si Team.league deja de coincidir con COMPETITION_LEAGUES, el selector
  //     de equipos del formulario de evento se queda sin opciones y no salta
  //     ningún error: es el fallo silencioso que más importa detectar.
  const ligas = new Map<string, number>();
  for (const t of after) ligas.set(t.league, (ligas.get(t.league) ?? 0) + 1);

  console.log(`\n  3) Equipos disponibles en el desplegable, por competición:`);
  let vacios = 0;
  for (const [competicion, leaguesList] of Object.entries(COMPETITION_LEAGUES)) {
    const total = leaguesList.reduce((sum, l) => sum + (ligas.get(l) ?? 0), 0);
    if (total === 0) vacios++;
    console.log(
      `     ${total === 0 ? "✗" : "✓"} ${competicion.padEnd(24)} ${String(total).padStart(4)} equipos`,
    );
  }

  console.log(`\n  4) Valores de Team.league presentes en BD:`);
  [...ligas.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([liga, n]) =>
      console.log(`     · ${liga.padEnd(26)} ${String(n).padStart(4)}`),
    );

  // ── 5. Las sugerencias reales, ¿resuelven contra la BD? ─────────────────
  //     Cierra el círculo: comprueba que los externalId que escribió el sync
  //     son los mismos que devuelve el endpoint de partidos.
  const teamMap = new Map(
    after.filter((t) => t.externalId !== null).map((t) => [t.externalId!, t.id]),
  );

  const jobs = COMPETITIONS.flatMap((c) => {
    const codes = [c.code];
    if (c.qualifyingCode) codes.push(c.qualifyingCode);
    return codes.map(async (code) => ({ c, res: await getScheduledMatches(code) }));
  });

  let sugerencias = 0;
  let ambosEnBD = 0;
  const sinResolver = new Set<string>();

  for (const { c, res } of await Promise.all(jobs)) {
    for (const ev of res?.events ?? []) {
      const s = toSuggestion(ev, c, teamMap);
      if (!s) continue;
      sugerencias++;
      if (s.homeTeam.dbTeamId && s.awayTeam.dbTeamId) ambosEnBD++;
      if (!s.homeTeam.dbTeamId) sinResolver.add(s.homeTeam.name);
      if (!s.awayTeam.dbTeamId) sinResolver.add(s.awayTeam.name);
    }
  }

  console.log(`\n  5) Sugerencias de partido resueltas contra la BD:`);
  console.log(`     Sugerencias disponibles ahora : ${sugerencias}`);
  console.log(`     Con ambos equipos ya en BD    : ${ambosEnBD}`);
  console.log(`     Equipos aún no sincronizados  : ${sinResolver.size}`);
  if (sinResolver.size) {
    console.log(`        ${[...sinResolver].join(", ")}`);
    console.log(`        (no es un fallo: se crean al vuelo al crear el evento)`);
  }

  // ── 6. Copia local de escudos ───────────────────────────────────────────
  //     Un escudo "remoto" es una dependencia viva de a.espncdn.com en la web
  //     pública. Este recuento es el que dice si la red de seguridad está
  //     puesta, y si el sync ha vuelto a pisar alguna ruta local.
  const locales = after.filter((t) => t.logo?.startsWith("/escudos/")).length;
  const remotos = after.filter((t) => t.logo?.startsWith("http")).length;
  const sinEscudo = after.filter((t) => !t.logo).length;

  console.log(`\n  6) Origen de los escudos:`);
  console.log(`     Copia local (/escudos/) : ${locales}`);
  console.log(`     URL remota              : ${remotos}`);
  console.log(`     Sin escudo (iniciales)  : ${sinEscudo}`);
  if (remotos > 0) {
    console.log(`        Ejecuta: npx tsx scripts/download-crests.ts`);
  }

  // ── Veredicto ───────────────────────────────────────────────────────────
  console.log("\n  " + "─".repeat(74));
  const problemas = huerfanos.length + duplicados.length + vacios;
  if (problemas === 0) {
    console.log("  ✓ SIN PROBLEMAS DETECTADOS\n");
  } else {
    console.log(
      `  ⚠ ${huerfanos.length} huérfanos · ${duplicados.length} duplicados · ${vacios} desplegables vacíos\n`,
    );
  }
}

(async () => {
  const mode = process.argv[2];
  try {
    if (mode === "snapshot") await snapshot();
    else if (mode === "report") await report();
    else {
      console.log("\n  Uso: npx tsx scripts/sync-verify.ts [snapshot|report]\n");
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
})();
