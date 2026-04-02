import { NextResponse } from "next/server";
import { processRedirectNotification, isResponseCodeOk } from "@/lib/redsys";
import prisma from "@/lib/prisma";

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
      `[Payment notify] orderId=${orderId} response=${result.Ds_Response} success=${isSuccess}`
    );

    const reservation = await prisma.reservation.findFirst({
      where: { paymentId: orderId },
      select: {
        id: true,
        eventId: true,
        seatStatuses: { select: { seatId: true } },
      },
    });

    if (!reservation) {
      console.error(`[Payment notify] Reservation not found for orderId=${orderId}`);
      // Must return 200 or Redsys will keep retrying
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (isSuccess) {
      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: "CONFIRMED",
            paymentStatus: "COMPLETED",
            confirmedAt: new Date(),
          },
        });

        await tx.seatStatus.updateMany({
          where: { reservationId: reservation.id },
          data: { status: "OCCUPIED" },
        });
      });

      console.log(`[Payment notify] Reservation ${reservation.id} confirmed`);
    } else {
      const seatIds = reservation.seatStatuses.map((ss) => ss.seatId);

      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "CANCELLED", paymentStatus: "FAILED" },
        });

        // Release seats back to available
        await tx.seatStatus.updateMany({
          where: { seatId: { in: seatIds }, eventId: reservation.eventId },
          data: { status: "AVAILABLE", reservationId: null },
        });
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
