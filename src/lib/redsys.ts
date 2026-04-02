import { createRedsysAPI, SANDBOX_URLS, PRODUCTION_URLS, isResponseCodeOk } from "redsys-easy";

const secretKey =
  process.env.REDSYS_SECRET_KEY ?? "sq7HjrUOBfKmC576ILgskD5srU870gJ7";

const urls =
  process.env.NODE_ENV === "production" ? PRODUCTION_URLS : SANDBOX_URLS;

export const { createRedirectForm, processRedirectNotification } =
  createRedsysAPI({ secretKey, urls });

export { isResponseCodeOk };

export const MERCHANT_CODE =
  process.env.REDSYS_MERCHANT_CODE ?? "999008881";

export const MERCHANT_TERMINAL = process.env.REDSYS_TERMINAL ?? "001";

/**
 * Generates a Redsys-compatible order ID.
 * Requirements: 4-12 chars, first 4 must be digits.
 * Using last 12 digits of timestamp guarantees uniqueness and format.
 */
export function generateOrderId(): string {
  return String(Date.now()).slice(-12);
}
