#!/usr/bin/env node
/**
 * SPIKE DE VERIFICACIÓN — API-Football (api-sports.io)
 *
 * Gate bloqueante de la Fase 0 del plan de migración.
 * NO forma parte del repo. Ejecutar desde el scratchpad.
 *
 * Uso:
 *   node spike-api-football.mjs TU_API_KEY
 *   (o)  APISPORTS_KEY=xxx node spike-api-football.mjs
 *
 * Gasta ~8 de las 100 peticiones diarias del plan free.
 *
 * Responde a las 4 preguntas abiertas:
 *   1. ¿Qué plan y cuota real tiene la cuenta?
 *   2. ¿Existe la temporada actual (2026) para La Liga en este plan?
 *   3. ¿Devuelve partidos REALES próximos de la temporada actual?  ← LA DECISIVA
 *   4. ¿Cuáles son los IDs de las 4 competiciones sin verificar?
 */

const KEY = process.argv[2] || process.env.APISPORTS_KEY;
const BASE = "https://v3.football.api-sports.io";

if (!KEY) {
  console.error("\n  ERROR: falta la API key.\n");
  console.error("  Uso:  node spike-api-football.mjs TU_API_KEY\n");
  process.exit(1);
}

// El free tier permite 10 req/min. Espaciamos 6,5 s para no chocar.
const SPACING_MS = 6500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let requestCount = 0;

