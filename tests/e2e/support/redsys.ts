/**
 * Redsys en el E2E, por los dos caminos por los que la app habla con la pasarela.
 *
 * Se descartó una ruta stub en el servidor activada por variable de entorno: sería un
 * endpoint en producción capaz de confirmar reservas, protegido solo por que la variable
 * esté bien puesta.
 */
import type { APIRequestContext, Page } from "@playwright/test";

import {
  signRedsysNotification,
  toFormBody,
  type RedsysNotificationInput,
} from "../../../scripts/lib/redsys-notification";

/** Lo que la app firmó y mandó a la pasarela, ya decodificado. */
export interface RedsysRequest {
  orderId: string;
  amountCents: string;
  urlOk: string;
  urlKo: string;
}

/**
 * Camino del navegador. Intercepta el POST del formulario a la pasarela y responde un
 * 303 hacia la URLOK o la URLKO **que la propia app acaba de firmar**, como hace Redsys
 * cuando el cliente termina.
 *
 * El `orderId` no viaja en la URL, sino dentro de `Ds_MerchantParameters`: un JSON en
 * base64 en el cuerpo del POST. Reutilizar las URLs firmadas en vez de reconstruirlas
 * hace que el test sobreviva a un cambio en su formato.
 *
 * Devuelve una promesa que se resuelve con lo que la app mandó, para comprobar el pedido
 * y el importe.
 */
export function interceptRedsys(
  page: Page,
  outcome: "ok" | "ko",
): Promise<RedsysRequest> {
  return new Promise((resolve, reject) => {
    page
      .route(/redsys\.es/, async (route) => {
        try {
          const form = new URLSearchParams(route.request().postData() ?? "");
          const encoded = form.get("Ds_MerchantParameters");
          if (!encoded)
            throw new Error("El POST a Redsys no lleva Ds_MerchantParameters");

          const params = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
          const sent: RedsysRequest = {
            orderId: params.DS_MERCHANT_ORDER,
            amountCents: params.DS_MERCHANT_AMOUNT,
            urlOk: params.DS_MERCHANT_URLOK,
            urlKo: params.DS_MERCHANT_URLKO,
          };

          await route.fulfill({
            status: 303,
            headers: { location: outcome === "ok" ? sent.urlOk : sent.urlKo },
          });
          resolve(sent);
        } catch (error) {
          await route.abort();
          reject(error);
        }
      })
      .catch(reject);
  });
}

/**
 * Camino servidor-servidor: una notificación firmada de verdad, con la clave del
 * sandbox, contra el webhook. Es el único que llega en producción; el de navegador, en
 * cambio, pasa por la autoconfirmación de la página de OK.
 */
export async function postNotification(
  request: APIRequestContext,
  input: Pick<
    RedsysNotificationInput,
    "orderId" | "amountCents" | "ok" | "authorisationCode"
  >,
  { tamper = false }: { tamper?: boolean } = {},
) {
  const signed = signRedsysNotification({
    secretKey: process.env.REDSYS_SECRET_KEY!,
    merchantCode: process.env.REDSYS_MERCHANT_CODE!,
    terminal: process.env.REDSYS_TERMINAL!,
    date: "14/10/2026",
    hour: "12:00",
    ...input,
  });

  // Corromper la firma cambiando su primer carácter: sigue siendo base64 válido.
  if (tamper) {
    const first = signed.Ds_Signature[0] === "A" ? "B" : "A";
    signed.Ds_Signature = first + signed.Ds_Signature.slice(1);
  }

  return request.post("/api/payments/notify", {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    data: toFormBody(signed).toString(),
  });
}
