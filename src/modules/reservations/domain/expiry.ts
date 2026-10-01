/**
 * Cuánto vive cada cosa: una reserva pendiente de pago y un evento ya jugado.
 *
 * Antes estas cifras estaban escritas a mano en `seating/actions` y en el cron de
 * limpieza, y en el cron la de las reservas vivía en una variable llamada
 * `thirtyMinutesAgo` que calculaba 5 minutos. Aquí tienen nombre y un único sitio.
 *
 * Módulo plano, sin `"use server"` ni Prisma. El reloj entra como parámetro para poder
 * probarlo sin congelar el tiempo.
 */

/**
 * Una reserva PENDING caduca a los 5 minutos y suelta sus asientos. Es lo que tarda,
 * como mucho, un cliente normal en la pasarela; si tarda más, ver RCA-276.
 */
export const PENDING_RESERVATION_TTL_MS = 5 * 60 * 1000;

/** Los eventos se borran —con sus reservas y estados— 90 días después de jugarse. */
export const EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** Las reservas PENDING creadas ANTES de este instante (estricto) están caducadas. */
export function pendingExpiryCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - PENDING_RESERVATION_TTL_MS);
}

/** Los eventos con fecha ANTERIOR a este instante (estricto) se borran. */
export function eventRetentionCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - EVENT_RETENTION_MS);
}
