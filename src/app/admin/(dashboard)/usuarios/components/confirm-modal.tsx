"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { ErrorBox } from "./fields";
import { Modal } from "./modal";

/** Confirmación sin contraseña: eliminar a un WORKER. Mismo aspecto que la de eventos. */
export function ConfirmModal({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setError(null);
    setBusy(true);
    const failure = await onConfirm();
    if (failure) {
      setError(failure);
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <div className="text-white/70 text-sm mb-6">{description}</div>
      {error && (
        <div className="mb-4">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}
      <div className="flex gap-3">
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
          type="button"
          data-testid="modal-submit"
          onClick={handleConfirm}
          loading={busy}
          autoFocus
          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
