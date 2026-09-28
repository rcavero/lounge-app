"use client";

import { useState } from "react";
import { KeyRound, Lock, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AdminRole } from "@/modules/auth/types";
import {
  changeUserPassword,
  deleteUser,
  updateUser,
  type AdminUserData,
} from "@/modules/users/actions";
import type { UserPermissions } from "@/modules/users/domain/permissions";
import {
  normalizeEmail,
  normalizeName,
  validateEmail,
  validateName,
} from "@/modules/users/lib/validation";
import { Toast, useToast } from "@/shared/components/toast";

import { ConfirmModal } from "./confirm-modal";
import { ErrorBox, Field, INPUT_CLASS, RoleSelector } from "./fields";
import { PasswordModal } from "./password-modal";

const ROLE_LABEL: Record<AdminRole, string> = { ADMIN: "Admin", WORKER: "Worker" };

const LAST_ADMIN_DELETE =
  "Eres el único administrador: crea otro antes de eliminar tu cuenta";

type OpenModal = "promote" | "password" | "delete-worker" | "delete-self" | null;

/**
 * La ficha de un usuario en tres bloques: datos, contraseña y eliminar (P12). Cada
 * bloque aparece solo si `permissions` lo permite; la server action lo vuelve a
 * comprobar con la misma función (`users/domain/permissions.ts`).
 */
