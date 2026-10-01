import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

/**
 * Lo que se ve al pulsar un evento, mientras el servidor prepara los asientos.
 *
 * En producción `<Link>` precarga este límite, así que aparece en cuanto se pulsa, sin
 * esperar al servidor. Imita la vista de destino para que nada salte al llegar: la
 * misma cabecera, y el plano del local, que es una imagen estática y ya se puede
 * pintar, atenuado y con el pulso encima mientras llegan los asientos.
 *
 * La flecha de volver es un enlace de verdad: quien se ha equivocado de partido no
 * tiene que esperar a que cargue para irse.
 */
export default function EventLoading() {
  return (
    <LoadingRegion
      label="Cargando los asientos…"
      data-testid="event-skeleton"
      className="min-h-screen bg-black flex flex-col"
    >
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Volver"
              className="text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-1">
              <Skeleton className="w-9 h-9 rounded-full" />
              <span className="text-white/30 text-xs font-bold">vs</span>
              <Skeleton className="w-9 h-9 rounded-full" />
            </div>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
            <Skeleton className="w-6 h-6 rounded-full" />
            <Skeleton className="w-24 h-3" />
          </div>
          <Skeleton className="w-24 h-8" />
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        <div className="max-w-md mx-auto">
          <div className="relative w-full aspect-[464/800] rounded-xl overflow-hidden bg-black">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: "url('/images/floor-plan.png')",
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
            <Skeleton className="absolute inset-0 rounded-none bg-white/5" />
          </div>
        </div>
      </main>

      <footer className="py-4 text-center border-t border-white/10">
        <p className="text-xs text-white/40 tracking-wider">
          THE LOUNGE BEERHOUSE • VALENCIA
        </p>
      </footer>
    </LoadingRegion>
  );
}
