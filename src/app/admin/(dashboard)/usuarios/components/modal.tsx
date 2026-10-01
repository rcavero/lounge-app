"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";

import { MODAL_BACKDROP, MODAL_CARD } from "@/shared/components/motion";

/**
 * El marco de los modales de usuarios, con el aspecto del de eliminar un evento: fondo
 * oscuro, tarjeta `#1a1a1a`, título y la X.
 *
 * Además, lo que un modal necesita para usarse con teclado y lector de pantalla:
 * `role="dialog"` con su título, y Escape para cerrar. Mientras la acción está en
 * marcha (`busy`) no se cierra, ni con Escape ni pulsando fuera.
 */
export function Modal({
  title,
  onClose,
  busy,
  children,
}: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div
      className={`fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 ${MODAL_BACKDROP}`}
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="user-modal"
        onClick={(e) => e.stopPropagation()}
        className={`bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full ${MODAL_CARD}`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id={titleId} className="text-white font-semibold text-lg">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
            className="text-white/50 hover:text-white disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
