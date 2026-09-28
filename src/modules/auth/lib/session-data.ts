import { createHash } from "node:crypto";
import { cache } from "react";

import prisma from "@/lib/prisma";

import type { AdminRole } from "../types";
import { getSession } from "./session";

/** Lo que el panel sabe de quién está conectado. */
export interface SessionView {
  isLoggedIn: boolean;
  email: string;
  role: AdminRole;
  /** Vacío si no hay sesión. */
  adminId: string;
}

const LOGGED_OUT: SessionView = {
  isLoggedIn: false,
  email: "",
  role: "WORKER",
  adminId: "",
};

/**
 * Huella del hash de la contraseña que se guarda en la cookie al entrar. Si la
 * contraseña cambia, el hash cambia y la huella deja de coincidir: la sesión cae.
 * La cookie va cifrada por iron-session, y aun así solo lleva 16 caracteres de un
 * SHA-256 del hash, no el hash.
 */
export function passwordFingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

/**
 * La sesión, comprobada contra la base en cada petición (RCA-286, R1).
 *
 * Antes la cookie era la verdad durante sus 7 días: borrar a un usuario, quitarle el
 * rol de ADMIN o cambiarle la contraseña no le afectaba hasta que caducaba. Ahora:
 *
 * - si el usuario ya no existe, no hay sesión;
 * - si la huella de la contraseña no coincide, no hay sesión;
 * - el rol y el email se leen siempre de la base, nunca de la cookie.
 *
 * Una cookie sin huella (anterior a este cambio) tampoco vale: hay que volver a entrar
 * una vez. Lo que NO cubre: cerrar sesión no invalida una copia robada de la cookie.
 *
 * `cache` de React: una sola consulta por petición, aunque la llamen el layout, la
 * página y cada guardia.
 */
export const readSessionData = cache(async (): Promise<SessionView> => {
  const session = await getSession();
  if (!session.isLoggedIn || !session.adminId || !session.pwd) return LOGGED_OUT;

  const user = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    select: { id: true, email: true, role: true, password: true },
  });
  if (!user || passwordFingerprint(user.password) !== session.pwd) return LOGGED_OUT;

  return { isLoggedIn: true, email: user.email, role: user.role, adminId: user.id };
});
