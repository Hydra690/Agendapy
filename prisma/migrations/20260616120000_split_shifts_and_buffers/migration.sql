-- Fase 3 (tanda 1): turnos partidos + buffers.
--
-- 1) Availability: quitamos el UNIQUE por (businessId, staffId, dayOfWeek) para
--    permitir MÚLTIPLES intervalos por día (turno partido / pausa de almuerzo).
--    Lo reemplazamos por un índice NO único para mantener las lecturas rápidas.
-- 2) Service: agregamos bufferMinutes (colchón de limpieza/preparación tras el turno).
--
-- Ambos cambios son no destructivos (drop de índice + columna con default).

DROP INDEX IF EXISTS "Availability_businessId_staffId_dayOfWeek_key";

CREATE INDEX IF NOT EXISTS "Availability_businessId_staffId_dayOfWeek_idx"
  ON "Availability" ("businessId", "staffId", "dayOfWeek");

ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "bufferMinutes" INTEGER NOT NULL DEFAULT 0;
