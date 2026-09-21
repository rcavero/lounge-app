#!/usr/bin/env node
/**
 * Renombrado de los asientos a la nomenclatura real del local.
 *
 * Los 47 códigos originales ("T1-A1", "P-B7"…) venían del seed inicial y nunca se
 * revisaron contra el sitio físico. Como `Seat.code` es exactamente lo que se imprime
 * en el ticket PDF y lo que lee la camarera en la tarjeta de la reserva, cambiarlo aquí
 * corrige las dos pantallas sin tocar una línea de código de la app.
 *
 * De paso renombra las dos apariciones de "PROYECTOR" de cara al público: el cartel del
 * plano (tabla ZoneLabel) y el badge de pantalla de cada evento (Event.screens).
 *
 * Uso:
 *   npx tsx scripts/rename-seats.ts          # report (por defecto): valida y enseña el diff
 *   npx tsx scripts/rename-seats.ts report
 *   npx tsx scripts/rename-seats.ts apply    # escribe, en una única transacción
 *
 * Antes de nada, cargar explícitamente el entorno contra el que quieres trabajar:
 *   set -a && . ./.env.testing && set +a
 * El script imprime siempre en su primera línea contra qué proyecto Supabase va a
 * trabajar: esa es la comprobación que cuenta, no el nombre del fichero que cargaste.
 *
 * Es idempotente: lanzarlo dos veces detecta que ya está aplicado y no hace nada.
 */

import { PrismaClient } from "../src/generated/prisma";
import { requireDbEnv } from "./lib/require-db-env";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// EL LISTADO
//
// [nombre actual, nombre nuevo]. Va versionado en git a propósito: es el registro
// auditable de qué se cambió, cuándo y a partir de qué.
//
// Reglas que se validan más abajo y que vienen del local y del papel del ticket:
//   · máximo 10 caracteres  (80 mm de ticket, 3 códigos por línea)
//   · sólo A-Z a-z 0-9 _ - / .   (sin espacios, acentos ni eñes)
//   · únicos ignorando mayúsculas ("M12" y "m12" son el mismo asiento a ojo)
// ─────────────────────────────────────────────────────────────────────────────
// Listado entregado por la propiedad el 2026-08-27. El orden es el suyo: recorre el
// local mesa por mesa, no sigue el orden de los códigos viejos.
const RENAMES: Array<[string, string]> = [
  ["P-C2", "M1.1"],
  ["P-B1", "M1.2"],
  ["P-B2", "M1.3"],
  ["P-C3", "M1.4"],
  ["P-C4", "M2.1"],
  ["P-B3", "M2.2"],
  ["P-B4", "M2.3"],
  ["P-C5", "M2.4"],
  ["P-D1", "A1"],
  ["P-C1", "A2"],
  ["P-A5", "A3.1"],
  ["P-A4", "A3.2"],
  ["P-B6", "A4.1"],
  ["P-B7", "A4.2"],
  ["P-B8", "A4.3"],
  ["P-A6", "A4.4"],
  ["P-C8", "A4.5"],
  ["P-B5", "A4.6"],
  ["P-C7", "A4.7"],
  ["P-C6", "A4.8"],
  ["P-A2", "A5.1"],
  ["P-A1", "A5.2"],
  ["P-A3", "A6.1"],
  ["P-A7", "A6.2"],
  ["T2-B1", "A7.1"],
  ["T2-A2", "A7.2"],
  ["T2-B3", "A7.3"],
  ["T2-B2", "A7.4"],
  ["T2-B4", "A7.5"],
  ["T2-A3", "A7.6"],
  ["T2-B6", "A7.7"],
  ["T2-B5", "A7.8"],
  ["T2-A1", "M3.1"],
  ["P-A8", "M3.2"],
  ["T2-A4", "A8.1"],
  ["T2-A5", "A8.2"],
  ["T2-A6", "M4.1"],
  ["T1-A5", "M4.2"],
  ["T1-B5", "M5.1"],
  ["T1-A4", "M5.2"],
  ["T1-B4", "M6.1"],
  ["T1-A3", "M6.2"],
  ["T1-B1", "M7.1"],
  ["T1-A1", "M7.2"],
  ["T1-A2", "M7.3"],
  ["T1-B2", "M7.4"],
  ["T1-B3", "M7.5"],
];

