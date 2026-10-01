/**
 * Factories de los tests de integración: crean filas de verdad en `lounge_test`.
 *
 * Todas las fechas cuelgan de `TEST_NOW`, nunca de `Date.now()`. Los tests que ejercitan
 * código que lee el reloj (expirar reservas, el cron, `confirmedAt`) lo congelan en ese
 * mismo instante con `freezeClock()`, así que "hace 6 minutos" significa lo mismo para
 * la factory y para el código bajo prueba.
 *
 * Los defaults son los de un partido corriente: 10 € por asiento, 1,50 € de gastos de
 * gestión, dos horas de duración y mañana a esta hora.
 */

import type {
  AdminRole,
  AdminUser,
  Event,
  Prisma,
  Reservation,
  ReservationStatus,
  Seat,
  SeatStatusType,
} from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

import { SEED_SEATS } from "../../prisma/seats";

/**
 * Miércoles 14 de octubre de 2026, 12:00 en Madrid (10:00 UTC). Un día cualquiera,
 * lejos de los cambios de hora, para que ningún test dependa de uno por accidente.
 */
export const TEST_NOW = new Date("2026-10-14T10:00:00.000Z");

export const minutes = (n: number) => n * 60 * 1000;
export const hours = (n: number) => minutes(n * 60);
export const days = (n: number) => hours(n * 24);

/** `TEST_NOW` desplazado: `at(-minutes(6))` es "hace seis minutos". */
export function at(offsetMs: number): Date {
  return new Date(TEST_NOW.getTime() + offsetMs);
}

/**
 * Los primeros `count` asientos reales del seed. Se usan los del local y no unos
 * inventados para que un fallo muestre el mismo código que vería el bar.
 */
export async function makeSeats(count = 4): Promise<Seat[]> {
  const data = SEED_SEATS.slice(0, count);
  await prisma.seat.createMany({ data });

  const seats = await prisma.seat.findMany({
    where: { id: { in: data.map((s) => s.id) } },
  });
  // En el orden del seed, no en el que devuelva Postgres.
  return data.map((d) => seats.find((s) => s.id === d.id)!);
}

export async function makeEvent(
  overrides: Partial<Prisma.EventUncheckedCreateInput> = {},
): Promise<Event> {
  return prisma.event.create({
    data: {
      title: "Valencia vs Betis",
      eventDate: at(hours(24)),
      pricePerSeat: 10,
      managementFeeCents: 150,
      durationMinutes: 120,
      ...overrides,
    },
  });
}

/**
 * Un `SeatStatus` por asiento, todos `AVAILABLE` salvo los que se indiquen:
 * `makeSeatStatuses(event.id, seats, { [seats[0].id]: "BLOCKED" })`.
 */
export async function makeSeatStatuses(
  eventId: string,
  seats: Seat[],
  statusBySeatId: Record<string, SeatStatusType> = {},
): Promise<void> {
  await prisma.seatStatus.createMany({
    data: seats.map((seat) => ({
      eventId,
      seatId: seat.id,
      status: statusBySeatId[seat.id] ?? "AVAILABLE",
    })),
  });
}

/**
 * `paymentId` únicos de 12 dígitos, con la misma forma que los de `generateOrderId()`.
 * Un contador y no el reloj: con el reloj congelado, dos reservas del mismo test
 * tendrían el mismo pedido.
 */
let orderSeq = 0;
export function nextOrderId(): string {
  orderSeq += 1;
  return String(900_000_000_000 + orderSeq);
}

const SEAT_STATUS_FOR: Record<ReservationStatus, SeatStatusType | null> = {
  PENDING: "RESERVED",
  CONFIRMED: "OCCUPIED",
  // Cancelar y expirar liberan los asientos: ni estado ni vínculo.
  CANCELLED: null,
  EXPIRED: null,
};

interface MakeReservationInput {
  event: Event;
  seats: Seat[];
  status?: ReservationStatus;
  paymentId?: string;
  createdAt?: Date;
  /** La llave de las páginas de vuelta. Sin ella, la reserva es de antes de RCA-285. */
  accessToken?: string | null;
}

