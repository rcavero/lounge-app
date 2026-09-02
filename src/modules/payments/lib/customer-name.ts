/**
 * Normalización y validación del nombre o alias que el cliente escribe antes de pagar.
 *
 * Módulo plano a propósito (sin `"use server"`): lo importa el modal, para dar feedback
 * mientras se escribe, y la server action, que es donde se valida de verdad. Si solo
 * validara el cliente bastaría con llamar a la action desde la consola para saltárselo.
 *
 * Sobre "inyección": ni SQL ni XSS son vectores vivos aquí. Todas las consultas van por
 * Prisma, que parametriza, y React escapa lo que interpola. Lo que sí evita la lista
 * blanca de abajo es que un nombre se lea en el panel distinto de cómo está guardado
 * (marcas bidireccionales, caracteres invisibles) y que el ticket salga ilegible.
 */

export const CUSTOMER_NAME_MIN_LENGTH = 2;

/**
 * 24 caracteres no es una cifra estética: es lo que garantiza que el nombre entra en
 * una sola línea de los 80 mm del ticket PDF.
 */
export const CUSTOMER_NAME_MAX_LENGTH = 24;

/** Placeholder que escribían todas las reservas antes de que se pidiera el nombre. */
export const LEGACY_CUSTOMER_NAME = "Cliente";

// Caracteres de control, marcas de dirección bidireccional y espacios de ancho cero.
// No se ven, pero permiten que un nombre se muestre al revés o se disfrace de otro
// en el listado que consulta la camarera.
const INVISIBLE =
  /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

// Latin-1: es exactamente lo que las fuentes estándar de jsPDF saben pintar. Un nombre
// en cirílico o chino saldría como basura justo en el papel que el cliente enseña.
const ALLOWED = /^[A-Za-z0-9\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF .'-]+$/;

export function normalizeCustomerName(raw: unknown): string {
  if (typeof raw !== "string") return "";

  return raw
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/[\u2018\u2019`\u00B4]/g, "'") // comillas tipográficas -> apóstrofo Latin-1
    .replace(/[\u2013\u2014]/g, "-") // guiones largos -> guion Latin-1
    .replace(/\s+/g, " ")
    .trim();
}

export type CustomerNameError = "length" | "chars";

/** Devuelve el motivo del rechazo, o `null` si el nombre vale. */
export function validateCustomerName(name: string): CustomerNameError | null {
  if (name.length < CUSTOMER_NAME_MIN_LENGTH || name.length > CUSTOMER_NAME_MAX_LENGTH) {
    return "length";
  }
  if (!ALLOWED.test(name)) return "chars";
  return null;
}

/**
 * Las reservas anteriores a esta funcionalidad guardan el literal "Cliente": pintarlo
 * como si fuera un nombre real haría que la camarera buscara a alguien que no existe.
 */
export function displayCustomerName(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? "";
  return !trimmed || trimmed === LEGACY_CUSTOMER_NAME ? "Sin nombre" : trimmed;
}
