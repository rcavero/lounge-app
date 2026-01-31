"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSession } from "../lib/session";

export async function login(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios" };
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!adminUser) {
    return { error: "Credenciales incorrectas" };
  }

  const isValidPassword = await bcrypt.compare(password, adminUser.password);

  if (!isValidPassword) {
    return { error: "Credenciales incorrectas" };
  }

  const session = await getSession();
  session.isLoggedIn = true;
  session.email = adminUser.email;
  session.adminId = adminUser.id;
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
  return {
    isLoggedIn: session.isLoggedIn ?? false,
    email: session.email ?? "",
  };
}
