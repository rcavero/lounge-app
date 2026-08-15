#!/usr/bin/env node
/**
 * Descarga escudos de equipo y emblemas de competición a public/, y re-enlaza
 * Team.logo para que apunte a la copia local.
 *
 * Motivo: hasta ahora la base de datos solo guardaba URLs remotas y el navegador
 * del cliente pedía las imágenes directamente a a.espncdn.com. Si ESPN bloquea
 * el hotlinking o cambia las rutas, se rompen todos los escudos de la web
 * pública y no hay nada con lo que recuperarlos. Con la copia local, ESPN pasa a
 * ser solo la fuente en el momento del sync.
 *
 *   npx tsx scripts/download-crests.ts             descarga lo que falte y re-enlaza
 *   npx tsx scripts/download-crests.ts --dry-run   solo informa, no toca nada
 *   npx tsx scripts/download-crests.ts --force     vuelve a descargar todo
 *
 * Es idempotente: una segunda ejecución no descarga ni escribe nada.
 *
 * ⚠️  Escribe en la base de datos. Exporta antes las credenciales del entorno
 * correcto y confírmalo:
 *
 *   set -a && . ./.env.testing && set +a
 *   npx tsx scripts/db-whoami.ts
 */

import { mkdir, writeFile, stat, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma";
import { EMBLEM_SOURCES } from "../src/modules/football-data/config/competitions";
import { localLogoPath } from "../src/modules/football-data/lib/team-sync";

const prisma = new PrismaClient();

const PUBLIC_DIR = path.join(process.cwd(), "public");
const CRESTS_DIR = path.join(PUBLIC_DIR, "escudos");
const EMBLEMS_DIR = path.join(PUBLIC_DIR, "competiciones");

const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const CONCURRENCY = 8;
const WRITE_BATCH_SIZE = 50;

/** Extensiones que puede tener una copia local, para localizarla en disco. */
const IMAGE_EXTENSIONS = ["png", "svg", "gif", "jpg", "webp"] as const;

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

function projectRef(url: string | undefined): string {
  if (!url) return "(DATABASE_URL sin definir)";
  const match = url.match(/postgres\.([a-z0-9]+)/);
  return match ? match[1] : "(ref no reconocido)";
}

/** Devuelve la primera URL remota de las que se le pasan, o null. */
function pickRemote(...candidates: Array<string | null>): string | null {
  for (const value of candidates) {
    if (value && value.startsWith("http")) return value;
  }
  return null;
}

/**
 * Formato real del fichero, deducido de sus primeros bytes.
 *
 * No basta con mirar la URL ni el content-type: ESPN sirve algunos escudos en
 * SVG o GIF bajo rutas acabadas en `.png`. Guardar un SVG como .png lo deja sin
 * renderizar, porque los navegadores no aplican sniffing a los SVG por
 * seguridad. La extensión tiene que salir del contenido.
 */
function detectExtension(bytes: Buffer): string | null {
  const hex = (start: number, end: number) =>
    bytes.subarray(start, end).toString("hex");

  if (hex(0, 8) === "89504e470d0a1a0a") return "png";
  if (hex(0, 3) === "474946") return "gif";
  if (hex(0, 3) === "ffd8ff") return "jpg";
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }

  const head = bytes.subarray(0, 512).toString("utf8").trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "svg";

  return null;
}

