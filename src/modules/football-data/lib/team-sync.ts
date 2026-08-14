// Núcleo del sync de equipos, sin comprobación de sesión.
//
// Vive fuera de actions/index.ts a propósito: el cron se autentica con
// CRON_SECRET y no tiene sesión de usuario, así que no puede pasar por
// requireAuth(). La server action de la UI envuelve esta función añadiendo
// la comprobación de sesión; la ruta del cron la llama directamente.

import prisma from "@/lib/prisma";
import { getCompetitionTeams, getTeamLogo } from "./api-client";
import {
  COMPETITIONS,
  TEAM_NAME_ALIASES,
  type Competition,
} from "../config/competitions";
import type { SyncResult, EspnTeam } from "../types";

/**
 * Normaliza el nombre de un equipo para emparejar registros que vienen de
 * proveedores distintos: "FC Barcelona" / "Barcelona", "Real Madrid CF" /
 * "Real Madrid", "Club Atlético de Madrid" / "Atlético Madrid".
 *
 * Es deliberadamente conservadora: prefiere no emparejar (y crear un duplicado
 * que la query de reconciliación detecta) antes que emparejar mal dos equipos
 * distintos, lo que reasignaría eventos históricos al equipo equivocado.
 */
const NAME_STOPWORDS = new Set([
  "fc", "cf", "afc", "ac", "sc", "cd", "ud", "rc", "rcd", "sd",
  "sad", "club", "de", "del", "la", "el", "los", "las",
  "deportivo", "futbol", "futebol", "calcio",
]);

const DIACRITICS = /[̀-ͯ]/g;

/** Palabras significativas del nombre, ya normalizadas y sin stopwords. */
export function nameTokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !NAME_STOPWORDS.has(word));
}