/**
 * Una reserva coherente con su evento —desglose congelado del evento y total que cumple
 * el CHECK— y con sus asientos en el estado que le toca: `RESERVED` si está pendiente,
 * `OCCUPIED` si está confirmada, libres si se canceló o expiró.
 *
 * Los `SeatStatus` tienen que existir ya (`makeSeatStatuses`): aquí solo se actualizan,
 * igual que hace `initializePayment`.
 */
export async function makeReservation({
  event,
  seats,
  status = "PENDING",
  paymentId = nextOrderId(),
  createdAt = TEST_NOW,
  accessToken = null,
}: MakeReservationInput): Promise<Reservation> {
  const seatPriceCents = event.pricePerSeat * 100;
  const managementFeeCents = event.managementFeeCents;
  const totalCents = (seatPriceCents + managementFeeCents) * seats.length;

  const reservation = await prisma.reservation.create({
    data: {
      eventId: event.id,
      customerName: "Ana",
      customerEmail: "cliente@lounge.com",
      numberOfSeats: seats.length,
      totalPrice: totalCents / 100,
      seatPriceCents,
      managementFeeCents,
      status,
      paymentStatus:
        status === "CONFIRMED"
          ? "COMPLETED"
          : status === "CANCELLED"
            ? "FAILED"
            : "PENDING",
      paymentId,
      accessToken,
      confirmedAt: status === "CONFIRMED" ? createdAt : null,
      createdAt,
    },
  });

  const seatStatus = SEAT_STATUS_FOR[status];
  if (seatStatus) {
    await prisma.seatStatus.updateMany({
      where: { eventId: event.id, seatId: { in: seats.map((s) => s.id) } },
      data: { status: seatStatus, reservationId: reservation.id },
    });
  }

  return reservation;
}

/**
 * Contraseña de todos los usuarios de test. No protege nada: solo existe en la base de
 * `lounge_test`, que se vacía en cada test.
 */
export const TEST_PASSWORD = "e2e-contrasena-de-usar-y-tirar";

/**
 * `bcrypt.hash(TEST_PASSWORD, 10)`, calculado una vez y fijo. Tiene que ser siempre el
 * mismo: la sesión guarda una huella del hash de la contraseña (RCA-286, R1), y el E2E
 * resiembra los usuarios antes de cada test. Con un hash nuevo en cada resiembra, las
 * sesiones que el setup guardó en `storageState` dejarían de valer.
 * `tests/unit/andamiaje.test.ts` comprueba que corresponde a `TEST_PASSWORD`.
 */
export const TEST_PASSWORD_HASH =
  "$2b$10$UUFK7mm1P94NqTDLbA5QX.t4Ltj5wMcVqGBkv4T60PG/tjknZ5.v.";

interface MakeAdminInput {
  role?: AdminRole;
  email?: string;
  /** Fijo en el E2E: la cookie de sesión guarda el id y tiene que seguir valiendo tras resembrar. */
  id?: string;
}

/**
 * Un usuario del panel con `TEST_PASSWORD`, hasheada igual que la guarda la app
 * (`bcrypt`, coste 10), para que el login de verdad la acepte. El hash es fijo: ver
 * `TEST_PASSWORD_HASH`.
 */
export async function makeAdmin({
  role = "ADMIN",
  email = `${role.toLowerCase()}@lounge.test`,
  id,
}: MakeAdminInput = {}): Promise<AdminUser> {
  return prisma.adminUser.create({
    data: {
      ...(id ? { id } : {}),
      email,
      name: role === "ADMIN" ? "Admin E2E" : "Worker E2E",
      role,
      password: TEST_PASSWORD_HASH,
    },
  });
}

/** Estado y vínculo de cada asiento del evento, indexado por `seatId`. */
export async function seatStatesOf(
  eventId: string,
): Promise<Record<string, { status: SeatStatusType; reservationId: string | null }>> {
  const rows = await prisma.seatStatus.findMany({ where: { eventId } });
  return Object.fromEntries(
    rows.map((r) => [r.seatId, { status: r.status, reservationId: r.reservationId }]),
  );
}
