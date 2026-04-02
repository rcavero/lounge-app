import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelReservationByOrderId } from "@/modules/payments/actions";

interface Props {
  searchParams: Promise<{ orderId?: string; eventId?: string }>;
}

export default async function PaymentErrorPage({ searchParams }: Props) {
  const { orderId, eventId } = await searchParams;

  // Cancel the reservation immediately when the user lands on this page.
  // This handles the case where the Redsys webhook could not reach the server
  // (e.g. during local development). The webhook also does this in production,
  // but cancelReservationByOrderId is idempotent — cancelling twice is safe.
  if (orderId) {
    await cancelReservationByOrderId(orderId);
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <XCircle className="w-16 h-16 text-red-500" />
          <h1 className="text-white text-2xl font-bold tracking-tight">
            Pago no completado
          </h1>
          <p className="text-white/50 text-sm">
            No se ha podido procesar el pago. Los asientos han sido liberados.
            <br />
            Puedes volver a intentarlo.
          </p>
        </div>

        <div className="space-y-3">
          {eventId && (
            <Link href={`/eventos/${eventId}`} className="block">
              <Button className="w-full bg-[#D4AF37] hover:bg-[#b8972e] text-black font-semibold">
                Volver a seleccionar asientos
              </Button>
            </Link>
          )}

          <Link href="/" className="block">
            <Button
              variant="outline"
              className="w-full border-white/20 text-white/70 hover:text-white hover:bg-white/10"
            >
              Ir al inicio
            </Button>
          </Link>
        </div>

        <div className="bg-[#1a1a1a] rounded-xl p-4 text-left border border-white/10">
          <p className="text-white/50 text-xs mb-2">¿Necesitas ayuda?</p>
          <p className="text-white/70 text-sm">
            Contacta con nosotros por WhatsApp al{" "}
            <a
              href="https://wa.me/34640873444"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#D4AF37] font-bold hover:underline"
            >
              +34 640 87 34 44
            </a>
          </p>
        </div>

        <p className="text-xs text-white/30 tracking-wider">
          THE LOUNGE BEERHOUSE • VALENCIA
        </p>
      </div>
    </div>
  );
}
