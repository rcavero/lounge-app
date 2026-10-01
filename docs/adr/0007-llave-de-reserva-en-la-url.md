# 0007 · El cliente abre su reserva con una llave aleatoria en la URL, sin cuenta

**Estado:** vigente · **Fecha:** septiembre de 2026 · **Registro:** `MASTER_IA.md`, apartado P9.1 (RCA-285)

## Contexto

El cliente reserva sin registrarse: la app se diseñó desde el principio para reservar desde el
móvil, sin cuenta. Después de pagar, vuelve a `/reserva/confirmacion/[orderId]`, donde ve y
descarga su ticket. Si el pago falla, vuelve a `/reserva/error?orderId=…`, que libera sus
asientos.

**El nº de pedido era lo único que abría esas páginas, y se adivina**: son los 12 últimos dígitos
de `Date.now()`. Sabiendo más o menos a qué hora compró alguien, se podía ver su ticket, y con la
página de error, cancelarle la reserva mientras pagaba, también en producción.

## Decisión

Cada reserva lleva una **llave aleatoria** (`Reservation.accessToken`): 16 bytes en base64url,
generados al crear la reserva.

- Viaja **solo en las URL de vuelta que la app firma para Redsys** (`&t=…`). Es el único camino
  por el que llega al cliente.
- La confirmación, su sondeo y la página de error la exigen. Sin ella:
  - la confirmación es un 404, y no llega a autoconfirmar;
  - la página de error sale, pero no cancela nada ni enseña el recibo;
  - el ticket no se entrega.
- Se compara en tiempo constante.
- **Las reservas anteriores no tienen llave** y se abren como antes. Sus URL ya estaban en manos
  de sus clientes, y la retención de 90 días las borra.

## Alternativas descartadas

Las valoró la IA al proponer el arreglo, y Ramón eligió la llave.

- **Cuentas de cliente.** Resuelve el acceso, pero obliga a registrarse para ver un partido en un
  bar, y cambia el producto más de lo que pide el problema.
- **Una cookie puesta al iniciar el pago.** Redsys devuelve al cliente con una navegación que viene
  de otro sitio, y el día que haga POST, una cookie `SameSite=Lax` no viajaría. Además, se pierde
  si el cliente termina el pago en otro navegador, como la app del banco.
- **Una llave derivada del nº de pedido con un secreto (HMAC), sin guardarla.** Evita la
  migración, pero cambiar el secreto invalidaría todas las URL ya repartidas. Además, no habría
  forma de distinguir las reservas anteriores, que no llevan llave en su URL.
- **Un nº de pedido aleatorio.** Redsys exige que los 4 primeros caracteres sean dígitos y un
  máximo de 12. Cabría, pero el nº de pedido aparece en el recibo, en el portal del banco y en
  las llamadas con el cliente: es un identificador, no un secreto, y no conviene tratarlo como
  tal.

## Consecuencias

- **La llave está en la URL**, así que queda en el historial del navegador y en los registros de
  Vercel. Es aceptable: da acceso a un ticket, no al dinero ni al panel.
- **Hizo falta una migración**, una columna anulable y compatible hacia atrás. En producción se
  aplica antes que el código.
- **Con `loading.tsx`, `notFound()` responde 200** con la pantalla de 404, porque el streaming ya ha
  empezado. Los tests comprueban lo que se entrega, no el código HTTP.
- Tests en `tests/integration/order-access.test.ts` y `tests/e2e/public/order-access.spec.ts`,
  vistos en rojo antes de implementar y con mutaciones sobre cada comprobación.
