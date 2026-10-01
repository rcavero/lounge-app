/**
 * Base de datos del E2E: la misma `lounge_test` de Docker que usa la integración.
 * Nunca Supabase: estos tests crean reservas, bloquean asientos y crean eventos.
 *
 * La puerta `requireDbEnv("test")` va aquí, en el proceso de Playwright, que es el que
 * hace el TRUNCATE. La de que el servidor Next apunta a la misma base la hace
 * `global.setup.ts` con un canario.
 */
import { requireDbEnv } from "../../../scripts/lib/require-db-env";
import { SEED_SEATS } from "../../../prisma/seats";
import { hours, makeAdmin, makeEvent, makeSeats, days } from "../../fixtures/factories";

import { prisma } from "@/lib/prisma";

requireDbEnv("test");

export { prisma };

/**
 * Ids fijos para todo lo sembrado. Dos motivos:
 *
 * - Los usuarios: la cookie de sesión de iron-session guarda el `adminId`. Si cada
 *   resiembra generara uno nuevo, el `storageState` del setup dejaría de corresponder a
 *   ningún usuario.
 * - Los eventos: los specs los localizan por `data-event-id`, sin depender del orden de
 *   la lista ni del título.
 */
export const IDS = {
  admin: "e2e-admin",
  worker: "e2e-worker",
  /** +24 h: dentro de la ventana de reserva. El que se compra. */
  open: "e2e-open",
  /** +25 h: se solapa con `open` (duran 2 h), así que comparte ocupación. */
  overlap: "e2e-overlap",
  /** +72 h: antes de que abra la ventana de 48 h. */
  tooEarly: "e2e-too-early",
  /** +2 h: ya cerrada, faltan menos de 4 h. */
  tooLate: "e2e-too-late",
  /** Hace 3 días, con una reserva confirmada: para el informe mensual. */
  past: "e2e-past",
} as const;

export const ADMIN_EMAIL = "admin@lounge.test";
export const WORKER_EMAIL = "worker@lounge.test";

let truncateAll: string | null = null;

/** Vacía todas las tablas menos la de migraciones. La misma sentencia que `db-each.ts`. */
export async function resetDb(): Promise<void> {
  if (!truncateAll) {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
    `;
    const tables = rows.map((r) => `"${r.tablename}"`).join(", ");
    truncateAll = `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`;
  }
  await prisma.$executeRawUnsafe(truncateAll);
}

/** Dos equipos de La Liga, para dar de alta un partido de fútbol desde el panel. */
export const TEAMS = {
  home: { id: "e2e-team-home", name: "Real Madrid CF", shortName: "Real Madrid" },
  away: { id: "e2e-team-away", name: "FC Barcelona", shortName: "Barcelona" },
} as const;

/**
 * Los 47 asientos reales, los dos roles, dos equipos y cinco eventos con fechas
 * relativas al reloj de verdad. No se puede congelar como en la integración: el reloj
 * que decide si un evento está en ventana es el del servidor Next, que corre en otro
 * proceso.
 *
 * Cada evento lleva sus 47 `SeatStatus`, como los deja `createEvent` al darlo de alta.
 * La página pública los crearía sola si faltaran, pero la de bloqueo de asientos no.
 */
export async function seedBaseline(): Promise<void> {
  await resetDb();

  const now = Date.now();
  const inHours = (n: number) => new Date(now + hours(n));

  await makeAdmin({ id: IDS.admin, role: "ADMIN", email: ADMIN_EMAIL });
  await makeAdmin({ id: IDS.worker, role: "WORKER", email: WORKER_EMAIL });

  await prisma.team.createMany({
    data: Object.values(TEAMS).map((t) => ({ ...t, league: "La Liga" })),
  });

  const seats = await makeSeats(SEED_SEATS.length);

  await makeEvent({
    id: IDS.open,
    title: "Valencia vs Betis",
    homeTeamName: "Valencia",
    awayTeamName: "Betis",
    eventDate: inHours(24),
  });
  await makeEvent({
    id: IDS.overlap,
    title: "Sevilla vs Getafe",
    homeTeamName: "Sevilla",
    awayTeamName: "Getafe",
    eventDate: inHours(25),
  });
  await makeEvent({
    id: IDS.tooEarly,
    title: "Girona vs Osasuna",
    homeTeamName: "Girona",
    awayTeamName: "Osasuna",
    eventDate: inHours(72),
  });
  await makeEvent({
    id: IDS.tooLate,
    title: "Alavés vs Celta",
    homeTeamName: "Alavés",
    awayTeamName: "Celta",
    eventDate: inHours(2),
  });

  // El pasado, además, con una reserva cobrada: es la que sale en el informe mensual.
  const past = await makeEvent({
    id: IDS.past,
    title: "Mallorca vs Elche",
    homeTeamName: "Mallorca",
    awayTeamName: "Elche",
    eventDate: new Date(now - days(3)),
  });

  const eventIds = [IDS.open, IDS.overlap, IDS.tooEarly, IDS.tooLate, IDS.past];
  await prisma.seatStatus.createMany({
    data: eventIds.flatMap((eventId) =>
      seats.map((seat) => ({ eventId, seatId: seat.id })),
    ),
  });
  const pastSeats = seats.slice(0, 2);
  const reservation = await prisma.reservation.create({
    data: {
      eventId: past.id,
      customerName: "Ana",
      customerEmail: "cliente@lounge.com",
      numberOfSeats: 2,
      totalPrice: 23,
      seatPriceCents: 1000,
      managementFeeCents: 150,
      status: "CONFIRMED",
      paymentStatus: "COMPLETED",
      paymentId: "900000000001",
      confirmedAt: new Date(now - days(4)),
    },
  });
  await prisma.seatStatus.updateMany({
    where: { eventId: past.id, seatId: { in: pastSeats.map((s) => s.id) } },
    data: { status: "OCCUPIED", reservationId: reservation.id },
  });
}
