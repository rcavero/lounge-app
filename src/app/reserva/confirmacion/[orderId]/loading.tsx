import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

/**
 * Lo que se ve al volver de la pasarela, mientras el servidor lee la reserva. Tiene la
 * forma del ticket, que es lo que aparece casi siempre; si la reserva sigue pendiente
 * del banco, después sale el «Procesando tu pago» de siempre.
 */
export default function ConfirmationLoading() {
  return (
    <LoadingRegion
      label="Cargando tu reserva…"
      data-testid="confirmation-skeleton"
      className="min-h-screen bg-black flex flex-col items-center px-4 py-12"
    >
      <div className="max-w-sm w-full space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="w-16 h-16 rounded-full" />
          <Skeleton className="w-56 h-7" />
          <Skeleton className="w-64 h-4" />
        </div>

        <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="w-20 h-4" />
            <Skeleton className="w-12 h-12 rounded-full" />
          </div>
          <Skeleton className="w-40 h-4 mx-auto" />
          <div className="space-y-2 pt-2">
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-5/6 h-4" />
            <Skeleton className="w-2/3 h-4" />
          </div>
          <Skeleton className="w-32 h-32 mx-auto" />
        </div>

        <Skeleton className="w-full h-11 rounded-lg" />
        <Skeleton className="w-full h-11 rounded-lg" />
      </div>
    </LoadingRegion>
  );
}
