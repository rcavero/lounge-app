"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

import { ENTER } from "./motion";

/**
 * Aviso breve de que una acción ha ido bien o mal (P12). Hecho a mano, sin librería: la
 * app solo lo necesita en unos pocos sitios y con esto basta.
 *
 * - Fijo abajo en el centro, encima de todo, con los colores del panel.
 * - `role="status"` y `aria-live`: un lector de pantalla lo anuncia sin robar el foco.
 * - Se cierra solo a los 4 s, o con la X.
 *
 * Los errores de validación no van aquí: se quedan junto al formulario, donde se
 * corrigen, como en eventos.
 */
export type ToastTone = "success" | "error";

export interface ToastMessage {
  text: string;
  tone: ToastTone;
}

export const TOAST_DURATION_MS = 4000;

const TONES: Record<ToastTone, { box: string; Icon: typeof CheckCircle2 }> = {
  success: {
    box: "border-green-500/40 text-green-300",
    Icon: CheckCircle2,
  },
  error: {
    box: "border-red-500/40 text-red-300",
    Icon: AlertCircle,
  },
};

export function Toast({
  message,
  onClose,
}: {
  message: ToastMessage | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;
  const { box, Icon } = TONES[message.tone];

  return (
    <div className="fixed inset-x-0 bottom-6 z-[300] flex justify-center px-4 pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        data-testid="toast"
        data-tone={message.tone}
        className={`pointer-events-auto flex items-center gap-3 max-w-sm w-full bg-[#1a1a1a] border rounded-xl px-4 py-3 shadow-lg shadow-black/50 ${box} ${ENTER}`}
      >
        <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
        <p className="flex-1 text-sm text-white">{message.text}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar aviso"
          className="text-white/50 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/** Estado de un toast en una pantalla: `show` lo abre, y el propio toast lo cierra. */
export function useToast() {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  // Estables: el temporizador del toast depende de `close`, y una función nueva en cada
  // render lo reiniciaría cada vez.
  const show = useCallback(
    (text: string, tone: ToastTone = "success") => setMessage({ text, tone }),
    [],
  );
  const close = useCallback(() => setMessage(null), []);
  return { message, show, close };
}

/**
 * El aviso de una acción que termina navegando a otra página (crear un usuario, borrarlo):
 * la página de destino recibe `?aviso=<código>` y lo traduce con `messages`. Después
 * quita el parámetro de la URL, para que al recargar no vuelva a salir.
 *
 * El mensaje se lee al montar: se llega aquí con `window.location.href` (CLAUDE.md,
 * punto 4), que carga la página entera.
 */
export function FlashToast({ messages }: { messages: Record<string, string> }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const code = params.get("aviso");
  const [message, setMessage] = useState<ToastMessage | null>(() => {
    const text = code ? messages[code] : undefined;
    return text ? { text, tone: "success" } : null;
  });
  const close = useCallback(() => setMessage(null), []);
  // Se limpia una sola vez, aunque el efecto vuelva a correr antes de que
  // `router.replace` haya quitado el parámetro.
  const cleaned = useRef(false);

  useEffect(() => {
    if (!code || cleaned.current) return;
    cleaned.current = true;
    router.replace(pathname, { scroll: false });
  }, [code, pathname, router]);

  return <Toast message={message} onClose={close} />;
}
