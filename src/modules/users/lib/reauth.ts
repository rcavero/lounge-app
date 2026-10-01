import bcrypt from "bcryptjs";

import prisma from "@/lib/prisma";
import { clearLoginAttempts, isLoginBlocked, recordFailedLogin } from "@/lib/rate-limit";

/**
 * Pide otra vez la contraseña del ADMIN conectado antes de una acción delicada (P12):
 * cambiar una contraseña, dar el rol de ADMIN o borrarse a sí mismo. Si alguien se deja
 * la sesión abierta, o se la roban, no basta con ella para hacer esas cosas.
 *
 * Tiene el mismo límite que el login, con su propia clave por usuario: 5 fallos y 15
 * minutos de bloqueo. Sin él, una sesión robada serviría para adivinar la contraseña
 * desde el modal sin ningún freno.
 *
 * Módulo plano, no server action: si fuera un endpoint, respondería a cualquiera que
 * preguntara si una contraseña es la buena.
 */
export type ReauthResult = "ok" | "wrong" | "blocked";

export const REAUTH_ERRORS: Record<Exclude<ReauthResult, "ok">, string> = {
  wrong: "Tu contraseña no es correcta",
  blocked: "Demasiados intentos fallidos. Inténtalo de nuevo en 15 minutos.",
};

export async function verifyActorPassword(
  actorId: string,
  password: string | undefined,
): Promise<ReauthResult> {
  const key = `reauth:${actorId}`;
  if (await isLoginBlocked(key)) return "blocked";

  const actor = await prisma.adminUser.findUnique({
    where: { id: actorId },
    select: { password: true },
  });

  if (!actor || !password || !(await bcrypt.compare(password, actor.password))) {
    await recordFailedLogin(key);
    return "wrong";
  }

  await clearLoginAttempts(key);
  return "ok";
}
