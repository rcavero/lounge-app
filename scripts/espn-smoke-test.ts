#!/usr/bin/env node
/**
 * SMOKE TEST — pipeline ESPN → MatchSuggestion
 *
 * Ejercita el código real de producción (api-client + toSuggestion) contra la
 * API en vivo, sin base de datos y sin sesión. Verifica que cada sugerencia
 * cumple todas las invariantes que la UI y `createEventFromSuggestion` dan por
 * hechas.
 *
 * Uso:  npx tsx scripts/espn-smoke-test.ts
 *
 * Es el test que se puede ejecutar mientras el entorno de testing esté caído.
 * Merece la pena repetirlo de vez en cuando: ESPN no es una API documentada,
 * así que un cambio de forma en su respuesta se detecta aquí primero.
 */

import { getScheduledMatches } from "../src/modules/football-data/lib/api-client";
import { toSuggestion } from "../src/modules/football-data/lib/suggestions";
import { COMPETITIONS } from "../src/modules/football-data/config/competitions";
import type { MatchSuggestion } from "../src/modules/football-data/types";

/** Techo de INTEGER en Postgres: el tipo de Team.externalId y Event.externalMatchId. */
const PG_INT_MAX = 2147483647;

const teamMap = new Map<number, string>(); // BD vacía: todo dbTeamId será null

let checksRun = 0;
let failures = 0;

function check(condition: boolean, label: string, detail?: string): void {
  checksRun++;
  if (!condition) {
    failures++;
    console.log(`      ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Invariantes que la UI y createEventFromSuggestion dan por garantizadas. */
function validate(s: MatchSuggestion): void {
  check(Number.isSafeInteger(s.externalMatchId), "externalMatchId entero", String(s.externalMatchId));
  check(s.externalMatchId < PG_INT_MAX, "externalMatchId cabe en INTEGER de Postgres", String(s.externalMatchId));
  check(s.competition.length > 0, "competition no vacía");
  check(!Number.isNaN(Date.parse(s.utcDate)), "utcDate parseable", s.utcDate);

  const sides: Array<["homeTeam" | "awayTeam", MatchSuggestion["homeTeam"]]> = [
    ["homeTeam", s.homeTeam],
    ["awayTeam", s.awayTeam],
  ];
  for (const [side, t] of sides) {
    check(Number.isSafeInteger(t.externalId), `${side}.externalId entero`, String(t.externalId));
    check(t.externalId < PG_INT_MAX, `${side}.externalId cabe en INTEGER`, String(t.externalId));
    check(t.name.length > 0, `${side}.name no vacío`);
    check(t.shortName.length > 0, `${side}.shortName no vacío`);
    check(typeof t.crest === "string", `${side}.crest es string`);
  }
  check(s.homeTeam.externalId !== s.awayTeam.externalId, "local y visitante distintos");
}

(async () => {
  console.log("\n  SMOKE TEST — ESPN → MatchSuggestion");
  console.log(`  ${new Date().toISOString()}\n`);

  const started = Date.now();
  let totalSuggestions = 0;
  let sinEscudo = 0;
  const equiposSinEscudo = new Set<string>();
  let competitionsWithData = 0;
  const slugFailures: string[] = [];

  // En paralelo, igual que hace getMatchSuggestions en producción.
  const jobs = COMPETITIONS.flatMap((competition) => {
    const codes = [competition.code];
    if (competition.qualifyingCode) codes.push(competition.qualifyingCode);
    return codes.map(async (code) => {
      try {
        const response = await getScheduledMatches(code);
        return { competition, code, events: response?.events ?? [], error: null };
      } catch (error) {
        return { competition, code, events: [], error };
      }
    });
  });

  const results = await Promise.all(jobs);

  for (const { competition, code, events, error } of results) {
    if (error) {
      slugFailures.push(
        `${code}: ${error instanceof Error ? error.message : String(error)}`
      );
      continue;
    }

    const suggestions = events
      .map((e) => toSuggestion(e, competition, teamMap))
      .filter((s): s is MatchSuggestion => s !== null);

    if (suggestions.length > 0) competitionsWithData++;
    totalSuggestions += suggestions.length;

    for (const s of suggestions) {
      validate(s);
      for (const t of [s.homeTeam, s.awayTeam]) {
        if (!t.crest) {
          sinEscudo++;
          equiposSinEscudo.add(t.name);
        }
      }
    }

    if (suggestions.length) {
      const first = suggestions[0];
      console.log(
        `  ${competition.name.padEnd(24)} ${String(suggestions.length).padStart(3)} partidos   ` +
          `p.ej. ${first.homeTeam.shortName} vs ${first.awayTeam.shortName} (${first.utcDate.slice(0, 16)})`
      );
    } else {
      console.log(`  ${competition.name.padEnd(24)}   0 partidos   (sin calendario publicado ahora mismo)`);
    }
  }

  const elapsed = Date.now() - started;

  console.log("\n  " + "─".repeat(70));
  console.log(`  Competiciones con partidos : ${competitionsWithData} / ${COMPETITIONS.length}`);
  console.log(`  Sugerencias totales        : ${totalSuggestions}`);
  console.log(
    `  Escudos ausentes           : ${sinEscudo} de ${totalSuggestions * 2} ` +
      `(la UI cae al círculo de iniciales)`
  );
  if (equiposSinEscudo.size) {
    console.log(`     equipos sin escudo: ${[...equiposSinEscudo].join(", ")}`);
  }
  console.log(`  Comprobaciones ejecutadas  : ${checksRun}`);
  console.log(`  Tiempo (17 comps, paralelo): ${elapsed} ms`);

  if (slugFailures.length) {
    console.log(`\n  ⚠ Slugs que fallaron:`);
    slugFailures.forEach((f) => console.log(`      ${f}`));
  }

  console.log("");
  if (failures === 0 && totalSuggestions > 0) {
    console.log("  ✓ TODAS LAS INVARIANTES SE CUMPLEN\n");
    process.exit(0);
  }
  if (totalSuggestions === 0) {
    console.log("  ✗ Ninguna competición devolvió partidos — revisar la API\n");
    process.exit(1);
  }
  console.log(`  ✗ ${failures} comprobaciones fallidas\n`);
  process.exit(1);
})();
