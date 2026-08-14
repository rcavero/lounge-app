#!/usr/bin/env node
/**
 * DESCUBRIMIENTO — API pública de ESPN
 *
 * Recorre los slugs de las 17 competiciones objetivo y verifica para cada una:
 *   - que el slug existe
 *   - la URL real del emblema de competición
 *   - si el endpoint /teams devuelve plantilla (para el sync de equipos)
 *   - cuántos partidos hay en la ventana de 7 días
 *
 * Genera por consola el bloque COMPETITIONS listo para pegar en
 * src/modules/football-data/config/competitions.ts
 *
 * Uso:  node scripts/espn-discover.mjs
 *
 * Script auxiliar temporal: se puede borrar una vez generada la configuración.
 */

const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

// name y league DEBEN conservarse idénticos en las 10 competiciones que ya
// existen: son claves de facto de COMPETITION_EMBLEM y del filtrado de equipos.
const TARGETS = [
  { slug: "uefa.champions",   name: "Champions League",      league: "Champions League",      qual: "uefa.champions_qual",   domestic: false },
  { slug: "uefa.europa",      name: "Europa League",         league: "Europa League",         qual: "uefa.europa_qual",      domestic: false },
  { slug: "uefa.europa.conf", name: "Conference League",     league: "Conference League",     qual: "uefa.europa.conf_qual", domestic: false },
  { slug: "esp.1",            name: "La Liga",               league: "La Liga",               domestic: true },
  { slug: "esp.2",            name: "La Liga 2",             league: "La Liga 2",             domestic: true },
  { slug: "eng.1",            name: "Premier League",        league: "Premier League",        domestic: true },
  { slug: "ita.1",            name: "Serie A",               league: "Serie A",               domestic: true },
  { slug: "ger.1",            name: "Bundesliga",            league: "Bundesliga",            domestic: true },
  { slug: "fra.1",            name: "Ligue 1",               league: "Ligue 1",               domestic: true },
  { slug: "por.1",            name: "Primeira Liga",         league: "Primeira Liga",         domestic: true },
  { slug: "ned.1",            name: "Eredivisie",            league: "Eredivisie",            domestic: true },
  { slug: "esp.copa_del_rey", name: "Copa del Rey",          league: "Copa del Rey",          domestic: false },
  { slug: "esp.super_cup",    name: "Supercopa de España",   league: "Supercopa de España",   domestic: false },
  { slug: "conmebol.america", name: "Copa América",          league: "Copa América",          domestic: false },
  { slug: "uefa.nations",     name: "Nations League",        league: "Nations League",        domestic: false },
  { slug: "fifa.world",       name: "World Cup",             league: "World Cup",             domestic: false },
  { slug: "uefa.euro",        name: "European Championship", league: "European Championship", domestic: false },
];

function windowDates(days = 7) {
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const now = new Date();
  return `${fmt(now)}-${fmt(new Date(now.getTime() + days * 86400000))}`;
}

async function getJson(url) {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    const body = await res.json();
    if (body?.code === 404) return null;
    return body;
  } catch {
    return null;
  }
}

async function probeScoreboard(slug, dates) {
  const d = await getJson(`${BASE}/${slug}/scoreboard?dates=${dates}`);
  if (!d) return null;
  return {
    leagueName: d.leagues?.[0]?.name ?? "?",
    emblem: d.leagues?.[0]?.logos?.[0]?.href ?? null,
    season: d.leagues?.[0]?.season?.displayName ?? "?",
    events: (d.events ?? []).length,
  };
}

async function probeTeams(slug) {
  const d = await getJson(`${BASE}/${slug}/teams`);
  const teams = d?.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return teams.length;
}

(async () => {
  const dates = windowDates(7);
  console.log(`\n  DESCUBRIMIENTO — ESPN soccer API`);
  console.log(`  Ventana de partidos: ${dates}\n`);
  console.log("  " + "─".repeat(88));
  console.log(
    "  " +
      "competición".padEnd(24) +
      "slug".padEnd(20) +
      "partidos".padEnd(10) +
      "equipos".padEnd(9) +
      "emblema"
  );
  console.log("  " + "─".repeat(88));

  const results = [];

  for (const t of TARGETS) {
    const main = await probeScoreboard(t.slug, dates);
    if (!main) {
      console.log(`  ${t.name.padEnd(24)}${t.slug.padEnd(20)}✗ SLUG NO VÁLIDO`);
      continue;
    }

    let qualOk = false;
    let qualEvents = 0;
    if (t.qual) {
      const q = await probeScoreboard(t.qual, dates);
      if (q) {
        qualOk = true;
        qualEvents = q.events;
      }
    }

    const teamCount = t.domestic ? await probeTeams(t.slug) : 0;

    const partidos = t.qual ? `${main.events}+${qualEvents}` : `${main.events}`;
    console.log(
      `  ${t.name.padEnd(24)}${t.slug.padEnd(20)}${String(partidos).padEnd(10)}${String(
        t.domestic ? teamCount : "-"
      ).padEnd(9)}${main.emblem ? "sí" : "NO"}`
    );

    results.push({ ...t, ...main, qualOk, teamCount });
  }

  console.log("  " + "─".repeat(88));

  // ── Bloque listo para pegar en competitions.ts ──────────────────────────
  console.log("\n\n  // ─── Pegar en src/modules/football-data/config/competitions.ts ───\n");
  console.log("export const COMPETITIONS: Competition[] = [");
  for (const r of results) {
    const extra = r.qual && r.qualOk ? `, qualifyingCode: "${r.qual}"` : "";
    console.log(
      `  { code: "${r.slug}", name: "${r.name}", league: "${r.league}",` +
        ` emblem: "${r.emblem}", isDomestic: ${r.domestic}${extra} },`
    );
  }
  console.log("];");

  // ── Hosts de imágenes para next.config.ts ───────────────────────────────
  const hosts = new Set(results.filter((r) => r.emblem).map((r) => new URL(r.emblem).host));
  console.log(`\n  // Hosts para next.config.ts images.remotePatterns: ${[...hosts].join(", ")}`);

  const sinEmblema = results.filter((r) => !r.emblem);
  if (sinEmblema.length) {
    console.log(`\n  ⚠ Sin emblema: ${sinEmblema.map((r) => r.name).join(", ")}`);
  }
  console.log("");
})();
