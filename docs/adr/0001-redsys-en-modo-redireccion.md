# 0001 · Cobrar con Redsys en modo redirección, solo con tarjeta

**Estado:** vigente · **Fecha:** abril de 2026 · **Plan:** [`PASARELA_PAGO.md`](../historico/PASARELA_PAGO.md)

## Contexto

Hasta abril de 2026 las reservas se confirmaban al instante, sin cobrar. El bar ya tenía cuenta
con CaixaBank, cuyo TPV virtual es Redsys. Redsys ofrece varias formas de integrarse: redirigir
al cliente a su página de pago, incrustar el formulario de tarjeta en la web del comercio
(InSite), o que el comercio envíe los datos de la tarjeta por API (REST).

## Decisión

**Modo redirección.** La app construye un formulario firmado con HMAC-SHA256 (importe, nº de
pedido, URL de vuelta y URL de notificación) y el navegador del cliente lo envía a Redsys. El
cliente paga en la página del banco. Redsys avisa al servidor con una notificación firmada
(`/api/payments/notify`) y devuelve al cliente a la URL de vuelta. La firma la hace la librería
`redsys-easy`.

**Solo tarjeta** (`DS_MERCHANT_PAYMETHODS = "C"`). Sin ese parámetro, el TPV ofrece todos los
métodos contratados, incluido Bizum. Va dentro de lo firmado, así que el navegador no puede
cambiarlo.

## Alternativas descartadas

El plan de abril eligió la redirección como «el más seguro y sencillo», sin comparar opciones. Estas
son las que había:

- **InSite**: el formulario de tarjeta vive dentro de la web, pero sigue siendo de Redsys.
  Integrarlo es más trabajo, y a cambio el cliente no sale de la página.
- **REST**: los datos de la tarjeta pasarían por el servidor de la app. Eso mete la aplicación
  entera en el alcance de la norma PCI DSS, algo desproporcionado para un bar.

## Consecuencias

- **La app nunca ve una tarjeta.** El alcance de PCI es el mínimo posible.
- **La única prueba de cobro es la notificación firmada.** Toda la lógica de confirmación se
  construye alrededor del webhook, y en producción la página de vuelta solo espera a que llegue
  (ver [`arquitectura.md`](../arquitectura.md#el-flujo-de-pago)).
- **En local no llega la notificación**, porque Redsys no alcanza `localhost`. Fuera de producción,
  la página de vuelta confirma ella misma, y `scripts/simulate-redsys-notify.ts` firma
  notificaciones para probar el recibo.
- **El cliente sale de la web para pagar**, y puede no volver: cerrar la pestaña en la pasarela
  deja la reserva pagada y confirmada por el webhook, pero sin ticket en pantalla. Es el motivo
  del plan de enviar el ticket por email, todavía sin implementar.
- **La clave del comercio es el secreto más sensible**: con ella se forjan notificaciones. Solo
  existe en Vercel, en el scope de producción.
