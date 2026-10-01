-- Llave aleatoria de las páginas de vuelta del pago (RCA-285).
--
-- El nº de pedido (paymentId) son los 12 últimos dígitos de Date.now() y se adivina.
-- Con él bastaba para ver el ticket de otro cliente en /reserva/confirmacion y para
-- cancelarle la reserva en /reserva/error. Desde ahora initializePayment genera una
-- llave por reserva, la mete en las URL de vuelta que firma para Redsys, y las páginas
-- la exigen.
--
-- Anulable y sin DEFAULT: el ALTER TABLE no reescribe la tabla. Las reservas
-- anteriores quedan con NULL y se siguen abriendo solo con el nº de pedido, porque
-- sus URL ya están en manos de sus clientes; la retención de 90 días las acaba
-- borrando. Las reservas que estén en la pasarela durante el despliegue caen en ese
-- mismo caso y no se rompen.

ALTER TABLE "Reservation" ADD COLUMN "accessToken" TEXT;
