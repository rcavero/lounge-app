-- Gastos de gestión por asiento: un importe que se cobra junto a la reserva pero que,
-- a diferencia del precio del asiento, NO es descontable en consumiciones.
--
--   Event.managementFeeCents        → lo que se cobrará en las reservas NUEVAS de ese evento
--   Reservation.seatPriceCents      → snapshot del precio unitario realmente cobrado
--   Reservation.managementFeeCents  → snapshot de los gastos unitarios realmente cobrados
--
-- Los dos snapshots de Reservation existen para que editar el evento más tarde no reescriba
-- el desglose de una reserva ya pagada: el ticket y el detalle de admin leen SIEMPRE la
-- reserva, nunca el evento.

-- Los eventos YA creados no cobran gastos: se publicaron sin ellos y su precio no debe
-- cambiar por desplegar esto. Solo los eventos nuevos nacen con 1,50 €, de ahí el
-- ADD COLUMN con DEFAULT 0 seguido del cambio de default.
ALTER TABLE "Event" ADD COLUMN "managementFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Event" ALTER COLUMN "managementFeeCents" SET DEFAULT 150;

-- Reservas históricas: no pagaron gastos de gestión, y su precio unitario se reconstruye
-- desde el total ya cobrado (hasta ahora totalPrice era exactamente asientos × precio).
ALTER TABLE "Reservation" ADD COLUMN "seatPriceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN "managementFeeCents" INTEGER NOT NULL DEFAULT 0;

UPDATE "Reservation"
SET "seatPriceCents" = ROUND("totalPrice" * 100 / "numberOfSeats")::int
WHERE "numberOfSeats" > 0;

-- Se retiran los DEFAULT para que el cliente Prisma exija ambos valores en cada create:
-- una reserva sin desglose deja de ser representable.
ALTER TABLE "Reservation" ALTER COLUMN "seatPriceCents" DROP DEFAULT;
ALTER TABLE "Reservation" ALTER COLUMN "managementFeeCents" DROP DEFAULT;

-- El importe cobrado y su desglose no pueden divergir nunca.
ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_total_matches_breakdown"
  CHECK ("totalPrice" * 100 = ("seatPriceCents" + "managementFeeCents") * "numberOfSeats");
