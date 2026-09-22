import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";
import { SEED_SEATS } from "./seats";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Teams are synced from football-data.org API (run "Sincronizar equipos" from /admin/eventos/sugerencias)
  // No hardcoded teams — the API is the single source of truth.

  console.log(
    `ℹ️  Teams are managed via football-data.org API sync. Skipping team creation.`,
  );

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

  // Create Admin User
  const hashedPassword = await bcrypt.hash("12345678", 12);
  await prisma.adminUser.upsert({
    where: { email: "ramoncaveroaras@gmail.com" },
    update: {},
    create: {
      email: "ramoncaveroaras@gmail.com",
      password: hashedPassword,
    },
  });
  console.log("✅ Created admin user");

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
