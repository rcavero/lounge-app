import { NextResponse } from "next/server";
import { processRedirectNotification, isResponseCodeOk } from "@/lib/redsys";
import prisma from "@/lib/prisma";
import { recordPaymentReceipt } from "@/modules/payments/lib/receipt";
import { expectedCentsFromTotalPrice } from "@/modules/payments/domain/amount";
import { applyPaymentOutcome } from "@/modules/payments/lib/apply-payment-outcome";
import { settleAuthorisedPayment } from "@/modules/payments/lib/settle-payment";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const notification = {
      Ds_SignatureVersion: formData.get("Ds_SignatureVersion") as string,
      Ds_MerchantParameters: formData.get("Ds_MerchantParameters") as string,
      Ds_Signature: formData.get("Ds_Signature") as string,
    };

    // Verify signature and decode parameters
    const result = processRedirectNotification(notification);

    const orderId = result.Ds_Order;
    const isSuccess = isResponseCodeOk(result.Ds_Response);

    console.log(
      `[Payment notify] orderId=${orderId} response=${result.Ds_Response} success=${isSuccess}`,
    );

    const reservation = await prisma.reservation.findFirst({
      where: { paymentId: orderId },
      select: {
        id: true,
        eventId: true,
        totalPrice: true,
        seatStatuses: { select: { seatId: true } },
      },
    });

    if (!reservation) {
      console.error(`[Payment notify] Reservation not found for orderId=${orderId}`);
      // Must return 200 or Redsys will keep retrying
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Datos del recibo que CaixaBank exige mostrar en la URL OK. Fuera de las
    // transacciones de abajo a propósito: es un dato informativo, y si fallara no debe
    // impedir que la reserva se confirme o se libere.
    await recordPaymentReceipt(orderId, {
      authorisationCode: result.Ds_AuthorisationCode,
      date: result.Ds_Date,
      hour: result.Ds_Hour,
      responseCode: result.Ds_Response,
    });

    // Desde que los eventos llevan gastos de gestión el importe ya no es un múltiplo del
    // precio del asiento. Esto es solo una traza de auditoría: no altera el flujo, porque
    // el importe va firmado y una discrepancia significaría un problema mucho mayor.
    const expectedCents = expectedCentsFromTotalPrice(Number(reservation.totalPrice));
    if (Number(result.Ds_Amount) !== expectedCents) {
      console.error(
        `[Payment notify] IMPORTE DISCREPANTE orderId=${orderId} redsys=${result.Ds_Amount} esperado=${expectedCents}`,
      );
    }

    if (isSuccess) {
      // Un OK tardío, sobre una reserva ya caducada, recupera sus asientos si siguen
      // libres o la deja cobrada y anulada. Ver lib/settle-payment.ts (RCA-276).
      const settled = await settleAuthorisedPayment(reservation.id);

      if (settled === "refund") {
        console.error(
          `[Payment notify] COBRADA SIN ASIENTOS orderId=${orderId} reservation=${reservation.id}: hay que devolver el importe`,
        );
      } else {
        console.log(`[Payment notify] Reservation ${reservation.id} ${settled}`);
      }
    } else {
      // El KO sigue sin filtro de estado: ver domain/outcome.ts.
      const seatIds = reservation.seatStatuses.map((ss) => ss.seatId);

      // Release seats back to available
      await applyPaymentOutcome({
        outcome: "ko",
        reservationId: reservation.id,
        eventId: reservation.eventId,
        seatIds,
      });

      console.log(`[Payment notify] Reservation ${reservation.id} cancelled`);
    }

    // Redsys requires HTTP 200 with "OK" body
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[Payment notify] Error:", error);
    // Still return 200 to prevent Redsys retries on signature errors
    return new Response("OK", { status: 200 });
  }
}
