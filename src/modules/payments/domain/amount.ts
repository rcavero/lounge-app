/**
 * Cuánto se cobra por una reserva. 💰
 *
 * Es la fórmula del dinero, y antes había tres copias: en `initializePayment` (lo que se
 * cobra), en `createReservation` (ya borrada) y en el store del cliente (lo que el
 * cliente ve antes de pagar). Ahora el servidor y el cliente llaman a la misma función y
 * no pueden divergir.
 *
 * Todo en **céntimos enteros**: Redsys exige el importe como entero de céntimos, y así el
 * desglose que se congela en la reserva no depende de ninguna división. La base de datos
 * lo remata con un CHECK: `totalPrice * 100 = (seatPriceCents + managementFeeCents) *
 * numberOfSeats`.
 *
 * Módulo plano, sin `"use server"` ni Prisma: lo importa también el navegador.
 */

export interface PricedEvent {
  /** Euros enteros por asiento. */
  pricePerSeat: number;
  /** Gastos de gestión por asiento, en céntimos. */
  managementFeeCents: number;
}

export interface ReservationAmount {
  seatPriceCents: number;
  managementFeeCents: number;
  totalCents: number;
  /** En euros, para la columna `Reservation.totalPrice` (Decimal). */
  totalPrice: number;
}

export function computeReservationAmount(
  event: PricedEvent,
  seatCount: number,
): ReservationAmount {
  const seatPriceCents = event.pricePerSeat * 100;
  const managementFeeCents = event.managementFeeCents;
  const totalCents = (seatPriceCents + managementFeeCents) * seatCount;
  const totalPrice = totalCents / 100;
  return { seatPriceCents, managementFeeCents, totalCents, totalPrice };
}

/**
 * Los céntimos que corresponden a un `totalPrice` guardado. El webhook los compara con
 * el importe que firma Redsys y, si no cuadran, deja una traza `IMPORTE DISCREPANTE`.
 *
 * `Math.round` y no un truncado: `19.99 * 100` en coma flotante es `1998.9999…`.
 */
export function expectedCentsFromTotalPrice(totalPrice: number): number {
  return Math.round(totalPrice * 100);
}

/** `DS_MERCHANT_AMOUNT`: los céntimos como cadena, sin separadores. */
export function toRedsysAmount(totalCents: number): string {
  return String(totalCents);
}
