"use server";

import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import type { AdminRole } from "@/modules/auth/types";
import { requireAdmin } from "@/lib/auth-guard";
import { getSessionData } from "@/modules/auth/actions";
import { getSession } from "@/modules/auth/lib/session";
import { passwordFingerprint } from "@/modules/auth/lib/session-data";
import { userPermissions, type UserPermissions } from "../domain/permissions";
import { REAUTH_ERRORS, verifyActorPassword } from "../lib/reauth";
import {
  normalizeEmail,
  normalizeName,
  validateEmail,
  validateName,
  validateNewPassword,
} from "../lib/validation";

/**
 * Usuarios del panel. Todo es del ADMIN (`requireAdmin`), y dentro de eso manda la
 * matriz de `domain/permissions.ts` (P12): otro ADMIN es de solo lectura, y el último
 * ADMIN no se puede bajar de rol ni borrar.
 *
 * Piden además la contraseña del ADMIN conectado (`lib/reauth.ts`): cambiar cualquier
 * contraseña, dar el rol de ADMIN y borrarse a sí mismo.
 *
 * Las reglas de negocio vuelven como `{ success: false, error }`, para enseñarlas en la
 * pantalla. `Forbidden` queda para quien no es ADMIN.
 */

export interface AdminUserData {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  createdAt: Date;
}

export interface ActionResult {
  success: boolean;
  error?: string;
}

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

const HASH_COST = 10;
const FORBIDDEN_OTHER_ADMIN = "No puedes modificar a otro administrador";
const LAST_ADMIN = "Eres el único administrador: crea otro antes de hacer esto";

export async function getAllUsers(): Promise<AdminUserData[]> {
  await requireAdmin();
  return prisma.adminUser.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: "asc" },
  });
}

export async function getUserById(id: string): Promise<AdminUserData | null> {
  await requireAdmin();
  return prisma.adminUser.findUnique({ where: { id }, select: USER_SELECT });
}

/** El ADMIN conectado. Tras `requireAdmin`, siempre hay uno. */
async function currentActor() {
  const session = await getSessionData();
  return { id: session.adminId, role: session.role };
}

async function adminCount(): Promise<number> {
  return prisma.adminUser.count({ where: { role: "ADMIN" } });
}

/** La ficha de un usuario y lo que el ADMIN conectado puede hacer con ella. */
export async function getUserForEdit(
  id: string,
): Promise<{ user: AdminUserData; permissions: UserPermissions } | null> {
  await requireAdmin();
  const user = await prisma.adminUser.findUnique({ where: { id }, select: USER_SELECT });
  if (!user) return null;
  return {
    user,
    permissions: userPermissions(await currentActor(), user, await adminCount()),
  };
}

async function reauthError(actorId: string, password?: string): Promise<string | null> {
  const result = await verifyActorPassword(actorId, password);
  return result === "ok" ? null : REAUTH_ERRORS[result];
}

