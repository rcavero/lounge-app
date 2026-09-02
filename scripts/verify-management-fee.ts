#!/usr/bin/env node
/**
 * Verificación de los gastos de gestión.
 *
 *   npx tsx scripts/verify-management-fee.ts precheck  → ANTES de migrar
 *   npx tsx scripts/verify-management-fee.ts report    → DESPUÉS de migrar
 *
 * `precheck` busca reservas que romperían el CHECK de la migración
 * (totalPrice*100 = (seatPriceCents + managementFeeCents) * numberOfSeats).
 * Si devuelve alguna fila, la migración abortaría a mitad: hay que decidir
 * qué hacer con esa reserva antes de aplicarla.
 *
 * `report` comprueba el backfill: eventos a 0 €, reservas históricas con su
 * precio unitario reconstruido y ninguna divergencia entre total y desglose.
 *
 * Solo lee. Recuerda exportar las credenciales del entorno correcto:
 *   set -a && . ./.env.testing && set +a
 */

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

function projectRef(url: string | undefined): string {
  if (!url) return "(DATABASE_URL sin definir)";
  const match = url.match(/postgres\.([a-z0-9]+)/);
  return match ? match[1] : "(ref no reconocido)";
}

async function precheck() {
  const bad = await prisma.$queryRaw<
    Array<{ id: string; numberOfSeats: number; totalPrice: string }>
  >`
    SELECT id, "numberOfSeats", "totalPrice"::text AS "totalPrice"
    FROM "Reservation"
    WHERE "numberOfSeats" <= 0
       OR ("totalPrice" * 100) % "numberOfSeats" <> 0
  `;

  const total = await prisma.reservation.count();
  console.log(`\n  Reservas revisadas : ${total}`);

  if (bad.length === 0) {
    console.log("  ✓ Ninguna reserva rompería el CHECK. Se puede migrar.\n");
    return;
  }

  console.log(`  ✗ ${bad.length} reserva(s) romperían el CHECK:\n`);
  for (const row of bad) {
    console.log(`      ${row.id}  asientos=${row.numberOfSeats}  total=${row.totalPrice}`);
  }
  console.log("");
  process.exitCode = 1;
}

async function report() {
  const [events, eventsSinGastos, reservas, conGastos, divergentes] = await Promise.all([
    prisma.event.count(),
    prisma.event.count({ where: { managementFeeCents: 0 } }),
    prisma.reservation.count(),
    prisma.reservation.count({ where: { managementFeeCents: { gt: 0 } } }),
    prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Reservation"
      WHERE "totalPrice" * 100 <> ("seatPriceCents" + "managementFeeCents") * "numberOfSeats"
    `,
  ]);

  const sinPrecio = await prisma.reservation.count({
    where: { seatPriceCents: 0, numberOfSeats: { gt: 0 } },
  });

  console.log(`\n  Eventos                     : ${events} (${eventsSinGastos} sin gastos de gestión)`);
  console.log(`  Reservas                    : ${reservas} (${conGastos} con gastos de gestión)`);
  console.log(`  Reservas sin precio unitario: ${sinPrecio}`);
  console.log(`  Total ≠ desglose            : ${divergentes.length}`);
  console.log(divergentes.length === 0 && sinPrecio === 0 ? "  ✓ Backfill correcto.\n" : "  ✗ Revisar.\n");

  if (divergentes.length > 0 || sinPrecio > 0) process.exitCode = 1;
}

(async () => {
  const mode = process.argv[2] ?? "precheck";
  console.log(`\n  Proyecto Supabase : ${projectRef(process.env.DATABASE_URL)}`);

  try {
    if (mode === "precheck") await precheck();
    else if (mode === "report") await report();
    else console.log(`\n  Modo desconocido: ${mode}. Usa "precheck" o "report".\n`);
  } catch (error) {
    console.error("\n  Error:", error instanceof Error ? error.message : error, "\n");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
