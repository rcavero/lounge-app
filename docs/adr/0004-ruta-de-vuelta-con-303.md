# 0004 · Las URL de vuelta de Redsys apuntan a una ruta que redirige con 303, no a las páginas

**Estado:** vigente · **Fecha:** agosto de 2026 · **Plan:** [`PLAN_IMPLEMENTACION_NOMBRE_CLIENTE.md`](../historico/PLAN_IMPLEMENTACION_NOMBRE_CLIENTE.md)

## Contexto

Cuando el cliente termina de pagar, Redsys lo devuelve a la URLOK o a la URLKO que la app firmó.
Hasta agosto de 2026 esas URL eran las páginas `/reserva/confirmacion/[orderId]` y
`/reserva/error`.

En el App Router, **una página solo responde a GET**, y un POST devuelve 405. Funcionaba porque
el terminal hacía una redirección sin parámetros. Pero para el recibo
(ver [0003](0003-recibo-solo-desde-notificacion-firmada.md)) estaba previsto pedir a CaixaBank que
activara el envío de parámetros en las URL de vuelta, y entonces Redsys pasaría a hacer **POST**. Ese día, la
pantalla de todos los clientes que acaban de pagar respondería con un error.

## Decisión

Las dos URL de vuelta apuntan a **`/api/payments/return/[orderId]`**, una ruta que:

1. **acepta GET y POST**;
2. si llega una notificación firmada y su nº de pedido coincide con el de la URL, **anota el
   recibo**;
3. **no confirma ni cancela nada**: eso sigue en manos del webhook en producción, y de la página
   fuera de ella;
4. **redirige con 303** a la página que toca, pasando la llave de la reserva
   (ver [0007](0007-llave-de-reserva-en-la-url.md)).

## Alternativas descartadas

- **Dejar las URL apuntando a las páginas** hasta que CaixaBank activara el envío. Habría roto la
  pantalla de pago correcto en producción el día del cambio, que depende de un tercero.
- **Redirigir con 302.** Algunos navegadores repiten el método original al seguir un 302, así que
  el POST de Redsys volvería a llegar a la página y daría el mismo 405. **El 303 obliga a seguir
  con GET.**

## Consecuencias

- La ruta es robusta a propósito: si la firma no cuadra o falla la base de datos, anota el error y
  **redirige igual**. Un cliente que acaba de pagar tiene que llegar a su pantalla.
- El nº de pedido de la URL lo controla quien navega, y el de la notificación viene firmado. Solo
  se anota el recibo cuando coinciden.
- La página de error pasa por la misma ruta, porque también es un `page.tsx`.
- Se prueba en integración, con GET y POST y con notificaciones firmadas.
