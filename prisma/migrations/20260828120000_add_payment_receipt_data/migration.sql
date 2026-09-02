-- Datos del recibo de pago que Redsys/CaixaBank exigen mostrar en la URL OK:
-- código de autorización y fecha/hora de la operación. Hasta ahora llegaban en la
-- notificación firmada y se descartaban, así que no había forma de imprimirlos.
--
-- Solo los escriben caminos de servidor con la firma ya verificada (el webhook
-- /api/payments/notify y la ruta de retorno /api/payments/return). Son NULL en las
-- reservas anteriores a esto y en los entornos donde el webhook no llega, y las
-- vistas los pintan como "—".
--
-- Las tres son anulables y sin DEFAULT: el ALTER TABLE no reescribe la tabla.

ALTER TABLE "Reservation" ADD COLUMN "authorisationCode"   TEXT;
ALTER TABLE "Reservation" ADD COLUMN "paymentDateTime"     TEXT;
ALTER TABLE "Reservation" ADD COLUMN "paymentResponseCode" TEXT;
