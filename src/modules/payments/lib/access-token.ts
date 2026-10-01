import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * La llave de las páginas de vuelta del pago (RCA-285).
 *
 * El nº de pedido sale del reloj y se adivina, así que no puede ser lo único que abra
 * una reserva. Esta llave es aleatoria, se guarda en la reserva y viaja solo en las URL
 * de vuelta que se firman para Redsys: únicamente la tiene quien compró.
 *
 * Módulo plano, sin `"use server"`: exportado desde un fichero de acciones, generar o
 * comparar llaves sería un endpoint público.
 */

/** 16 bytes aleatorios en base64url: 22 caracteres que caben en una URL sin escapar. */
export function newAccessToken(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * ¿Abre `given` una reserva cuya llave es `stored`?
 *
 * Una reserva sin llave es de antes del cambio y se abre sin ella: sus URL ya están
 * repartidas y no se pueden reescribir. La comparación es de tiempo constante, para que
 * cuánto tarda no diga cuántos caracteres se han acertado.
 */
export function accessTokenMatches(
  stored: string | null,
  given: string | null | undefined,
): boolean {
  if (stored === null) return true;
  if (!given) return false;

  const a = Buffer.from(stored);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
