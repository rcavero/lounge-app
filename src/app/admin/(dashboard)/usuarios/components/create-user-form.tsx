"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AdminRole } from "@/modules/auth/types";
import { createUser } from "@/modules/users/actions";
import {
  PASSWORD_MIN_LENGTH,
  normalizeEmail,
  normalizeName,
  validateEmail,
  validateName,
  validateNewPassword,
} from "@/modules/users/lib/validation";

import {
  ErrorBox,
  Field,
  Hint,
  INPUT_CLASS,
  PasswordInput,
  RoleSelector,
} from "./fields";
import { PasswordModal } from "./password-modal";

/**
 * Alta de un usuario del panel. La contraseña se escribe dos veces. Crear un ADMIN pide
 * además la contraseña del ADMIN conectado, en un modal (P12). La acción vuelve a
 * validarlo todo: esto es solo para avisar antes.
 */
export function CreateUserForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("WORKER");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [askPassword, setAskPassword] = useState(false);

  /** Llama a la acción. Devuelve el error, o navega al listado si ha ido bien. */
  const save = async (currentPassword?: string): Promise<string | null> => {
    const result = await createUser({
      name,
      email,
      role,
      password,
      confirmPassword,
      currentPassword,
    });
    if (!result.success) return result.error ?? "Error al crear el usuario";
    window.location.href = "/admin/usuarios?aviso=creado";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const invalid =
      validateName(normalizeName(name)) ??
      validateEmail(normalizeEmail(email)) ??
      validateNewPassword(password, confirmPassword);
    if (invalid) {
      setError(invalid);
      return;
    }

    if (role === "ADMIN") {
      setAskPassword(true);
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
    <>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Field id="name" label="Nombre">
          <input
            id="name"
            data-testid="user-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            placeholder="Nombre del usuario"
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
            placeholder="usuario@ejemplo.com"
            className={INPUT_CLASS}
          />
        </Field>

        <div className="space-y-2">
          <p className="text-white/70 text-xs font-medium">Rol</p>
          <RoleSelector value={role} onChange={setRole} />
        </div>

        <Field
          id="password"
          label="Contraseña"
          hint={
            <Hint ok={password.length >= PASSWORD_MIN_LENGTH}>
              Al menos {PASSWORD_MIN_LENGTH} caracteres
            </Hint>
          }
        >
          <PasswordInput
            id="password"
            testId="user-password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
        </Field>

        <Field
          id="confirm-password"
          label="Repite la contraseña"
          hint={
            confirmPassword.length > 0 && (
              <Hint ok={confirmPassword === password} bad={confirmPassword !== password}>
                {confirmPassword === password ? "Coinciden" : "No coinciden"}
              </Hint>
            )
          }
        >
          <PasswordInput
            id="confirm-password"
            testId="user-password-confirm"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <Button
          type="submit"
          data-testid="user-submit"
          loading={saving}
          className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold py-3"
        >
          {!saving && <UserPlus className="w-4 h-4 mr-2" />}
          {saving ? "Creando..." : "Crear usuario"}
        </Button>
      </form>

      {askPassword && (
        <PasswordModal
          title="Crear un administrador"
          description={
            <>
              Un administrador puede gestionar todo el panel, usuarios incluidos. Para
              crearlo, confirma que eres tú.
            </>
          }
          confirmLabel="Crear administrador"
          onSubmit={({ currentPassword }) => save(currentPassword)}
          onClose={() => setAskPassword(false)}
        />
      )}
    </>
  );
}
