import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";
import { SEED_SEATS } from "./seats";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Teams are synced from the ESPN API (run "Sincronizar equipos" from /admin/eventos/sugerencias)
  // No hardcoded teams — the API is the single source of truth.

  console.log(`ℹ️  Teams are managed via the ESPN API sync. Skipping team creation.`);

  // Note: Demo events are not created here. Use the Suggestions page to create events from API matches.

  // Los nombres y las posiciones de los asientos los fija el local, no este fichero:
  // los códigos se renombraron con scripts/rename-seats.ts y las posiciones se colocan
  // desde /admin/asientos. Re-sembrar aquí devolvería los 47 asientos a las posiciones
  // de prisma/seats.ts, deshaciendo el plano real. Este bloque sólo actúa sobre una
  // base virgen (prisma migrate reset).
  const existingSeats = await prisma.seat.count();

  if (existingSeats > 0) {
    console.log(
      `ℹ️  Ya hay ${existingSeats} asientos. El plano se gestiona desde /admin/asientos y scripts/rename-seats.ts. Se omite la siembra.`,
    );
  } else {
    for (const seat of SEED_SEATS) {
      await prisma.seat.upsert({
        where: { id: seat.id },
        update: {
          posX: seat.posX,
          posY: seat.posY,
        },
        create: seat,
      });
    }

    console.log(`✅ Created ${SEED_SEATS.length} seats`);
  }

  // El primer ADMIN sale del entorno, nunca del código (RCA-275): una contraseña escrita
  // aquí queda en el historial de git para siempre. Sin las dos variables no se crea.
  // `update: {}` a propósito: re-sembrar no cambia la contraseña de una cuenta que ya existe.
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log(
      "ℹ️  Sin SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD no se crea ningún administrador.",
    );
  } else if (adminPassword.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres");
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await prisma.adminUser.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        password: hashedPassword,
        role: "ADMIN",
      },
    });
    console.log(`✅ Administrador ${adminEmail} listo`);
  }

  console.log("🎉 Seeding completed!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
