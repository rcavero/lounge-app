import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cancelReservationByOrderId,
  getReservationByOrderId,
} from "@/modules/payments/actions";
import { MERCHANT_INFO } from "@/lib/redsys";
import { formatEuros } from "@/lib/utils";

interface Props {
  searchParams: Promise<{ orderId?: string; eventId?: string }>;
}

/** Fila etiqueta/valor, igual que en la pantalla de confirmación. */
function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-white/40 shrink-0">{label}</span>
      <span className="text-white text-right break-all">{value}</span>
    </div>
  );
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

  // El banco no exige esta información en la URL KO, pero tenerla en pantalla resuelve
  // en el momento la llamada de "creo que me han cobrado": el código de respuesta de
  // Redsys dice por qué se rechazó. Se lee después de cancelar, para reflejar el estado
  // final de la reserva.
  const reservation = orderId ? await getReservationByOrderId(orderId) : null;

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

        {reservation && orderId && (
          <div className="bg-[#1a1a1a] rounded-xl p-4 text-left border border-white/10 space-y-2">
            <p className="text-white/40 text-xs uppercase tracking-wider text-center mb-1">
              Datos de la operación
            </p>
            <ReceiptRow label="Comercio" value={MERCHANT_INFO.name} />
            <ReceiptRow label="FUC" value={MERCHANT_INFO.fuc} />
            <ReceiptRow label="URL" value={MERCHANT_INFO.url} />
            <ReceiptRow
              label="Importe"
              value={`${formatEuros(reservation.totalPrice)}€`}
            />
            <ReceiptRow label="Nº de pedido" value={orderId} />
            {reservation.paymentDateTime && (
              <ReceiptRow label="Fecha / hora" value={reservation.paymentDateTime} />
            )}
            {reservation.paymentResponseCode && (
              <ReceiptRow
                label="Cód. de respuesta"
                value={reservation.paymentResponseCode}
              />
            )}
            <ReceiptRow label="Estado" value="No autorizada" />
          </div>
        )}

        <p className="text-xs text-white/30 tracking-wider">
          THE LOUNGE BEERHOUSE • VALENCIA
        </p>
      </div>
    </div>
  );
}