/** Localiza la copia local de `base` en `dir`, sea cual sea su extensión. */
function findExisting(dir: string, base: string): string | null {
  for (const ext of IMAGE_EXTENSIONS) {
    const candidate = path.join(dir, `${base}.${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

interface DownloadJob {
  url: string;
  dir: string;
  /** Nombre de fichero SIN extensión: la decide el contenido descargado. */
  base: string;
  label: string;
  /** Emblemas: extensión que declara la config, que debe coincidir. */
  expectExt?: string;
}

type DownloadOutcome = "downloaded" | "present" | "failed";

interface DownloadReport {
  outcome: DownloadOutcome;
  job: DownloadJob;
  /** Ruta real en disco, ya con su extensión correcta. */
  filePath?: string;
  error?: string;
}

/**
 * Descarga una imagen con timeout y reintentos.
 *
 * Valida que el contenido sea realmente una imagen reconocible: un CDN que
 * responde con una página de error en HTML y un 200 dejaría en disco un fichero
 * corrupto que después rompe el escudo en la web. Ante la duda, no se escribe.
 */
async function download(job: DownloadJob): Promise<DownloadReport> {
  const existing = findExisting(job.dir, job.base);
  if (!force && existing) {
    return { outcome: "present", job, filePath: existing };
  }
  if (dryRun) {
    return { outcome: "downloaded", job };
  }

  let lastError = "desconocido";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(job.url, { signal: controller.signal });

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        // 4xx no se arregla reintentando.
        if (response.status < 500 && response.status !== 429) break;
        throw new Error(lastError);
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0) {
        lastError = "respuesta vacía";
        break;
      }

      const ext = detectExtension(bytes);
      if (!ext) {
        lastError = `formato no reconocido (${bytes.length} bytes)`;
        break;
      }
      if (job.expectExt && ext !== job.expectExt) {
        // Los emblemas tienen su ruta fijada en config/competitions.ts, así que
        // aquí no se puede improvisar la extensión: hay que corregir la config.
        lastError = `el contenido es ${ext} pero la config declara .${job.expectExt} — actualiza competitions.ts`;
        break;
      }

      const dest = path.join(job.dir, `${job.base}.${ext}`);
      await writeFile(dest, bytes);

      // Si antes se había guardado con otra extensión, se retira: si no,
      // findExisting podría devolver la copia antigua en la siguiente pasada.
      for (const other of IMAGE_EXTENSIONS) {
        if (other === ext) continue;
        const stale = path.join(job.dir, `${job.base}.${other}`);
        if (existsSync(stale)) await unlink(stale);
      }

      return { outcome: "downloaded", job, filePath: dest };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt === MAX_RETRIES) break;
      await new Promise((r) => setTimeout(r, 500 * (attempt * 2 + 1)));
    } finally {
      clearTimeout(timer);
    }
  }

  return { outcome: "failed", job, error: lastError };
}

/** Ejecuta los trabajos con concurrencia limitada, para no abrir 400 sockets a la vez. */
async function runPool(jobs: DownloadJob[]): Promise<DownloadReport[]> {
  const results: DownloadReport[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      results.push(await download(job));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker)
  );
  return results;
}

/** Peso total en disco de un directorio (sin recursión: son planos). */
async function dirSize(dir: string): Promise<{ files: number; bytes: number }> {
  if (!existsSync(dir)) return { files: 0, bytes: 0 };
  const names = await readdir(dir);
  let bytes = 0;
  for (const name of names) {
    bytes += (await stat(path.join(dir, name))).size;
  }
  return { files: names.length, bytes };
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function summarize(title: string, reports: DownloadReport[]): number {
  const downloaded = reports.filter((r) => r.outcome === "downloaded").length;
  const present = reports.filter((r) => r.outcome === "present").length;
  const failed = reports.filter((r) => r.outcome === "failed");

  console.log(`\n  ${title}`);
  console.log(`     Descargados   : ${downloaded}`);
  console.log(`     Ya presentes  : ${present}`);
  console.log(`     Fallidos      : ${failed.length}`);
  failed.forEach((r) => console.log(`        ✗ ${r.job.label} — ${r.error}`));

  // Los formatos distintos de PNG merecen mención: es lo que obliga a derivar
  // la extensión del contenido en vez de asumirla.
  const noPng = reports.filter(
    (r) => r.filePath && !r.filePath.endsWith(".png")
  );
  if (noPng.length) {
    console.log(`     No son PNG    : ${noPng.length}`);
    noPng.forEach((r) =>
      console.log(`        · ${r.job.label} → ${path.extname(r.filePath!)}`)
    );
  }

  return failed.length;
}

interface Relink {
  id: string;
  logo: string;
  logoSource: string;
}

async function applyRelinks(relinks: Relink[]): Promise<void> {
  // Por lotes en una transacción: un update suelto por equipo son ~400 viajes a
  // Supabase, el patrón de carga que agotó el pool en el incidente del 17/07.
  for (let i = 0; i < relinks.length; i += WRITE_BATCH_SIZE) {
    const batch = relinks.slice(i, i + WRITE_BATCH_SIZE);
    await prisma.$transaction(
      batch.map((r) =>
        prisma.team.update({
          where: { id: r.id },
          data: { logo: r.logo, logoSource: r.logoSource },
        })
      )
    );
  }
}

(async () => {
  console.log("\n  " + "═".repeat(74));
  console.log("  DESCARGA DE ESCUDOS Y EMBLEMAS");
  console.log("  " + "═".repeat(74));
  console.log(`\n  Proyecto Supabase : ${projectRef(process.env.DATABASE_URL)}`);
  console.log(
    `  Modo              : ${dryRun ? "DRY RUN (no escribe nada)" : "real"}${force ? " · --force" : ""}`
  );

  if (!dryRun) {
    await mkdir(CRESTS_DIR, { recursive: true });
    await mkdir(EMBLEMS_DIR, { recursive: true });
  }

  // ── 1. Emblemas de competición (constantes del config) ──────────────────
  //     Su ruta está fijada en competitions.ts y la lee la UI, así que aquí la
  //     extensión no se deduce: se exige que coincida.
  const emblemJobs: DownloadJob[] = Object.entries(EMBLEM_SOURCES).map(
    ([localPath, url]) => ({
      url,
      dir: EMBLEMS_DIR,
      base: path.basename(localPath, path.extname(localPath)),
      label: localPath,
      expectExt: path.extname(localPath).replace(".", ""),
    })
  );
  const emblemFailures = summarize(
    `1) Emblemas de competición (${emblemJobs.length})`,
    await runPool(emblemJobs)
  );

  // ── 2. Escudos de equipo (desde la base de datos) ────────────────────────
  const teams = await prisma.team.findMany({
    select: { id: true, name: true, logo: true, logoSource: true },
    orderBy: { name: "asc" },
  });

  const crestJobs: DownloadJob[] = [];
  const withoutSource: string[] = [];

  for (const team of teams) {
    const remote = pickRemote(team.logoSource, team.logo);
    if (!remote) {
      // O ya está en local (nada que hacer) o el equipo nunca tuvo escudo.
      if (!team.logo) withoutSource.push(team.name);
      continue;
    }
    crestJobs.push({
      url: remote,
      dir: CRESTS_DIR,
      base: team.id,
      label: `${team.name} (${team.id})`,
    });
  }

  const crestReports = await runPool(crestJobs);
  const crestFailures = summarize(
    `2) Escudos de equipo (${crestJobs.length} de ${teams.length} equipos)`,
    crestReports
  );
  console.log(`     Sin escudo en origen: ${withoutSource.length}`);
  if (withoutSource.length) {
    console.log(`        ${withoutSource.join(", ")}`);
    console.log(`        (se pintan con el círculo de iniciales — no es un fallo)`);
  }

  // ── 3. Re-enlazado en base de datos ─────────────────────────────────────
  //     Solo para los equipos cuyo fichero está realmente en disco, y con la
  //     extensión que tenga: así un fallo de descarga nunca deja un Team.logo
  //     apuntando a un 404.
  const onDisk = new Map<string, string>();
  for (const report of crestReports) {
    if (report.filePath) onDisk.set(report.job.base, report.filePath);
  }

  const relinks: Relink[] = [];

  for (const team of teams) {
    const remote = pickRemote(team.logoSource, team.logo);
    if (!remote) continue;

    const filePath = onDisk.get(team.id);
    if (!filePath) continue;

    const local = localLogoPath(team.id, path.extname(filePath).replace(".", ""));
    if (team.logo === local && team.logoSource === remote) continue;

    relinks.push({ id: team.id, logo: local, logoSource: remote });
  }

  console.log(`\n  3) Re-enlazado en base de datos`);
  console.log(`     Equipos a actualizar : ${relinks.length}`);

  if (dryRun) {
    console.log(`     (dry run: no se ha escrito nada)`);
  } else if (relinks.length > 0) {
    await applyRelinks(relinks);
    console.log(`     ✓ Actualizados`);
  } else {
    console.log(`     ✓ Nada que hacer, ya estaba todo enlazado`);
  }

  // ── 4. Peso en disco ────────────────────────────────────────────────────
  const crests = await dirSize(CRESTS_DIR);
  const emblems = await dirSize(EMBLEMS_DIR);

  console.log(`\n  4) Peso en disco`);
  console.log(`     public/escudos/       ${String(crests.files).padStart(4)} ficheros   ${mb(crests.bytes)}`);
  console.log(`     public/competiciones/ ${String(emblems.files).padStart(4)} ficheros   ${mb(emblems.bytes)}`);
  console.log(`     Total                                    ${mb(crests.bytes + emblems.bytes)}`);

  console.log("\n  " + "─".repeat(74));
  const failures = emblemFailures + crestFailures;
  if (failures === 0) {
    console.log("  ✓ SIN FALLOS\n");
  } else {
    console.log(`  ⚠ ${failures} descargas fallidas (esos equipos siguen apuntando a la URL remota)\n`);
    process.exitCode = 1;
  }

  await prisma.$disconnect();
})();
