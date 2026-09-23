"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { getSession } from "../lib/session";
import { isLoginBlocked, recordFailedLogin, clearLoginAttempts } from "@/lib/rate-limit";

export async function login(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";

  if (isLoginBlocked(ip)) {
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
    recordFailedLogin(ip);
    return { error: "Credenciales incorrectas" };
  }

  const isValidPassword = await bcrypt.compare(password, adminUser.password);

  if (!isValidPassword) {
    recordFailedLogin(ip);
    return { error: "Credenciales incorrectas" };
  }

  clearLoginAttempts(ip);

  const session = await getSession();
  session.isLoggedIn = true;
  session.email = adminUser.email;
  session.adminId = adminUser.id;
  session.role = adminUser.role as "ADMIN" | "WORKER";
  await session.save();

  redirect("/admin");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/admin/login");
}

export async function getSessionData() {
  const session = await getSession();

  // If session has role, return it directly
  if (session.role) {
    return {
      isLoggedIn: session.isLoggedIn ?? false,
      email: session.email ?? "",
      role: session.role,
    };
  }

  // If no role in session but user is logged in, fetch from database
  // This handles sessions created before the role field was added
  if (session.isLoggedIn && session.adminId) {
    const user = await prisma.adminUser.findUnique({
      where: { id: session.adminId },
      select: { role: true },
    });

    if (user) {
      return {
        isLoggedIn: true,
        email: session.email ?? "",
        role: user.role as "ADMIN" | "WORKER",
      };
    }
  }

  return {
    isLoggedIn: session.isLoggedIn ?? false,
    email: session.email ?? "",
    role: "WORKER" as const,
  };
}