async function call(path) {
  if (requestCount > 0) await sleep(SPACING_MS);
  requestCount++;

  const url = `${BASE}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);

  try {
    const res = await fetch(url, {
      headers: { "x-apisports-key": KEY },
      signal: ctrl.signal,
    });
    const body = await res.json();

    // CRÍTICO: API-Football devuelve HTTP 200 incluso en errores.
    // El fallo viene dentro del cuerpo, en `errors`.
    const errs = body.errors;
    const hasErrors = Array.isArray(errs)
      ? errs.length > 0
      : errs && Object.keys(errs).length > 0;
    if (hasErrors) {
      return { ok: false, error: JSON.stringify(errs), body, headers: res.headers };
    }

    return { ok: true, body, headers: res.headers };
  } catch (e) {
    return { ok: false, error: String(e) };
  } finally {
    clearTimeout(timer);
  }
}

const line = (c = "─") => console.log(c.repeat(72));

// ── 1. Estado de la cuenta ────────────────────────────────────────────────
async function checkStatus() {
  line("═");
  console.log("1. ESTADO DE LA CUENTA  (GET /status)");
  line();

  const r = await call("/status");
  if (!r.ok) {
    console.log(`   ✗ FALLO: ${r.error}`);
    console.log("\n   La key no es válida. Revísala en dashboard.api-football.com\n");
    process.exit(1);
  }

  const s = r.body.response;
  console.log(`   Cuenta      : ${s?.account?.email ?? "?"}`);
  console.log(`   Plan        : ${s?.subscription?.plan ?? "?"}`);
  console.log(`   Activa hasta: ${s?.subscription?.end ?? "?"}`);
  console.log(
    `   Peticiones  : ${s?.requests?.current ?? "?"} / ${s?.requests?.limit_day ?? "?"} hoy`,
  );
  return s;
}

// ── 2. ¿Existe la temporada actual? ───────────────────────────────────────
async function checkSeasons() {
  line("═");
  console.log("2. TEMPORADAS DISPONIBLES PARA LA LIGA  (GET /leagues?id=140)");
  line();

  const r = await call("/leagues?id=140");
  if (!r.ok) {
    console.log(`   ✗ FALLO: ${r.error}`);
    return null;
  }

  const entry = r.body.response?.[0];
  if (!entry) {
    console.log("   ✗ Sin respuesta para league=140");
    return null;
  }

  const seasons = entry.seasons ?? [];
  const years = seasons.map((s) => s.year);
  console.log(`   Liga     : ${entry.league?.name} (${entry.country?.name})`);
  console.log(`   Logo     : ${entry.league?.logo}`);
  console.log(`   Temporadas devueltas: ${years.length}`);
  console.log(`   Rango    : ${Math.min(...years)} … ${Math.max(...years)}`);

  const current = seasons.find((s) => s.current) ?? seasons[seasons.length - 1];
  console.log(`   Marcada como actual : ${current?.year}`);

  const has2026 = seasons.find((s) => s.year === 2026);
  if (has2026) {
    console.log(`   ✓ Temporada 2026 PRESENTE`);
    console.log(`     cobertura fixtures.events = ${has2026.coverage?.fixtures?.events}`);
  } else {
    console.log(`   ✗ Temporada 2026 AUSENTE  → el plan free no la cubre`);
  }
  return { years, has2026: !!has2026 };
}

// ── 3. LA PRUEBA DECISIVA ─────────────────────────────────────────────────
async function checkFixtures() {
  line("═");
  console.log("3. PARTIDOS PRÓXIMOS DE LA LIGA 2026-27   ← PRUEBA DECISIVA");
  console.log("   (GET /fixtures?league=140&season=2026&next=5)");
  line();

  const r = await call("/fixtures?league=140&season=2026&next=5");
  if (!r.ok) {
    console.log(`   ✗ FALLO: ${r.error}`);
    return false;
  }

  const fx = r.body.response ?? [];
  console.log(`   results: ${r.body.results}`);

  if (fx.length === 0) {
    console.log("\n   ✗✗ CERO PARTIDOS — el plan free NO sirve la temporada actual.");
    return false;
  }

  console.log("");
  for (const f of fx) {
    const d = new Date(f.fixture.date);
    console.log(
      `   ${d.toISOString().slice(0, 16).replace("T", " ")} UTC  [${f.fixture.status.short}]`,
    );
    console.log(`      ${f.teams.home.name}  vs  ${f.teams.away.name}`);
    console.log(`      jornada: ${f.league.round}`);
    console.log(
      `      escudos: ${f.teams.home.logo ? "sí" : "NO"} / ${f.teams.away.logo ? "sí" : "NO"}`,
    );
  }

  // Comprobamos que los datos que necesita la UI están todos presentes.
  const f0 = fx[0];
  const campos = {
    "fixture.id (externalMatchId)": f0.fixture?.id,
    "fixture.date (utcDate)": f0.fixture?.date,
    "teams.home.id": f0.teams?.home?.id,
    "teams.home.name": f0.teams?.home?.name,
    "teams.home.logo (escudo)": f0.teams?.home?.logo,
    "league.name": f0.league?.name,
    "league.logo (emblema)": f0.league?.logo,
  };
  console.log("\n   Campos que necesita MatchSuggestion:");
  let todos = true;
  for (const [k, v] of Object.entries(campos)) {
    const ok = v !== undefined && v !== null && v !== "";
    if (!ok) todos = false;
    console.log(`      ${ok ? "✓" : "✗"} ${k}`);
  }
  return todos;
}

// ── 4. Resolver los IDs que faltan ────────────────────────────────────────
async function resolveIds() {
  line("═");
  console.log("4. IDs PENDIENTES DE VERIFICAR  (GET /leagues?search=…)");
  line();

  const queries = [
    ["European Championship", "/leagues?search=Euro%20Championship"],
    ["Supercopa de España", "/leagues?search=Super%20Cup&country=Spain"],
    ["Copa América", "/leagues?search=Copa%20America"],
    ["UEFA Nations League", "/leagues?search=Nations%20League"],
  ];

  const found = {};
  for (const [label, path] of queries) {
    const r = await call(path);
    console.log(`\n   ${label}:`);
    if (!r.ok) {
      console.log(`      ✗ ${r.error}`);
      continue;
    }
    const hits = r.body.response ?? [];
    if (!hits.length) {
      console.log("      (sin resultados — probar otro término de búsqueda)");
      continue;
    }
    for (const h of hits.slice(0, 5)) {
      const seasons = (h.seasons ?? []).map((s) => s.year);
      const max = seasons.length ? Math.max(...seasons) : "?";
      console.log(
        `      id=${h.league.id}  ${h.league.name}  (${h.country?.name ?? "-"})  última temporada: ${max}`,
      );
    }
    found[label] = hits[0].league.id;
  }
  return found;
}

// ── Veredicto ─────────────────────────────────────────────────────────────
(async () => {
  console.log("\n  SPIKE — API-Football / api-sports.io");
  console.log(`  ${new Date().toISOString()}\n`);

  await checkStatus();
  const seasons = await checkSeasons();
  const fixturesOk = await checkFixtures();
  const ids = await resolveIds();

  line("═");
  console.log("VEREDICTO");
  line();

  if (fixturesOk) {
    console.log("  ✓ ADELANTE con API-Football.");
    console.log("    El plan free sirve partidos de la temporada actual con todos");
    console.log("    los campos que necesita la UI.");
    if (Object.keys(ids).length) {
      console.log("\n    IDs resueltos para competitions.ts:");
      for (const [k, v] of Object.entries(ids)) console.log(`      ${k} = ${v}`);
    }
  } else {
    console.log("  ✗ PARAR. El plan free de API-Football no sirve la temporada actual.");
    console.log("    Cambiar a TheSportsDB (plan B, ya pre-validado).");
    if (seasons && !seasons.has2026) {
      console.log(`    Temporadas que sí ofrece: ${seasons.years.join(", ")}`);
    }
  }

  console.log(`\n  Peticiones consumidas en este spike: ${requestCount}\n`);
})();
