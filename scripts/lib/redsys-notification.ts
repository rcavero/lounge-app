/**
 * Construye y firma una notificación de Redsys como la que llega al webhook.
 *
 * La usan dos sitios que tienen que firmar exactamente igual: el script
 * `scripts/simulate-redsys-notify.ts`, que la manda a localhost, y los tests de
 * integración, que la pasan directamente a la ruta `notify`. Con una copia en cada
 * sitio, el día que cambie el formato uno de los dos seguiría "funcionando" con el viejo.
 *
 * SEGURIDAD: esto falsifica una notificación de pago con la clave que se le pase. Solo
 * tiene sentido con las credenciales del sandbox. Quien la llame es responsable de no
 * apuntarla nunca a producción.
 */
import { serializeAndSignJSONRequest } from "redsys-easy";

export interface RedsysNotificationInput {
  secretKey: string;
  merchantCode: string;
  terminal: string;
  /** Los 12 dígitos de `Reservation.paymentId`. */
  orderId: string;
  /** Importe en céntimos, como lo manda Redsys: "2300" son 23,00 €. */
  amountCents: string;
  /** Autorizada ("0000") o denegada ("0190"). */
  ok: boolean;
  /** Ds_Date, "DD/MM/YYYY", hora local española. */
  date: string;
  /** Ds_Hour, "hh:mm". */
  hour: string;
  /** Solo se envía si `ok`. Por defecto, "123456". */
  authorisationCode?: string;
}

export interface SignedRedsysNotification {
  Ds_SignatureVersion: string;
  Ds_MerchantParameters: string;
  Ds_Signature: string;
}

export function signRedsysNotification(
  input: RedsysNotificationInput,
): SignedRedsysNotification {
  const params = {
    // El firmante de redsys-easy busca el pedido en DS_MERCHANT_ORDER, mientras que el
    // verificador lo lee de Ds_Order. Hay que mandar las dos claves: la de más es inocua
    // porque la firma se calcula sobre la cadena base64 completa.
    DS_MERCHANT_ORDER: input.orderId,
    Ds_Order: input.orderId,
    Ds_MerchantCode: input.merchantCode,
    Ds_Terminal: input.terminal,
    Ds_TransactionType: "0",
    Ds_Currency: "978",
    Ds_Amount: input.amountCents,
    Ds_Response: input.ok ? "0000" : "0190",
    Ds_Date: input.date,
    Ds_Hour: input.hour,
    ...(input.ok ? { Ds_AuthorisationCode: input.authorisationCode ?? "123456" } : {}),
  };

  const signed = serializeAndSignJSONRequest(input.secretKey, params);

  return {
    Ds_SignatureVersion: signed.Ds_SignatureVersion,
    Ds_MerchantParameters: signed.Ds_MerchantParameters,
    Ds_Signature: signed.Ds_Signature,
  };
}

/** El cuerpo `application/x-www-form-urlencoded` con el que Redsys hace el POST. */
export function toFormBody(notification: SignedRedsysNotification): URLSearchParams {
  return new URLSearchParams({ ...notification });
}
