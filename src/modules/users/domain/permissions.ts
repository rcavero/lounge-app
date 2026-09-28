import type { AdminRole } from "@/modules/auth/types";

/**
 * Qué puede hacer un ADMIN con la ficha de un usuario del panel (P12).
 *
 * Es la única fuente de la regla: la usan la página, para pintar solo lo que se puede
 * hacer, y las server actions, para decidir. Si cada una tuviera su copia, acabarían
 * diciendo cosas distintas, y la que cuenta es la de la acción, que es un endpoint.
 *
 * - **Otro ADMIN es de solo lectura.** Si se le pudiera quitar el rol, se le podría
 *   degradar a WORKER y después cambiarle la contraseña o borrarlo: cualquier regla
 *   sobre admins se saltaría en dos pasos.
 * - **Uno mismo** puede editarse, cambiarse la contraseña, bajarse a WORKER y borrarse,
 *   salvo que sea el último ADMIN: el panel se quedaría sin nadie que gestione usuarios.
 * - **Un WORKER** lo gestiona entero cualquier ADMIN.
 *
 * Qué acciones piden además la contraseña del ADMIN conectado lo deciden las acciones
 * (ver `users/actions`): aquí solo se decide si la acción es posible.
 */
export interface UserRef {
  id: string;
  role: AdminRole;
}

export interface UserPermissions {
  isSelf: boolean;
  /** El usuario es el único ADMIN que queda. */
  isLastAdmin: boolean;
  /** Nombre y email. */
  canEdit: boolean;
  canChangeRole: boolean;
  canChangePassword: boolean;
  canDelete: boolean;
}

export function userPermissions(
  actor: UserRef,
  target: UserRef,
  adminCount: number,
): UserPermissions {
  const isSelf = actor.id === target.id;
  const isLastAdmin = target.role === "ADMIN" && adminCount <= 1;
  const manageable = actor.role === "ADMIN" && (isSelf || target.role === "WORKER");

  return {
    isSelf,
    isLastAdmin,
    canEdit: manageable,
    // Bajarse a WORKER siendo el último ADMIN dejaría el panel sin administradores.
    canChangeRole: manageable && !isLastAdmin,
    canChangePassword: manageable,
    canDelete: manageable && !isLastAdmin,
  };
}
