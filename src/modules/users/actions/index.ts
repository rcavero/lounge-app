"use server";

import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import type { AdminRole } from "@/modules/auth/types";
import { requireAdmin } from "@/lib/auth-guard";

export interface AdminUserData {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  createdAt: Date;
}

export async function getAllUsers(): Promise<AdminUserData[]> {
  await requireAdmin();
  const users = await prisma.adminUser.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return users.map((user) => ({
    ...user,
    role: user.role as AdminRole,
  }));
}

export async function getUserById(id: string): Promise<AdminUserData | null> {
  await requireAdmin();
  const user = await prisma.adminUser.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  return {
    ...user,
    role: user.role as AdminRole,
  };
}

export interface CreateUserResult {
  success: boolean;
  error?: string;
  userId?: string;
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: AdminRole;
}): Promise<CreateUserResult> {
  await requireAdmin();
  try {
    const { email, password, name, role } = data;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: "Email no válido" };
    }

    // Validate password (at least 8 characters)
    if (password.length < 8) {
      return { success: false, error: "La contraseña debe tener al menos 8 caracteres" };
    }

    // Check if email already exists
    const existingUser = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return { success: false, error: "Ya existe un usuario con este email" };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.adminUser.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
        role,
      },
    });

    return { success: true, userId: user.id };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, error: "Error al crear el usuario" };
  }
}

export interface UpdateUserResult {
  success: boolean;
  error?: string;
}

export async function updateUser(
  id: string,
  data: {
    email: string;
    password?: string;
    name: string;
    role: AdminRole;
  },
): Promise<UpdateUserResult> {
  await requireAdmin();
  try {
    const { email, password, name, role } = data;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: "Email no válido" };
    }

    // Check if email already exists for another user
    const existingUser = await prisma.adminUser.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        NOT: { id },
      },
    });

    if (existingUser) {
      return { success: false, error: "Ya existe otro usuario con este email" };
    }

    // Prepare update data
    const updateData: {
      email: string;
      name: string;
      role: "ADMIN" | "WORKER";
      password?: string;
    } = {
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role,
    };

    // Only update password if provided
    if (password && password.length > 0) {
      if (password.length < 8) {
        return {
          success: false,
          error: "La contraseña debe tener al menos 8 caracteres",
        };
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    await prisma.adminUser.update({
      where: { id },
      data: updateData,
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating user:", error);
    return { success: false, error: "Error al actualizar el usuario" };
  }
}

export interface DeleteUserResult {
  success: boolean;
  error?: string;
}

export async function deleteUser(id: string): Promise<DeleteUserResult> {
  await requireAdmin();
  try {
    // Check if user exists
    const user = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!user) {
      return { success: false, error: "Usuario no encontrado" };
    }

    // Delete the user
    await prisma.adminUser.delete({
      where: { id },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, error: "Error al eliminar el usuario" };
  }
}
