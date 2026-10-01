/**
 * Validación de los datos de un usuario del panel (P12).
 *
 * Módulo plano a propósito (sin `"use server"`), como `payments/lib/customer-name.ts`:
 * lo importa el formulario, para avisar mientras se escribe, y la server action, que es
 * donde se valida de verdad. Si solo validara el cliente, bastaría con llamar a la
 * acción desde la consola para saltárselo.
 *
 * Las funciones devuelven el mensaje de error, listo para enseñar, o `null`.
 */

export const PASSWORD_MIN_LENGTH = 8;

/**
 * bcrypt solo mira los primeros 72 bytes y descarta el resto sin avisar: dos
 * contraseñas largas que empiecen igual darían el mismo hash. Son bytes, no
 * caracteres: una «ñ» ocupa dos y un emoji, cuatro.
 */
export const PASSWORD_MAX_BYTES = 72;

export const NAME_MAX_LENGTH = 60;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function validateEmail(email: string): string | null {
  return EMAIL.test(email) ? null : "Email no válido";
}

export function validateName(name: string): string | null {
  if (!name) return "El nombre es obligatorio";
  if (name.length > NAME_MAX_LENGTH) {
    return `El nombre no puede pasar de ${NAME_MAX_LENGTH} caracteres`;
  }
  return null;
}

export function passwordBytes(password: string): number {
  return new TextEncoder().encode(password).length;
}

/** La contraseña nueva y su repetición. */
export function validateNewPassword(
  password: string,
  confirmation: string,
): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`;
  }
  if (passwordBytes(password) > PASSWORD_MAX_BYTES) {
    return "La contraseña es demasiado larga";
  }
  if (password !== confirmation) return "Las contraseñas no coinciden";
  return null;
}
