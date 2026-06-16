-- Fase 3 (staff multi-profesional): la unicidad de slot pasa a ser POR PROFESIONAL.
--
-- El índice anterior (Booking_active_slot_unique) era por (businessId, date, startTime),
-- es decir un único recurso por negocio. Ahora incluimos staffId vía COALESCE para que:
--   - Negocios SIN staff (staffId NULL) sigan comportándose igual (NULL → '' → un solo
--     recurso por negocio, idéntico a hoy).
--   - Negocios CON staff tengan unicidad por (negocio, profesional, fecha, inicio):
--     dos profesionales pueden tomar el mismo horario, pero el mismo profesional no
--     puede estar doble-reservado en el mismo inicio (garantía atómica, P2002).
--
-- COALESCE evita el problema de que Postgres trata cada NULL como distinto (por eso
-- el @@unique del schema no alcanza). No destructiva.

DROP INDEX IF EXISTS "Booking_active_slot_unique";

CREATE UNIQUE INDEX "Booking_active_slot_unique"
  ON "Booking" ("businessId", (COALESCE("staffId", '')), "date", "startTime")
  WHERE "status" IN ('PENDING', 'CONFIRMED');
