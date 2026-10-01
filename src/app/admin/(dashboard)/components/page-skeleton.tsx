import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

/**
 * La pantalla de carga de una página del panel. Todas siguen el mismo patrón: cabecera
 * fija con la flecha de volver, título y subtítulo, y debajo el contenido.
 *
 * El título es el **de verdad** y la flecha es un enlace de verdad: al pulsar una
 * tarjeta se sabe al instante a dónde se ha ido, y quien se ha equivocado puede
 * volverse sin esperar. Lo que falta, los datos, lo dibuja `body` con la forma que
 * tendrá:
 *
 * - `list`: tarjetas de evento, de reserva o de usuario.
 * - `plan`: el plano del local, que es una imagen estática y ya se puede pintar.
 * - `form`: campos de formulario.
 * - `detail`: la tarjeta del evento y la de la reserva.
 *
 * El `AdminHeader` de arriba no está aquí: es del layout, y se queda en pantalla.
 *
 * ⚠️ El panel principal (`/admin`) NO tiene `loading.tsx`, a propósito. Con uno en
 * `(dashboard)/`, la respuesta de «Ya está devuelto» a veces no se aplicaba: la base
 * quedaba en REFUNDED y el aviso seguía en pantalla. Medido con el E2E repetido 30
 * veces: 7–12 fallos con ese fichero, 0 sin él y 0 en el estado de P7. Pasaba igual con
 * `router.refresh()` que con `revalidatePath`. El panel solo lee la sesión y los pagos a
 * devolver, así que no se echa de menos. Si se vuelve a poner, repetir esa medición.
 */
export type AdminSkeletonBody = "list" | "plan" | "form" | "detail";

export function AdminPageSkeleton({
  title,
  subtitle,
  backHref,
  body,
}: {
  title?: string;
  subtitle?: string;
  backHref?: string;
  body: AdminSkeletonBody;
}) {
  return (
    <LoadingRegion
      label={title ? `Cargando ${title.toLowerCase()}…` : "Cargando…"}
      data-testid="admin-skeleton"
      className="min-h-screen bg-black flex flex-col"
    >
      {title && (
        <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-white/10">
          <div className="flex items-center gap-3 px-4 py-3">
            {backHref && (
              <Link
                href={backHref}
                aria-label="Volver"
                className="text-white/70 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
            )}
            <div>
              <p className="text-white font-semibold text-sm">{title}</p>
              {subtitle ? (
                <p className="text-white/50 text-xs">{subtitle}</p>
              ) : (
                <Skeleton className="w-32 h-3 mt-1" />
              )}
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 px-4 py-4">
        <div className="max-w-lg mx-auto">{BODIES[body]}</div>
      </main>
    </LoadingRegion>
  );
}

function CardRow() {
  return (
    <div className="bg-[#1a1a1a] rounded-2xl px-4 py-4 flex items-center justify-between">
      <div className="flex flex-col items-center w-20 gap-1">
        <Skeleton className="w-12 h-12 rounded-full" />
        <Skeleton className="w-12 h-2.5" />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <Skeleton className="w-20 h-3" />
        <Skeleton className="w-14 h-6" />
      </div>
      <div className="flex flex-col items-center w-20 gap-1">
        <Skeleton className="w-12 h-12 rounded-full" />
        <Skeleton className="w-12 h-2.5" />
      </div>
    </div>
  );
}

const BODIES: Record<AdminSkeletonBody, React.ReactNode> = {
  list: (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <CardRow key={i} />
      ))}
    </div>
  ),
  plan: (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="w-20 h-4" />
        <Skeleton className="w-40 h-9" />
      </div>
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
  ),
  form: (
    <div className="space-y-6">
      <Skeleton className="w-32 h-4" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="w-24 h-3" />
          <Skeleton className="w-full h-10 rounded-lg" />
        </div>
      ))}
      <Skeleton className="w-full h-11 rounded-lg" />
    </div>
  ),
  detail: (
    <div className="space-y-4">
      <CardRow />
      <div className="bg-[#1a1a1a] rounded-2xl p-4 space-y-3">
        <Skeleton className="w-40 h-4" />
        <Skeleton className="w-full h-3" />
        <Skeleton className="w-5/6 h-3" />
        <Skeleton className="w-2/3 h-3" />
      </div>
    </div>
  ),
};
