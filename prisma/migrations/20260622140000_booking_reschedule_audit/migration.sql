-- Auditoría de reprogramación de turnos (Tarea 3). Aditiva y no destructiva:
-- columnas nullable, sin tocar datos existentes.
ALTER TABLE "Booking"
  ADD COLUMN "rescheduledAt" TIMESTAMP(3),
  ADD COLUMN "previousDate" DATE,
  ADD COLUMN "previousStartTime" TEXT;