async function emailTaken(email: string, exceptId?: string): Promise<boolean> {
  const existing = await prisma.adminUser.findFirst({
    where: { email, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  return existing !== null;
}

export interface CreateUserResult extends ActionResult {
  userId?: string;
}

export async function createUser(data: {
  email: string;
  name: string;
  role: AdminRole;
  password: string;
  confirmPassword: string;
  /** Solo para crear un ADMIN: la contraseña del ADMIN conectado. */
  currentPassword?: string;
}): Promise<CreateUserResult> {
  await requireAdmin();
  try {
    const email = normalizeEmail(data.email);
    const name = normalizeName(data.name);
    const invalid =
      validateName(name) ??
      validateEmail(email) ??
      validateNewPassword(data.password, data.confirmPassword);
    if (invalid) return { success: false, error: invalid };

    if (await emailTaken(email)) {
      return { success: false, error: "Ya existe un usuario con este email" };
    }

    if (data.role === "ADMIN") {
      const denied = await reauthError((await currentActor()).id, data.currentPassword);
      if (denied) return { success: false, error: denied };
    }

    const user = await prisma.adminUser.create({
      data: {
        email,
        name,
        role: data.role,
        password: await bcrypt.hash(data.password, HASH_COST),
      },
    });

    return { success: true, userId: user.id };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, error: "Error al crear el usuario" };
  }
}

/** Nombre, email y rol. La contraseña se cambia aparte, con `changeUserPassword`. */
export async function updateUser(
  id: string,
  data: {
    email: string;
    name: string;
    role: AdminRole;
    /** Solo para ascender a ADMIN: la contraseña del ADMIN conectado. */
    currentPassword?: string;
  },
): Promise<ActionResult> {
  await requireAdmin();
  try {
    const target = await prisma.adminUser.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) return { success: false, error: "Usuario no encontrado" };

    const actor = await currentActor();
    const can = userPermissions(actor, target, await adminCount());
    if (!can.canEdit) return { success: false, error: FORBIDDEN_OTHER_ADMIN };

    const email = normalizeEmail(data.email);
    const name = normalizeName(data.name);
    const invalid = validateName(name) ?? validateEmail(email);
    if (invalid) return { success: false, error: invalid };

    if (await emailTaken(email, id)) {
      return { success: false, error: "Ya existe otro usuario con este email" };
    }

    if (data.role !== target.role) {
      // Desde que la sesión se comprueba en cada petición (RCA-286, R1), quitar el rol
      // surte efecto al instante: quitárselo al último ADMIN dejaría el panel sin nadie
      // que pueda gestionar usuarios.
      if (!can.canChangeRole) return { success: false, error: LAST_ADMIN };

      if (data.role === "ADMIN") {
        const denied = await reauthError(actor.id, data.currentPassword);
        if (denied) return { success: false, error: denied };
      }
    }

    await prisma.adminUser.update({
      where: { id },
      data: { email, name, role: data.role },
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating user:", error);
    return { success: false, error: "Error al actualizar el usuario" };
  }
}

/**
 * La contraseña de uno mismo o de un WORKER, nunca la de otro ADMIN. Siempre pide la
 * del ADMIN conectado.
 *
 * Cambiar la de un WORKER le cierra sus sesiones abiertas (R1): es lo que se busca si
 * la contraseña se ha filtrado. Cambiar la propia también cerraría la del ADMIN que la
 * está cambiando, así que en ese caso se renueva su huella en la cookie.
 */
export async function changeUserPassword(
  id: string,
  data: { currentPassword: string; newPassword: string; confirmPassword: string },
): Promise<ActionResult> {
  await requireAdmin();
  try {
    const target = await prisma.adminUser.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) return { success: false, error: "Usuario no encontrado" };

    const actor = await currentActor();
    const can = userPermissions(actor, target, await adminCount());
    if (!can.canChangePassword) {
      return {
        success: false,
        error: "No puedes cambiar la contraseña de otro administrador",
      };
    }

    const invalid = validateNewPassword(data.newPassword, data.confirmPassword);
    if (invalid) return { success: false, error: invalid };

    const denied = await reauthError(actor.id, data.currentPassword);
    if (denied) return { success: false, error: denied };

    const updated = await prisma.adminUser.update({
      where: { id },
      data: { password: await bcrypt.hash(data.newPassword, HASH_COST) },
      select: { password: true },
    });

    if (can.isSelf) {
      const session = await getSession();
      session.pwd = passwordFingerprint(updated.password);
      await session.save();
    }

    return { success: true };
  } catch (error) {
    console.error("Error changing password:", error);
    return { success: false, error: "Error al cambiar la contraseña" };
  }
}

/**
 * Un WORKER, con la confirmación del modal. Uno mismo, con su contraseña y siempre que
 * no sea el último ADMIN; la sesión se cierra en el acto. Otro ADMIN, nunca.
 */
export async function deleteUser(
  id: string,
  data: { currentPassword?: string } = {},
): Promise<ActionResult> {
  await requireAdmin();
  try {
    const target = await prisma.adminUser.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) return { success: false, error: "Usuario no encontrado" };

    const actor = await currentActor();
    const can = userPermissions(actor, target, await adminCount());

    if (can.isSelf && can.isLastAdmin) {
      return {
        success: false,
        error: "Eres el único administrador: crea otro antes de eliminar tu cuenta",
      };
    }
    if (!can.canDelete) return { success: false, error: FORBIDDEN_OTHER_ADMIN };

    if (can.isSelf) {
      const denied = await reauthError(actor.id, data.currentPassword);
      if (denied) return { success: false, error: denied };
    }

    await prisma.adminUser.delete({ where: { id } });

    if (can.isSelf) (await getSession()).destroy();

    return { success: true };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, error: "Error al eliminar el usuario" };
  }
}
