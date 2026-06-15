-- Garantía atómica contra doble reserva del mismo slot.
--
-- El @@unique([businessId, staffId, date, startTime]) del schema NO sirve en el
-- MVP porque staffId es siempre NULL y Postgres trata cada NULL como distinto,
-- así que no bloquea duplicados. Este índice único PARCIAL sí lo hace para las
-- reservas activas (PENDING/CONFIRMED), ignorando staffId (recurso único en MVP).
--
-- Si en el futuro hay múltiples empleados (staffId no nulo), reemplazar por un
-- índice que incluya staffId con COALESCE o una exclusion constraint por rango.

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_active_slot_unique"
  ON "Booking" ("businessId", "date", "startTime")
  WHERE "status" IN ('PENDING', 'CONFIRMED');