export function normalizeTeamName(name: string): string {
  return nameTokens(name).join("");
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** ESPN entrega los identificadores como string; Team.externalId es Int. */
export function toIntId(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function teamShortName(team: EspnTeam): string {
  return team.shortDisplayName?.trim() || team.displayName.trim();
}

interface TeamRow {
  id: string;
  externalId: number | null;
  name: string;
  shortName: string;
  logo: string | null;
}

/**
 * Índice en memoria de la tabla Team.
 *
 * La tabla se lee UNA sola vez al empezar el sync. Resolver cada equipo con
 * consultas sueltas significaría recorrer la tabla entera por cada uno de los
 * ~600 equipos que devuelven las 17 competiciones — un patrón O(n²) contra la
 * base de datos, justo el tipo de carga que agotó el pool de conexiones en el
 * incidente del 17/07/2026.
 */
interface TeamIndex {
  byExternalId: Map<number, TeamRow>;
  /** Solo equipos sin externalId: son los candidatos a emparejar por nombre. */
  byNormalizedName: Map<string, TeamRow>;
  byId: Map<string, TeamRow>;
}

async function loadTeamIndex(): Promise<TeamIndex> {
  const rows = await prisma.team.findMany({
    select: { id: true, externalId: true, name: true, shortName: true, logo: true },
  });

  const index: TeamIndex = {
    byExternalId: new Map(),
    byNormalizedName: new Map(),
    byId: new Map(),
  };

  for (const row of rows) {
    index.byId.set(row.id, row);
    if (row.externalId !== null) {
      index.byExternalId.set(row.externalId, row);
    } else {
      for (const key of [normalizeTeamName(row.name), normalizeTeamName(row.shortName)]) {
        // El primero gana: si dos equipos se normalizan igual, no emparejamos
        // el segundo y se queda como duplicado detectable.
        if (key && !index.byNormalizedName.has(key)) index.byNormalizedName.set(key, row);
      }
    }
  }

  return index;
}

/** Marca una fila como ya vinculada, para que no vuelva a emparejarse por nombre. */
function linkRow(index: TeamIndex, row: TeamRow, externalId: number): void {
  for (const key of [normalizeTeamName(row.name), normalizeTeamName(row.shortName)]) {
    if (key && index.byNormalizedName.get(key) === row) index.byNormalizedName.delete(key);
  }
  row.externalId = externalId;
  index.byExternalId.set(externalId, row);
}

interface PlannedUpdate {
  id: string;
  externalId: number;
  name: string;
  shortName: string;
  logo: string | null;
}

interface PlannedCreate extends PlannedUpdate {
  league: string;
}

/**
 * Decide qué hacer con un equipo de la API, sin tocar la base de datos.
 * El orden de resolución es:
 *   1. externalId exacto        (ya sincronizado con este proveedor)
 *   2. nombre normalizado       (venía de football-data.org)
 *   3. slug sobre Team.id       (equipos del seed original)
 *   4. crear nuevo
 *
 * Team.id nunca se modifica: es la clave que referencian Event.homeTeamId y
 * Event.awayTeamId, y cambiarla huerfanizaría los eventos históricos.
 *
 * Devuelve null cuando la fila ya está como debe: escribir en ese caso serían
 * cientos de UPDATE sin efecto en cada ejecución del cron.
 */
function planTeam(
  apiTeam: EspnTeam,
  index: TeamIndex,
  updates: PlannedUpdate[]
): boolean {
  const externalId = toIntId(apiTeam.id);
  if (externalId === null) return true; // sin id utilizable: se ignora

  const name = apiTeam.displayName.trim();
  const shortName = teamShortName(apiTeam);
  const logo = getTeamLogo(apiTeam);

  /**
   * `previousExternalId` se pasa explícitamente porque linkRow() ya ha mutado
   * la fila en memoria cuando llegamos aquí. Compararlo contra row.externalId
   * daría siempre "sin cambios" y el externalId nunca llegaría a la base de
   * datos: el índice quedaría enlazado y la fila real no.
   */
  const queueUpdate = (row: TeamRow, previousExternalId: number | null): void => {
    const nextLogo = logo ?? row.logo;
    const unchanged =
      previousExternalId === externalId &&
      row.name === name &&
      row.shortName === shortName &&
      row.logo === nextLogo;
    if (unchanged) return;

    updates.push({ id: row.id, externalId, name, shortName, logo: nextLogo });
    row.name = name;
    row.shortName = shortName;
    row.logo = nextLogo;
  };

  // 1. Por externalId
  const byExternalId = index.byExternalId.get(externalId);
  if (byExternalId) {
    queueUpdate(byExternalId, byExternalId.externalId);
    return true;
  }

  // 2. Por nombre normalizado, probando también el alias declarado para los
  //    equipos que ESPN nombra de forma más corta que el proveedor anterior.
  //    Un nombre que se normaliza a cadena vacía (todo stopwords) no puede
  //    emparejarse: coincidiría con cualquier otro caso degenerado.
  const alias = TEAM_NAME_ALIASES[name];
  for (const candidate of [name, alias]) {
    if (!candidate) continue;
    const normalized = normalizeTeamName(candidate);
    const byName = normalized ? index.byNormalizedName.get(normalized) : undefined;
    if (byName) {
      const previous = byName.externalId;
      // linkRow debe ir primero: usa row.name para retirar las claves antiguas
      // del índice, y queueUpdate lo sobrescribe.
      linkRow(index, byName, externalId);
      queueUpdate(byName, previous);
      return true;
    }
  }

  // 3. Por slug (equipos del seed original que aún no tienen externalId)
  const slug = slugify(shortName);
  const bySlug = slug ? index.byId.get(slug) : undefined;
  if (bySlug && bySlug.externalId === null) {
    const previous = bySlug.externalId;
    linkRow(index, bySlug, externalId);
    queueUpdate(bySlug, previous);
    return true;
  }

  return false; // sin resolver: lo intenta la segunda pasada
}

/** Encola la creación de un equipo que no ha podido emparejarse con ninguno existente. */
function planCreate(
  apiTeam: EspnTeam,
  competition: Competition,
  index: TeamIndex,
  creates: PlannedCreate[]
): void {
  const externalId = toIntId(apiTeam.id);
  if (externalId === null) return;

  const name = apiTeam.displayName.trim();
  const shortName = teamShortName(apiTeam);
  const logo = getTeamLogo(apiTeam);

  // Si el slug ya está ocupado por otro equipo, se desambigua con el externalId
  // para no chocar con la clave primaria.
  const slug = slugify(shortName);
  const bySlug = slug ? index.byId.get(slug) : undefined;
  const id = bySlug ? `${slug}-${externalId}` : slug || `team-${externalId}`;

  creates.push({
    id,
    externalId,
    name,
    shortName,
    logo: logo ?? null,
    league: competition.league,
  });

  const row: TeamRow = { id, externalId, name, shortName, logo: logo ?? null };
  index.byId.set(id, row);
  index.byExternalId.set(externalId, row);
}

/**
 * Aplica las escrituras por lotes.
 *
 * Cada `prisma.team.update` suelto es un viaje de ida y vuelta a Supabase; con
 * ~500 equipos eso eran más de dos minutos solo de latencia. Agruparlos en
 * transacciones reduce el número de viajes en dos órdenes de magnitud.
 */
const WRITE_BATCH_SIZE = 50;

async function applyWrites(
  updates: PlannedUpdate[],
  creates: PlannedCreate[]
): Promise<void> {
  for (let i = 0; i < updates.length; i += WRITE_BATCH_SIZE) {
    const batch = updates.slice(i, i + WRITE_BATCH_SIZE);
    await prisma.$transaction(
      batch.map((u) =>
        prisma.team.update({
          where: { id: u.id },
          data: {
            externalId: u.externalId,
            name: u.name,
            shortName: u.shortName,
            logo: u.logo,
          },
        })
      )
    );
  }

  for (let i = 0; i < creates.length; i += WRITE_BATCH_SIZE) {
    // skipDuplicates protege de una ejecución simultánea del cron y de la UI.
    await prisma.team.createMany({
      data: creates.slice(i, i + WRITE_BATCH_SIZE),
      skipDuplicates: true,
    });
  }
}

/**
 * Sincroniza los equipos de todas las competiciones desde ESPN.
 *
 * Las ligas domésticas se procesan primero para que sus equipos reciban su liga
 * real en Team.league; si se procesara antes una copa, un equipo de La Liga
 * quedaría marcado como "Copa del Rey" y desaparecería de su desplegable.
 */
export async function syncTeams(): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  const index = await loadTeamIndex();

  const ordered = [...COMPETITIONS].sort((a, b) => {
    if (a.isDomestic === b.isDomestic) return 0;
    return a.isDomestic ? -1 : 1;
  });

  // Las peticiones a ESPN se lanzan en paralelo (no hay rate limit), pero las
  // escrituras se aplican en serie y en orden de competición: es lo que
  // garantiza que Team.league acabe con el valor de la liga doméstica.
  const responses = await Promise.all(
    ordered.map(async (competition) => {
      try {
        return { competition, teams: await getCompetitionTeams(competition.code), error: null };
      } catch (error) {
        return { competition, teams: [] as EspnTeam[], error };
      }
    })
  );

  const updates: PlannedUpdate[] = [];
  const creates: PlannedCreate[] = [];
  let seen = 0;

  // Primera pasada: emparejado exacto (externalId, nombre normalizado, slug).
  // Debe completarse para TODOS los equipos antes de intentar el emparejado
  // parcial, o un nombre corto podría llevarse una fila que le corresponde a
  // otro equipo que aún no ha sido procesado.
  const unresolved: Array<{ apiTeam: EspnTeam; competition: Competition }> = [];

  for (const { competition, teams, error } of responses) {
    if (error) {
      const msg = `Error al obtener ${competition.name}: ${error}`;
      console.error(`[sync] ${msg}`);
      result.errors.push(msg);
      continue;
    }

    for (const apiTeam of teams) {
      seen++;
      try {
        if (!planTeam(apiTeam, index, updates)) {
          unresolved.push({ apiTeam, competition });
        }
      } catch (teamError) {
        const msg = `Error al procesar ${apiTeam.displayName}: ${teamError}`;
        console.error(`[sync] ${msg}`);
        result.errors.push(msg);
      }
    }
  }

  // Segunda pasada: lo que no se ha podido emparejar, se crea como equipo nuevo.
  for (const { apiTeam, competition } of unresolved) {
    try {
      planCreate(apiTeam, competition, index, creates);
    } catch (teamError) {
      const msg = `Error al procesar ${apiTeam.displayName}: ${teamError}`;
      console.error(`[sync] ${msg}`);
      result.errors.push(msg);
    }
  }

  try {
    await applyWrites(updates, creates);
    result.created = creates.length;
    result.updated = updates.length;
  } catch (writeError) {
    const msg = `Error al escribir los equipos: ${writeError}`;
    console.error(`[sync] ${msg}`);
    result.errors.push(msg);
  }

  result.skipped = seen - updates.length - creates.length;

  console.log(
    `[sync] Terminado. Creados: ${result.created}, actualizados: ${result.updated}, ` +
      `sin cambios: ${result.skipped}, errores: ${result.errors.length}`
  );
  return result;
}
