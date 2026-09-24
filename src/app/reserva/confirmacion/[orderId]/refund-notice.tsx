import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * El pago llegó bien, pero tarde: la reserva ya había caducado y sus asientos eran de
 * otro. Se le devuelve el dinero (RCA-276).
 *
 * No dice cuánto tardará la devolución: la hace el bar a mano desde el portal de Redsys,
 * y el plazo en que el cliente la ve depende de su banco.
 */
export function RefundNotice({ orderId }: { orderId: string }) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div data-testid="refund-notice" className="max-w-sm w-full space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="w-16 h-16 text-[#D4AF37]" />
          <h1 className="text-white text-2xl font-bold tracking-tight">
            Tus asientos ya no estaban disponibles
          </h1>
          <p className="text-white/50 text-sm">
            El pago se completó cuando la reserva ya había caducado, y otra persona había
            ocupado alguno de tus asientos. No tienes reserva y{" "}
            <span className="text-white font-semibold">
              te devolveremos el importe íntegro
            </span>{" "}
            en la tarjeta con la que pagaste.
          </p>
          <p className="text-white/50 text-sm">Guarda este código de pedido:</p>
          <p className="text-[#D4AF37] font-mono text-lg font-bold">{orderId}</p>
        </div>

        <div className="bg-[#1a1a1a] rounded-xl p-4 text-left border border-white/10">
          <p className="text-white/50 text-xs mb-2">¿Tienes dudas?</p>
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

        <Link href="/" className="block">
          <Button
            variant="outline"
            className="w-full border-white/20 text-white/70 hover:text-white hover:bg-white/10"
          >
            Ir al inicio
          </Button>
        </Link>
      </div>
    </div>
  );
}
