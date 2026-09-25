# 0003 · El recibo solo lo escriben el webhook y la ruta de vuelta, y la fecha se guarda como texto

**Estado:** vigente · **Fecha:** agosto de 2026 · **Plan:** [`PLAN_IMPLEMENTACION_NOMBRE_CLIENTE.md`](../historico/PLAN_IMPLEMENTACION_NOMBRE_CLIENTE.md)

## Contexto

CaixaBank exige que la pantalla de pago correcto muestre un recibo con el código de autorización
y la fecha y hora de la operación. Esos datos **solo llegan dentro de la notificación firmada de
Redsys**. Hasta entonces la app los leía para confirmar y los descartaba.

Redsys los manda en hora local española y ya formateados: `Ds_Date = 28/08/2026` y
`Ds_Hour = 21:34`.

## Decisión

1. **Tres columnas nuevas en la reserva**: `authorisationCode`, `paymentDateTime` y
   `paymentResponseCode`.
2. **Solo las escribe `payments/lib/receipt.ts`, que no es una server action.** La llaman dos
   caminos de servidor que ya han verificado la firma: el webhook y la ruta de vuelta
   (ver [0004](0004-ruta-de-vuelta-con-303.md)).
3. **Gana el primero que escribe.** El webhook y la vuelta traen la misma notificación, así que el
   segundo no aporta nada. De paso, recargar la página no reescribe un recibo ya emitido.
4. **`paymentDateTime` es texto, no `DateTime`.** Se guarda literalmente lo que manda Redsys:
   `"28/08/2026 21:34"`. El instante de máquina sigue siendo `confirmedAt`.

## Alternativas descartadas

- **Una server action que guarde el recibo.** Sería un endpoint público, sin autenticar, capaz de
  escribir un código de autorización inventado en cualquier reserva.
- **Guardar la fecha como `DateTime`.** Obliga a decidir al parsear si la hora de Redsys es CET o
  CEST. Un fallo ahí saldría impreso en un documento que el cliente puede enseñar al banco.
  Guardar el texto hace que el recibo diga exactamente lo mismo que los registros del banco.

## Consecuencias

- **Las reservas anteriores no tienen recibo**, y la pantalla pinta un guion en esos campos.
- **En local tampoco hay recibo**, porque el webhook no llega.
  `scripts/simulate-redsys-notify.ts` firma una notificación con la clave del entorno y la manda a
  `localhost`.
- **Los códigos de autorización reales son alfanuméricos** (en el sandbox solo salían números).
  Por eso se guardan como texto.
- **Guardar el recibo va fuera de la transacción que confirma la reserva.** Si fallara, la reserva
  se confirma igual: el recibo es informativo, el cobro no.
