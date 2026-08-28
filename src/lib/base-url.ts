/**
 * URL pública del servidor.
 *
 * Vive aquí y no dentro de una server action porque la necesitan tres sitios que no
 * pueden importarse entre sí: `initializePayment` (para firmar URLOK/URLKO/MERCHANTURL),
 * `lib/redsys.ts` (para el dato "URL del comercio" del recibo) y la ruta de retorno de
 * Redsys (para construir su redirección). En un fichero `"use server"` no cabe: allí
 * todo lo exportado tiene que ser una función asíncrona.
 *
 * Ojo: en producción este valor se imprime en el recibo de pago, así que
 * `NEXT_PUBLIC_BASE_URL` en Vercel (scope Production) tiene que ser el dominio real
 * de cara al cliente, no una URL de preview.
 */
export const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  "http://localhost:3000";
