"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { getSession } from "../lib/session";
import { passwordFingerprint, readSessionData } from "../lib/session-data";
import { isLoginBlocked, recordFailedLogin, clearLoginAttempts } from "@/lib/rate-limit";

/**
 * Hash bcrypt de una cadena aleatoria que se desechó, con el coste 10 de `createUser`.
 * Solo sirve para que un email inexistente cueste lo mismo que uno bueno. No es secreto.
 */
const DUMMY_HASH = "$2b$10$Qhwsipkdws3plNPE0h6jpuI6PSs0AYIvE8vSXjRxtrqkrfhwiRImK";

export async function login(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";

  if (await isLoginBlocked(ip)) {
    return { error: "Demasiados intentos fallidos. Inténtalo de nuevo en 15 minutos." };
  }

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios" };
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!adminUser) {
    // Se calcula bcrypt igualmente: si no, la respuesta tarda menos cuando el email no
    // existe, y midiendo tiempos se sabría qué emails son del personal (RCA-286, R6).
    await bcrypt.compare(password, DUMMY_HASH);
    await recordFailedLogin(ip);
    return { error: "Credenciales incorrectas" };
  }

  const isValidPassword = await bcrypt.compare(password, adminUser.password);

  if (!isValidPassword) {
    await recordFailedLogin(ip);
    return { error: "Credenciales incorrectas" };
  }

  await clearLoginAttempts(ip);

  const session = await getSession();
  session.isLoggedIn = true;
  session.email = adminUser.email;
  session.adminId = adminUser.id;
  session.role = adminUser.role as "ADMIN" | "WORKER";
  session.pwd = passwordFingerprint(adminUser.password);
  await session.save();

  redirect("/admin");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/admin/login");
}

/**
 * Quién está conectado, comprobado contra la base: ver `readSessionData`. Sigue aquí,
 * con este nombre, porque es la entrada que usan las páginas y `lib/auth-guard`.
 */
export async function getSessionData() {
  return readSessionData();
}
