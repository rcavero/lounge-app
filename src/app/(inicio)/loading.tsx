import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/shared/components/logo";

/**
 * La portada mientras llegan los eventos: el logo y el título, que no dependen de nada,
 * y una tarjeta vacía por cada evento con la forma de `EventRow`.
 *
 * Vive en el grupo `(inicio)`, que no cambia la URL, para que este skeleton sea solo de
 * la portada. En la raíz de `app/` haría de pantalla de carga de cualquier ruta que no
 * tuviera la suya.
 */
export default function HomeLoading() {
  return (
    <LoadingRegion
      label="Cargando los eventos…"
      data-testid="home-skeleton"
      className="min-h-screen bg-black flex flex-col"
    >
      <Skeleton className="h-10 rounded-none" />

      <header className="py-6 flex justify-center">
        <Logo size="lg" />
      </header>

      <div className="text-center mb-6">
        <p className="text-lg font-medium tracking-widest text-white/90">
          RESERVA TU ASIENTO
        </p>
      </div>

      <main className="flex-1 px-4 pb-8">
        <div className="max-w-md mx-auto space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[#1a1a1a] rounded-2xl px-4 py-4 flex items-center justify-between"
            >
              <div className="flex flex-col items-center w-20 gap-1">
                <Skeleton className="w-14 h-14 rounded-full" />
                <Skeleton className="w-12 h-2.5" />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <Skeleton className="w-20 h-3" />
                <Skeleton className="w-16 h-7" />
                <Skeleton className="w-10 h-3.5 rounded-full" />
              </div>
              <div className="flex flex-col items-center w-20 gap-1">
                <Skeleton className="w-14 h-14 rounded-full" />
                <Skeleton className="w-12 h-2.5" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </LoadingRegion>
  );
}
