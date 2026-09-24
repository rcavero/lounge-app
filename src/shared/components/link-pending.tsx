"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Un spinner pequeño dentro de la tarjeta que se acaba de pulsar, mientras la
 * navegación está en marcha. Va DENTRO de un `<Link>`: `useLinkStatus` lee el enlace que
 * lo contiene.
 *
 * Cubre el hueco que el skeleton no puede cubrir. Si `<Link>` ya ha precargado el
 * destino, el skeleton sale al instante y este indicador ni se llega a ver. Si se pulsa
 * antes de que la precarga termine, lo que hay en pantalla hasta que contesta el
 * servidor es esto.
 *
 * Aparece con un retardo de 150 ms, para no parpadear en las navegaciones que son
 * instantáneas.
 */
export function LinkPendingIndicator({ className }: { className?: string }) {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      data-testid="link-pending"
      data-pending={pending || undefined}
      className={cn(
        "pointer-events-none absolute top-2 right-2 opacity-0 transition-opacity",
        pending && "opacity-100 delay-150",
        className,
      )}
    >
      <Loader2 className="w-4 h-4 text-[#D4AF37] motion-safe:animate-spin" />
    </span>
  );
}

/**
 * La respuesta táctil al pulsar una tarjeta: se hunde un poco. La mayoría de los
 * clientes entran desde el móvil, donde no hay `hover`. Sin movimiento si el sistema
 * lo pide.
 */
export const PRESSABLE = "transition motion-safe:active:scale-[0.98]";
