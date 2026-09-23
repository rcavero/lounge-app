import { NextResponse } from "next/server";
import { processRedirectNotification } from "@/lib/redsys";
import { BASE_URL } from "@/lib/base-url";
import { recordPaymentReceipt } from "@/modules/payments/lib/receipt";

/**
 * Vuelta del cliente desde la pasarela (URLOK y URLKO de Redsys).
 *
 * Existe por dos motivos:
 *
 * 1. **Blindaje.** Las pantallas de confirmación y de error son `page.tsx`, y en el App
 *    Router una página solo responde a GET: un POST devuelve 405. Hoy Redsys hace una
 *    redirección limpia, pero el día que en el módulo de administración se active el
 *    envío de parámetros en las URLs de respuesta empezaría a hacer POST, y se rompería
 *    la pantalla de todos los clientes que acaban de pagar. Esta ruta acepta las dos.
 *
 * 2. **Recibo.** Si esos parámetros llegan, se aprovechan para guardar el código de
 *    autorización y la fecha/hora que CaixaBank exige imprimir.
 *
 * Lo que esta ruta NO hace: confirmar ni cancelar. Eso sigue donde estaba (el webhook en
 * producción, el respaldo de la propia página en el resto). Aquí solo se anota el recibo.
 */

interface Context {
  params: Promise<{ orderId: string }>;
}

interface SignedNotification {
  Ds_SignatureVersion: string;
  Ds_MerchantParameters: string;
  Ds_Signature: string;
}

export async function GET(request: Request, context: Context) {
  return handleReturn(request, context, null);
}

export async function POST(request: Request, context: Context) {
  let notification: SignedNotification | null = null;

  try {
    const formData = await request.formData();
    const params = {
      Ds_SignatureVersion: String(formData.get("Ds_SignatureVersion") ?? ""),
      Ds_MerchantParameters: String(formData.get("Ds_MerchantParameters") ?? ""),
      Ds_Signature: String(formData.get("Ds_Signature") ?? ""),
    };

    if (params.Ds_MerchantParameters && params.Ds_Signature) {
      notification = params;
    }
  } catch {
    // POST sin cuerpo de formulario: se sigue igual, solo se pierde el recibo.
  }

  return handleReturn(request, context, notification);
}

async function handleReturn(
  request: Request,
  context: Context,
  notification: SignedNotification | null,
) {
  const { orderId } = await context.params;
  const { searchParams } = new URL(request.url);
  const isKo = searchParams.get("r") === "ko";
  const eventId = searchParams.get("eventId");

  if (notification) {
    try {
      // Verifica la firma: si no cuadra, lanza y no se guarda nada.
      const result = processRedirectNotification(notification);

      // El orderId de la URL lo controla quien navega; el de la notificación viene
      // firmado. Solo se anota el recibo cuando coinciden.
      if (result.Ds_Order === orderId) {
        await recordPaymentReceipt(orderId, {
          authorisationCode: result.Ds_AuthorisationCode,
          date: result.Ds_Date,
          hour: result.Ds_Hour,
          responseCode: result.Ds_Response,
        });
      } else {
        console.error(
          `[Payment return] orderId de la URL (${orderId}) distinto del firmado (${result.Ds_Order})`,
        );
      }
    } catch (error) {
      // Este es el camino del dinero: un cliente que acaba de pagar tiene que llegar a
      // su pantalla aunque la firma venga mal o falle la base de datos.
      console.error("[Payment return] No se pudo procesar la notificación:", error);
    }
  }

  const destination = isKo
    ? `/reserva/error?orderId=${encodeURIComponent(orderId)}${
        eventId ? `&eventId=${encodeURIComponent(eventId)}` : ""
      }`
    : `/reserva/confirmacion/${encodeURIComponent(orderId)}`;

  // 303 y no 302: es lo que convierte el POST de Redsys en un GET al redirigir. Con un
  // 302 algunos navegadores repiten el POST contra la página y vuelve el 405.
  return NextResponse.redirect(new URL(destination, BASE_URL), 303);
}
