"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  markReservationRefunded,
  type PaymentToRefund,
} from "@/modules/reservations/actions";

interface RefundAlertProps {
  payments: PaymentToRefund[];
  isAdmin: boolean;
}

/**
 * Pagos cobrados sin asientos (RCA-276). Se pinta en el panel mientras haya alguno: es
 * dinero de un cliente que hay que devolver a mano desde el portal de Redsys, y el
 * código de pedido y el de autorización son lo que se busca allí.
 */
export function RefundAlert({ payments, isAdmin }: RefundAlertProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (payments.length === 0) return null;

  function markRefunded(id: string) {
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      // La acción revalida /admin: su respuesta ya trae el panel sin esta reserva.
      // Ojo: eso deja de aplicarse a veces si el segmento del panel tiene un
      // loading.tsx propio. Ver el comentario de admin/(dashboard)/components/page-skeleton.tsx.
      const result = await markReservationRefunded(id);
      if (!result.success) setError(result.error ?? "No se pudo marcar");
      setPendingId(null);
    });
  }

  return (
    <section
      data-testid="refund-alert"
      className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 text-red-400" />
        <h2 className="text-white font-semibold text-sm">
          Pagos a devolver ({payments.length})
        </h2>
      </div>
      <p className="text-white/60 text-xs mb-4">
        El pago llegó con la reserva ya caducada y alguno de sus asientos era de otro
        cliente. No tienen reserva: hay que devolver el importe desde el portal de Redsys.
      </p>

      <ul className="space-y-3">
        {payments.map((p) => (
          <li
            key={p.id}
            data-testid="refund-item"
            className="rounded-lg bg-black/40 border border-white/10 p-3 text-xs text-white/70 space-y-1"
          >
            <p className="text-white text-sm font-semibold">
              {p.totalPrice.toFixed(2).replace(".", ",")} € · {p.customerName}
            </p>
            <p>
              {p.eventTitle} ·{" "}
              {format(new Date(p.eventDate), "d 'de' MMMM, HH:mm", { locale: es })}
            </p>
            <p>
              Pedido <span className="font-mono text-white">{p.paymentId}</span>
              {p.authorisationCode && (
                <>
                  {" "}
                  · Autorización{" "}
                  <span className="font-mono text-white">{p.authorisationCode}</span>
                </>
              )}
              {p.paymentDateTime && <> · {p.paymentDateTime}</>}
            </p>
            {isAdmin && (
              <Button
                data-testid="mark-refunded"
                size="sm"
                variant="outline"
                disabled={pendingId !== null}
                loading={pendingId === p.id}
                onClick={() => markRefunded(p.id)}
                className="mt-2 border-white/20 text-white/80 hover:text-white hover:bg-white/10"
              >
                Ya está devuelto
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
    </section>
  );
}
