import prisma from "@/lib/prisma";

/**
 * Datos del recibo tal y como los manda Redsys en la notificación firmada.
 */
export interface PaymentReceiptInput {
  authorisationCode?: string;
  /** Ds_Date, "DD/MM/YYYY" */
  date?: string;
  /** Ds_Hour, "hh:mm" */
  hour?: string;
  /** Ds_Response, "0000".."0099" = autorizada */
  responseCode?: string;
}

/**
 * Guarda los datos que CaixaBank exige mostrar en el recibo de la URL OK.
 *
 * NO es una server action, y eso es deliberado: todo lo exportado desde un fichero
 * `"use server"` queda como endpoint invocable desde el navegador con los argumentos
 * que quiera quien llame. Esta función escribiría un código de autorización inventado
 * en cualquier reserva. Solo la llaman caminos de servidor que ya han verificado la
 * firma de Redsys: el webhook y la ruta de retorno.
 *
 * Gana el primero que escribe (`paymentDateTime: null`): el webhook y la vuelta del
 * navegador traen la misma notificación firmada, así que el segundo no aporta nada, y
 * de paso una recarga de la URL OK no puede reescribir un recibo ya emitido.
 */
export async function recordPaymentReceipt(
  orderId: string,
  receipt: PaymentReceiptInput,
): Promise<void> {
  const paymentDateTime = [receipt.date, receipt.hour].filter(Boolean).join(" ").trim();

  // Sin fecha no hay recibo que imprimir, y es además el campo que hace de cerrojo.
  if (!paymentDateTime) return;

  const { count } = await prisma.reservation.updateMany({
    where: { paymentId: orderId, paymentDateTime: null },
    data: {
      authorisationCode: receipt.authorisationCode ?? null,
      paymentDateTime,
      paymentResponseCode: receipt.responseCode ?? null,
    },
  });

  if (count > 0) {
    console.log(`[Payment receipt] Recibo guardado para orderId=${orderId}`);
  }
}