export function EditUser({
  user,
  permissions,
}: {
  user: AdminUserData;
  permissions: UserPermissions;
}) {
  const toast = useToast();
  const [modal, setModal] = useState<OpenModal>(null);
  const closeModal = () => setModal(null);

  const displayName = user.name || user.email;

  const askDeleteSelf = () => {
    // El último ADMIN ve el botón, y al pulsarlo se le explica por qué no puede.
    if (permissions.isLastAdmin) toast.show(LAST_ADMIN_DELETE, "error");
    else setModal("delete-self");
  };

  return (
    <div className="space-y-4">
      {permissions.canEdit ? (
        <DataForm
          user={user}
          permissions={permissions}
          onPromote={() => setModal("promote")}
          promoteModalOpen={modal === "promote"}
          closeModal={closeModal}
        />
      ) : (
        <ReadOnly user={user} />
      )}

      {permissions.canChangePassword && (
        <Section
          title="Contraseña"
          subtitle={
            permissions.isSelf
              ? "Para cambiarla, confirma la actual. Seguirás con la sesión abierta."
              : `Al cambiarla se cierran las sesiones que ${displayName} tenga abiertas.`
          }
        >
          <Button
            type="button"
            variant="outline"
            data-testid="user-change-password"
            onClick={() => setModal("password")}
            className="w-full border-white/20 text-white hover:bg-white/10 font-semibold py-3"
          >
            <KeyRound className="w-4 h-4 mr-2" />
            Cambiar contraseña
          </Button>
        </Section>
      )}

      {permissions.isSelf ? (
        <Section title="Eliminar mi cuenta" subtitle="Se cierra tu sesión al momento.">
          <Button
            type="button"
            variant="outline"
            data-testid="user-delete"
            onClick={askDeleteSelf}
            className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-semibold py-3"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Eliminar mi cuenta
          </Button>
        </Section>
      ) : (
        permissions.canDelete && (
          <Section title="Eliminar usuario" subtitle="No se puede deshacer.">
            <Button
              type="button"
              variant="outline"
              data-testid="user-delete"
              onClick={() => setModal("delete-worker")}
              className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-semibold py-3"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar usuario
            </Button>
          </Section>
        )
      )}

      {modal === "password" && (
        <PasswordModal
          title="Cambiar contraseña"
          description={
            permissions.isSelf ? (
              "Escribe tu contraseña actual y la nueva."
            ) : (
              <>
                Vas a cambiar la contraseña de{" "}
                <span className="text-white font-medium">{displayName}</span>. Confirma
                primero la tuya.
              </>
            )
          }
          confirmLabel="Cambiar contraseña"
          withNewPassword
          onSubmit={async (values) => {
            const result = await changeUserPassword(user.id, values);
            if (!result.success) return result.error ?? "Error al cambiar la contraseña";
            closeModal();
            toast.show("Contraseña cambiada");
            return null;
          }}
          onClose={closeModal}
        />
      )}

      {modal === "delete-worker" && (
        <ConfirmModal
          title="Eliminar usuario"
          description={
            <>
              ¿Seguro que quieres eliminar a{" "}
              <span className="text-white font-medium">{displayName}</span>? Perderá el
              acceso al panel al momento, y no se puede deshacer.
            </>
          }
          confirmLabel="Eliminar"
          onConfirm={async () => {
            const result = await deleteUser(user.id);
            if (!result.success) return result.error ?? "Error al eliminar el usuario";
            window.location.href = "/admin/usuarios?aviso=eliminado";
            return null;
          }}
          onClose={closeModal}
        />
      )}

      {modal === "delete-self" && (
        <PasswordModal
          title="Eliminar mi cuenta"
          description="Perderás el acceso al panel al momento, y no se puede deshacer. Para confirmarlo, escribe tu contraseña."
          confirmLabel="Eliminar mi cuenta"
          danger
          onSubmit={async ({ currentPassword }) => {
            const result = await deleteUser(user.id, { currentPassword });
            if (!result.success) return result.error ?? "Error al eliminar la cuenta";
            window.location.href = "/admin/login";
            return null;
          }}
          onClose={closeModal}
        />
      )}

      <Toast message={toast.message} onClose={toast.close} />
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[#1a1a1a]/60 border border-white/10 rounded-2xl p-4 space-y-3">
      <div>
        <h2 className="text-white font-semibold text-sm">{title}</h2>
        <p className="text-white/50 text-xs">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ReadOnly({ user }: { user: AdminUserData }) {
  return (
    <Section
      title="Datos"
      subtitle="Es otro administrador: solo él puede cambiar sus datos."
    >
      <div data-testid="user-readonly" className="space-y-3">
        <div className="flex items-center gap-2 text-white/60 text-xs">
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          Solo lectura
        </div>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-white/50 text-xs">Nombre</dt>
            <dd className="text-white">{user.name || "Sin nombre"}</dd>
          </div>
          <div>
            <dt className="text-white/50 text-xs">Email</dt>
            <dd className="text-white break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-white/50 text-xs">Rol</dt>
            <dd className="text-white">{ROLE_LABEL[user.role]}</dd>
          </div>
        </dl>
      </div>
    </Section>
  );
}

function DataForm({
  user,
  permissions,
  onPromote,
  promoteModalOpen,
  closeModal,
}: {
  user: AdminUserData;
  permissions: UserPermissions;
  onPromote: () => void;
  promoteModalOpen: boolean;
  closeModal: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<AdminRole>(user.role);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const promoting = user.role === "WORKER" && role === "ADMIN";
  const demotingSelf = permissions.isSelf && user.role === "ADMIN" && role === "WORKER";

  /** Llama a la acción. Devuelve el error, o recarga la ficha si ha ido bien. */
  const save = async (currentPassword?: string): Promise<string | null> => {
    const result = await updateUser(user.id, { name, email, role, currentPassword });
    if (!result.success) return result.error ?? "Error al guardar los cambios";
    // Recargar, y no solo avisar: el rol cambia lo que se puede hacer con la ficha (un
    // WORKER ascendido pasa a ser de solo lectura), y quien se baja a WORKER ya no
    // puede estar aquí.
    window.location.href = demotingSelf
      ? "/admin"
      : `/admin/usuarios/${user.id}?aviso=guardado`;
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const invalid =
      validateName(normalizeName(name)) ?? validateEmail(normalizeEmail(email));
    if (invalid) {
      setError(invalid);
      return;
    }
    if (promoting) {
      onPromote();
      return;
    }

    setSaving(true);
    const failure = await save();
    if (failure) {
      setError(failure);
      setSaving(false);
    }
  };

  return (
    <Section title="Datos" subtitle="Nombre, email y rol.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field id="name" label="Nombre">
          <input
            id="name"
            data-testid="user-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </Field>

        <Field id="email" label="Email (con él inicia sesión)">
          <input
            id="email"
            data-testid="user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </Field>

        <div className="space-y-2">
          <p className="text-white/70 text-xs font-medium">Rol</p>
          <RoleSelector
            value={role}
            onChange={setRole}
            disabled={!permissions.canChangeRole}
          />
          {!permissions.canChangeRole && (
            <p className="text-white/40 text-xs">
              Eres el único administrador: no puedes dejar de serlo.
            </p>
          )}
          {demotingSelf && (
            <p className="text-amber-400 text-xs">
              Al guardar dejarás de ser administrador y perderás el acceso a esta sección.
            </p>
          )}
          {promoting && (
            <p className="text-white/50 text-xs">
              Para dar el rol de administrador te pediremos tu contraseña.
            </p>
          )}
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        <Button
          type="submit"
          data-testid="user-submit"
          loading={saving}
          className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold py-3"
        >
          {!saving && <Save className="w-4 h-4 mr-2" />}
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </form>

      {promoteModalOpen && (
        <PasswordModal
          title="Dar el rol de administrador"
          description={
            <>
              <span className="text-white font-medium">{user.name || user.email}</span>{" "}
              podrá gestionar todo el panel, usuarios incluidos. Para confirmarlo, escribe
              tu contraseña.
            </>
          }
          confirmLabel="Hacer administrador"
          onSubmit={({ currentPassword }) => save(currentPassword)}
          onClose={closeModal}
        />
      )}
    </Section>
  );
}
