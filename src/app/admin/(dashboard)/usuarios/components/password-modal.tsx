"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PASSWORD_MIN_LENGTH, validateNewPassword } from "@/modules/users/lib/validation";

import { ErrorBox, Field, Hint, PasswordInput } from "./fields";
import { Modal } from "./modal";

export interface PasswordModalValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Pide la contraseña del ADMIN conectado antes de una acción delicada (P12). Con
 * `withNewPassword`, pide además la contraseña nueva y su repetición: es el modal de
 * «Cambiar contraseña».
 *
 * `onSubmit` devuelve el error que dé la acción, o `null` si ha ido bien. Con error,
 * el modal sigue abierto y lo enseña; sin él, quien lo abrió decide qué hacer.
 */
export function PasswordModal({
  title,
  description,
  confirmLabel,
  danger,
  withNewPassword,
  onSubmit,
  onClose,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  withNewPassword?: boolean;
  onSubmit: (values: PasswordModalValues) => Promise<string | null>;
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError("Escribe tu contraseña");
      return;
    }
    if (withNewPassword) {
      const invalid = validateNewPassword(newPassword, confirmPassword);
      if (invalid) {
        setError(invalid);
        return;
      }
    }

    setBusy(true);
    const failure = await onSubmit({ currentPassword, newPassword, confirmPassword });
    if (failure) {
      setError(failure);
      setBusy(false);
    }
    // Si ha ido bien, el que abrió el modal lo cierra o navega: aquí no se reactiva
    // el botón (CLAUDE.md, punto 12).
  };

  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-white/70 text-sm">{description}</div>

        <Field id="modal-current-password" label="Tu contraseña">
          <PasswordInput
            id="modal-current-password"
            testId="modal-current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            autoFocus
          />
        </Field>

        {withNewPassword && (
          <>
            <Field
              id="modal-new-password"
              label="Nueva contraseña"
              hint={
                <Hint ok={newPassword.length >= PASSWORD_MIN_LENGTH}>
                  Al menos {PASSWORD_MIN_LENGTH} caracteres
                </Hint>
              }
            >
              <PasswordInput
                id="modal-new-password"
                testId="modal-new-password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
              />
            </Field>
            <Field
              id="modal-confirm-password"
              label="Repite la nueva contraseña"
              hint={
                confirmPassword.length > 0 && (
                  <Hint
                    ok={confirmPassword === newPassword}
                    bad={confirmPassword !== newPassword}
                  >
                    {confirmPassword === newPassword ? "Coinciden" : "No coinciden"}
                  </Hint>
                )
              }
            >
              <PasswordInput
                id="modal-confirm-password"
                testId="modal-confirm-password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />
            </Field>
          </>
        )}

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
            className="flex-1 border-white/20 text-white hover:bg-white/10"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            data-testid="modal-submit"
            loading={busy}
            className={`flex-1 font-semibold ${
              danger
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-[#D4AF37] hover:bg-[#b8972e] text-black"
            }`}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
