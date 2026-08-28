import { createRedsysAPI, SANDBOX_URLS, PRODUCTION_URLS, isResponseCodeOk } from "redsys-easy";
import { BASE_URL } from "./base-url";

const secretKey = process.env.REDSYS_SECRET_KEY;
const merchantCode = process.env.REDSYS_MERCHANT_CODE;
const merchantTerminal = process.env.REDSYS_TERMINAL;

if (!secretKey || !merchantCode || !merchantTerminal) {
  throw new Error(
    "Missing Redsys env vars: REDSYS_SECRET_KEY, REDSYS_MERCHANT_CODE and REDSYS_TERMINAL are required"
  );
}

const urls =
  process.env.REDSYS_ENV === "production" ? PRODUCTION_URLS : SANDBOX_URLS;

export const { createRedirectForm, processRedirectNotification } =
  createRedsysAPI({ secretKey, urls });

export { isResponseCodeOk };

export const MERCHANT_CODE = merchantCode;
export const MERCHANT_TERMINAL = merchantTerminal;

/**
 * Descripción del producto que se firma en cada pago. Es una constante y no un literal
 * suelto porque el recibo tiene que imprimir exactamente lo que se envió a Redsys.
 */
export const PRODUCT_DESCRIPTION = "Reserva de asientos";

/**
 * Datos del comercio que CaixaBank exige mostrar en un recibo imprimible en la URL OK.
 *
 * Se leen aquí (servidor) y se pasan como prop desde los Server Components: no pueden
 * viajar en `getReservationByOrderId`, que es una server action llamada desde el
 * navegador.
 *
 * `url` sale de BASE_URL, que es la misma que se le da a Redsys como URLOK, así que el
 * recibo y lo que ve el banco no pueden divergir.
 */
export const MERCHANT_INFO = {
  fuc: merchantCode,
  terminal: merchantTerminal,
  name: "The Lounge Beerhouse",
  url: BASE_URL,
  productDescription: PRODUCT_DESCRIPTION,
} as const;

export type MerchantInfo = typeof MERCHANT_INFO;

/**
 * Generates a Redsys-compatible order ID.
 * Requirements: 4-12 chars, first 4 must be digits.
 * Using last 12 digits of timestamp guarantees uniqueness and format.
 */
export function generateOrderId(): string {
  return String(Date.now()).slice(-12);
}
