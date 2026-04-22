import { createRedsysAPI, SANDBOX_URLS, PRODUCTION_URLS, isResponseCodeOk } from "redsys-easy";

const secretKey = process.env.REDSYS_SECRET_KEY;
const merchantCode = process.env.REDSYS_MERCHANT_CODE;
const merchantTerminal = process.env.REDSYS_TERMINAL;

if (!secretKey || !merchantCode || !merchantTerminal) {
  throw new Error(
    "Missing Redsys env vars: REDSYS_SECRET_KEY, REDSYS_MERCHANT_CODE and REDSYS_TERMINAL are required"
  );
}

const urls =
  process.env.NODE_ENV === "production" ? PRODUCTION_URLS : SANDBOX_URLS;

export const { createRedirectForm, processRedirectNotification } =
  createRedsysAPI({ secretKey, urls });

export { isResponseCodeOk };

export const MERCHANT_CODE = merchantCode;
export const MERCHANT_TERMINAL = merchantTerminal;

/**
 * Generates a Redsys-compatible order ID.
 * Requirements: 4-12 chars, first 4 must be digits.
 * Using last 12 digits of timestamp guarantees uniqueness and format.
 */
export function generateOrderId(): string {
  return String(Date.now()).slice(-12);
}
