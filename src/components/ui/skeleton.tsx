import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Un hueco con la forma de lo que va a aparecer. Pulsa solo si el sistema no pide
 * reducir el movimiento (`motion-safe:`). Es decorativo: lo que se anuncia a un lector
 * de pantalla es el `LoadingRegion` que lo envuelve.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("rounded-md bg-white/10 motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}

/**
 * La vista de carga de una pantalla: anuncia «Cargando…» una sola vez a los lectores
 * de pantalla y deja que los `Skeleton` de dentro dibujen la forma de la vista.
 */
function LoadingRegion({
  label = "Cargando…",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={className}
      {...props}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export { LoadingRegion, Skeleton };
