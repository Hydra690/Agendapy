-- BookingNotification ahora cascada al borrar su Booking (las notificaciones
-- pertenecen a la reserva). Antes el FK era restrict y bloqueaba el borrado.

ALTER TABLE "BookingNotification" DROP CONSTRAINT "BookingNotification_bookingId_fkey";

ALTER TABLE "BookingNotification"
  ADD CONSTRAINT "BookingNotification_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
