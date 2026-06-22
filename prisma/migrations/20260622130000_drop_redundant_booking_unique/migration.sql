-- Elimina el índice único plano del init sobre Booking.
--
-- `Booking_businessId_staffId_date_startTime_key` (UNIQUE businessId, staffId,
-- date, startTime) NO filtra por status. Para reservas CON staffId asignado,
-- rebookear un slot cuyo turno previo quedó CANCELLED chocaba contra este unique
-- (P2002) y la app lo reportaba erróneamente como SLOT_TAKEN. Con staffId=NULL no
-- molestaba (Postgres trata cada NULL como distinto), pero tampoco aportaba nada.
--
-- La unicidad CORRECTA ya la garantiza el índice único PARCIAL
-- `Booking_active_slot_unique` (migración 20260616130000):
--   UNIQUE (businessId, COALESCE(staffId,''), date, startTime)
--   WHERE status IN ('PENDING','CONFIRMED')
-- que cubre staffId null y no-null y excluye CANCELLED/COMPLETED/NO_SHOW (misma
-- definición de "ocupado" que usan /slots y el POST de reserva).
--
-- No destructiva: no toca datos, solo elimina un constraint redundante. Los índices
-- de lectura (Booking_businessId_date_idx, etc.) cubren los patrones de consulta.

DROP INDEX IF EXISTS "Booking_businessId_staffId_date_startTime_key";
