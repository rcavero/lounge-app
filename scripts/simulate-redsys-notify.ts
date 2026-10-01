#!/usr/bin/env node
/**
 * Simula la notificación S2S de Redsys contra el servidor local.
 *
 * ¿Por qué hace falta? El código de autorización y la fecha/hora que imprime el recibo
 * solo llegan dentro de la notificación firmada. En local y en testing esa notificación
 * no llega nunca (Redsys no puede alcanzar localhost, y la página autoconfirma), así que
 * sin este script la tarjeta de recibo no se podría probar hasta el primer pago real en
 * producción — justo lo contrario de validar antes en testing.
 *
 * Uso:
 *   npx tsx scripts/simulate-redsys-notify.ts <orderId> [ok|ko]
 *
 * El orderId son los 12 dígitos de `Reservation.paymentId`; sale en la URL de la
 * pantalla de confirmación.
 *
 * SEGURIDAD: esto falsifica una notificación de pago usando la clave del entorno
 * cargado. Solo apunta a localhost y aborta si REDSYS_ENV=production. No quitar esos
 * dos guardarraíles.
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { signRedsysNotification, toFormBody } from "./lib/redsys-notification";

const TARGET = "http://localhost:3000/api/payments/notify";

async function main() {
  const [orderId, outcome = "ok"] = process.argv.slice(2);

  if (!orderId) {
    console.error("Uso: npx tsx scripts/simulate-redsys-notify.ts <orderId> [ok|ko]");
    process.exit(1);
  }

  if (process.env.REDSYS_ENV === "production") {
    console.error(
      "✗ REDSYS_ENV=production. Este script no se ejecuta contra producción.",
    );
    process.exit(1);
  }

  if (!new URL(TARGET).hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
    console.error("✗ El destino no es localhost.");
    process.exit(1);
  }

  const secretKey = process.env.REDSYS_SECRET_KEY;
  const merchantCode = process.env.REDSYS_MERCHANT_CODE;
  const terminal = process.env.REDSYS_TERMINAL;

  if (!secretKey || !merchantCode || !terminal) {
    console.error("✗ Faltan REDSYS_SECRET_KEY / REDSYS_MERCHANT_CODE / REDSYS_TERMINAL.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const reservation = await prisma.reservation.findFirst({
    where: { paymentId: orderId },
    select: { id: true, totalPrice: true, status: true },
  });
  await prisma.$disconnect();

  if (!reservation) {
    console.error(`✗ No hay ninguna reserva con paymentId=${orderId}.`);
    process.exit(1);
  }

  // Simular un KO sobre una reserva ya confirmada la cancela de verdad y libera sus
  // asientos, y el enlace reserva-asientos no se puede reconstruir. Para probar el
  // recibo casi siempre se quiere "ok"; el "ko" hay que pedirlo a conciencia.
  if (
    outcome === "ko" &&
    reservation.status === "CONFIRMED" &&
    !process.argv.includes("--force")
  ) {
    console.error(
      `✗ La reserva ${reservation.id} está CONFIRMED. Un "ko" la cancelaría y liberaría\n` +
        `  sus asientos de forma irreversible. Añade --force si es lo que quieres.`,
    );
    process.exit(1);
  }

  // El importe se lee de la reserva para que no salte la traza de descuadre del webhook.
  const amountInCents = String(Math.round(Number(reservation.totalPrice) * 100));

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dsDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const dsHour = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const isOk = outcome !== "ko";

  // La firma vive en scripts/lib para que los tests de integración firmen exactamente
  // lo mismo que este script.
  const body = toFormBody(
    signRedsysNotification({
      secretKey,
      merchantCode,
      terminal,
      orderId,
      amountCents: amountInCents,
      ok: isOk,
      date: dsDate,
      hour: dsHour,
    }),
  );

  console.log(`\n  Reserva     : ${reservation.id} (${reservation.status})`);
  console.log(`  Pedido      : ${orderId}`);
  console.log(`  Importe     : ${amountInCents} céntimos`);
  console.log(`  Resultado   : ${isOk ? "autorizada (0000)" : "denegada (0190)"}`);
  console.log(`  Fecha/hora  : ${dsDate} ${dsHour}`);

  const response = await fetch(TARGET, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  console.log(`\n  → ${response.status} ${await response.text()}`);
  console.log("  Recarga la pantalla de confirmación para ver el recibo.\n");
}

main().catch((error) => {
  console.error("\n  ✗", error instanceof Error ? error.message : error, "\n");
  process.exit(1);
});