/** Renombrado de las etiquetas de zona: cartel del plano y badge de pantalla. */
const ZONE_RENAMES: Array<[string, string]> = [["PROYECTOR", "TV3"]];

const SEAT_CODE_REGEX = /^[A-Za-z0-9_\-/.]+$/;
const SEAT_CODE_MAX_LENGTH = 10;

/** Prefijo de los códigos temporales de la fase 1. Ningún asiento real puede usarlo. */
const TEMP_PREFIX = "__t";

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────

/** Igual que en scripts/db-whoami.ts: identifica el proyecto sin imprimir credenciales. */
function projectRef(url: string | undefined): string {
  if (!url) return "(DATABASE_URL sin definir)";
  const match = url.match(/postgres\.([a-z0-9]+)/);
  return match ? match[1] : "(ref no reconocido)";
}

const lower = (s: string) => s.toLowerCase();

/** Aplica ZONE_RENAMES a un valor de Event.screens ("TV1,PROYECTOR" → "TV1,TV3"). */
function renameScreens(screens: string): string {
  return screens
    .split(",")
    .filter(Boolean)
    .map((token) => {
      const hit = ZONE_RENAMES.find(([from]) => from === token.trim());
      return hit ? hit[1] : token.trim();
    })
    .join(",");
}

// ─────────────────────────────────────────────────────────────────────────────
// Validación del listado (no toca la base de datos)
// ─────────────────────────────────────────────────────────────────────────────

function validateList(): string[] {
  const errors: string[] = [];
  const seenFrom = new Set<string>();
  const seenTo = new Set<string>();

  for (const [from, to] of RENAMES) {
    if (seenFrom.has(from)) errors.push(`Origen repetido en el listado: "${from}"`);
    seenFrom.add(from);

    if (seenTo.has(lower(to)))
      errors.push(`Destino repetido (ignorando mayúsculas): "${to}"`);
    seenTo.add(lower(to));

    if (to.trim().length === 0) {
      errors.push(`"${from}" → nombre vacío`);
      continue;
    }
    if (to !== to.trim()) errors.push(`"${to}" tiene espacios al principio o al final`);
    if (to.length > SEAT_CODE_MAX_LENGTH)
      errors.push(
        `"${to}" tiene ${to.length} caracteres; el máximo es ${SEAT_CODE_MAX_LENGTH} (se saldría del ticket)`
      );
    if (!SEAT_CODE_REGEX.test(to))
      errors.push(`"${to}" usa caracteres no permitidos; sólo se admiten letras, números y _ - / .`);
    if (to.startsWith(TEMP_PREFIX))
      errors.push(`"${to}" empieza por "${TEMP_PREFIX}", que está reservado por este script`);
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado en base de datos
// ─────────────────────────────────────────────────────────────────────────────

type Estado = "PENDIENTE" | "YA_APLICADO" | "INCONSISTENTE" | "SIN_LISTADO";

interface Diagnostico {
  estado: Estado;
  errors: string[];
  pendientes: Array<[string, string]>;
  totalAsientos: number;
  temporalesSueltos: string[];
  zoneLabelsPorRenombrar: Array<[string, string]>;
  eventosPorRenombrar: Array<{ id: string; antes: string; despues: string }>;
}

async function diagnosticar(): Promise<Diagnostico> {
  const errors = [...validateList()];

  const seats = await prisma.seat.findMany({ select: { code: true } });
  const codigos = new Set(seats.map((s) => s.code));
  const codigosLower = new Set(seats.map((s) => lower(s.code)));

  const temporalesSueltos = seats
    .map((s) => s.code)
    .filter((c) => c.startsWith(TEMP_PREFIX));

  // Clasificar cada par: ¿está el origen todavía en la BD, o ya está el destino?
  const pendientes: Array<[string, string]> = [];
  let yaAplicados = 0;

  for (const [from, to] of RENAMES) {
    const origenExiste = codigos.has(from);
    const destinoExiste = codigos.has(to);

    if (origenExiste && from !== to) {
      pendientes.push([from, to]);
      // El destino sólo puede estar ocupado por un asiento que también se renombra.
      if (codigosLower.has(lower(to)) && !RENAMES.some(([f]) => lower(f) === lower(to))) {
        errors.push(
          `"${to}" ya lo usa un asiento que no está en el listado: habría colisión con el índice único`
        );
      }
    } else if (!origenExiste && destinoExiste) {
      yaAplicados++;
    } else if (!origenExiste && !destinoExiste) {
      errors.push(`No existe ningún asiento llamado "${from}" (ni tampoco "${to}")`);
    }
  }

  const zoneLabels = await prisma.zoneLabel.findMany({ select: { zone: true } });
  const zonasExistentes = new Set(zoneLabels.map((z) => z.zone));
  const zoneLabelsPorRenombrar = ZONE_RENAMES.filter(
    ([from, to]) => zonasExistentes.has(from) && !zonasExistentes.has(to)
  );

  const eventos = await prisma.event.findMany({ select: { id: true, screens: true } });
  const eventosPorRenombrar = eventos
    .map((e) => ({ id: e.id, antes: e.screens, despues: renameScreens(e.screens) }))
    .filter((e) => e.antes !== e.despues);

  let estado: Estado;
  if (errors.length > 0) estado = "INCONSISTENTE";
  else if (RENAMES.length === 0) estado = "SIN_LISTADO";
  else if (pendientes.length > 0 && yaAplicados > 0) {
    estado = "INCONSISTENTE";
    errors.push(
      `Listado a medias: ${pendientes.length} pendientes y ${yaAplicados} ya aplicados. Revísalo a mano antes de seguir.`
    );
  } else if (pendientes.length === 0) estado = "YA_APLICADO";
  else estado = "PENDIENTE";

  if (temporalesSueltos.length > 0) {
    estado = "INCONSISTENTE";
    errors.push(
      `Hay ${temporalesSueltos.length} asiento(s) con código temporal (${temporalesSueltos.join(", ")}). Una ejecución anterior se quedó a medias: hay que arreglarlo a mano.`
    );
  }

  return {
    estado,
    errors,
    pendientes,
    totalAsientos: seats.length,
    temporalesSueltos,
    zoneLabelsPorRenombrar,
    eventosPorRenombrar,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Salida
// ─────────────────────────────────────────────────────────────────────────────

function imprimirDiagnostico(d: Diagnostico) {
  console.log(`  Asientos en la base : ${d.totalAsientos}`);
  console.log(`  Listado             : ${RENAMES.length} entradas`);
  console.log(`  Estado              : ${d.estado}\n`);

  if (d.errors.length > 0) {
    console.log(`  ✗ ${d.errors.length} problema(s):\n`);
    d.errors.forEach((e) => console.log(`      · ${e}`));
    console.log("");
  }

  if (d.pendientes.length > 0) {
    console.log(`  Renombrado de asientos (${d.pendientes.length}):\n`);
    const ancho = Math.max(...d.pendientes.map(([f]) => f.length));
    d.pendientes.forEach(([from, to]) =>
      console.log(`      ${from.padEnd(ancho)}  →  ${to}`)
    );
    console.log("");
  }

  if (d.zoneLabelsPorRenombrar.length > 0) {
    console.log(`  Carteles del plano (ZoneLabel):\n`);
    d.zoneLabelsPorRenombrar.forEach(([f, t]) => console.log(`      ${f}  →  ${t}`));
    console.log("");
  } else {
    console.log(`  Carteles del plano  : nada que renombrar\n`);
  }

  if (d.eventosPorRenombrar.length > 0) {
    const resumen = new Map<string, number>();
    d.eventosPorRenombrar.forEach((e) => {
      const clave = `${e.antes}  →  ${e.despues}`;
      resumen.set(clave, (resumen.get(clave) ?? 0) + 1);
    });
    console.log(`  Badges de pantalla (Event.screens), ${d.eventosPorRenombrar.length} eventos:\n`);
    [...resumen.entries()].forEach(([k, n]) => console.log(`      ${k}   (${n})`));
    console.log("");
  } else {
    console.log(`  Badges de pantalla  : nada que renombrar\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Escritura
// ─────────────────────────────────────────────────────────────────────────────

async function aplicar(d: Diagnostico) {
  await prisma.$transaction(
    async (tx) => {
      // Renombrado en DOS FASES.
      //
      // `Seat_code_key` es un índice único no diferible: un renombrado directo
      // revienta con P2002 en cuanto un nombre nuevo coincida con uno viejo que
      // todavía no se ha cambiado (A1 → A2 con A2 aún vivo). Con una permutación
      // no existe ningún orden seguro, así que se pasa por códigos temporales.
      // Las dos fases hacen el renombrado independiente del orden del listado.
      for (let i = 0; i < d.pendientes.length; i++) {
        await tx.seat.update({
          where: { code: d.pendientes[i][0] },
          data: { code: `${TEMP_PREFIX}${i}` },
        });
      }

      for (let i = 0; i < d.pendientes.length; i++) {
        await tx.seat.update({
          where: { code: `${TEMP_PREFIX}${i}` },
          data: { code: d.pendientes[i][1] },
        });
      }

      // Carteles del plano.
      for (const [from, to] of d.zoneLabelsPorRenombrar) {
        await tx.zoneLabel.update({ where: { zone: from }, data: { zone: to } });
      }

      // Badges de pantalla de cada evento.
      for (const evento of d.eventosPorRenombrar) {
        await tx.event.update({
          where: { id: evento.id },
          data: { screens: evento.despues },
        });
      }
    },
    // Son ~2 escrituras por asiento más una por evento: el timeout de 5 s por
    // defecto de las transacciones interactivas se queda corto contra Supabase.
    { timeout: 120_000, maxWait: 20_000 }
  );
}

// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const modo = process.argv[2] ?? "report";

  if (modo !== "report" && modo !== "apply") {
    console.log(`\n  Modo desconocido: "${modo}". Usa "report" o "apply".\n`);
    process.exitCode = 1;
    return;
  }

  // `report` solo lee y puede correr contra lo que sea. `apply` reescribe los nombres
  // de los 47 asientos, que es lo que el cliente ve impreso en su ticket, así que exige
  // que el entorno cargado se haya declarado explícitamente. No restringe a cuál —este
  // renombrado se aplica en los tres—, pero impide lanzarlo con un entorno a ciegas.
  const dbEnv =
    modo === "apply"
      ? requireDbEnv("local", "test", "testing", "academic", "production")
      : ((process.env.DB_ENV ?? "").trim() || "sin declarar");

  console.log(`\n  Entorno (DB_ENV)  : ${dbEnv}`);
  console.log(`  Proyecto Supabase : ${projectRef(process.env.DATABASE_URL)}`);
  console.log(`  Modo              : ${modo}\n`);

  try {
    const d = await diagnosticar();
    imprimirDiagnostico(d);

    if (d.estado === "INCONSISTENTE") {
      console.log("  ✗ No se escribe nada. Corrige los problemas de arriba.\n");
      process.exitCode = 1;
      return;
    }

    if (d.estado === "SIN_LISTADO") {
      console.log(
        "  ⚠️  RENAMES está vacío: no hay ningún asiento que renombrar.\n" +
          "      Rellena el listado en este mismo fichero. El renombrado de carteles\n" +
          "      y badges sí puede aplicarse por su cuenta.\n"
      );
    }

    const hayTrabajo =
      d.pendientes.length > 0 ||
      d.zoneLabelsPorRenombrar.length > 0 ||
      d.eventosPorRenombrar.length > 0;

    if (!hayTrabajo) {
      console.log("  ✓ Todo aplicado. No hay nada que hacer.\n");
      return;
    }

    if (modo === "report") {
      console.log("  ✓ Validación correcta. Nada escrito (modo report).");
      console.log("    Para aplicarlo:  npx tsx scripts/rename-seats.ts apply\n");
      return;
    }

    await aplicar(d);
    console.log(
      `  ✓ Aplicado: ${d.pendientes.length} asiento(s), ` +
        `${d.zoneLabelsPorRenombrar.length} cartel(es), ` +
        `${d.eventosPorRenombrar.length} evento(s).\n`
    );
  } catch (error) {
    console.log(`\n  ✗ Falló: ${error instanceof Error ? error.message : error}`);
    console.log("    La transacción revierte entera: la base de datos queda como estaba.\n");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
