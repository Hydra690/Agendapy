-- Multi-servicio por reserva (Tarea 5, Commit 1). Aditiva y no destructiva:
-- crea la tabla intermedia + columna de buffer y backfillea desde el estado actual.
-- NO toca Booking.serviceId (se conserva como "servicio principal").

-- 1) Tabla intermedia: N servicios por reserva.
CREATE TABLE "BookingService" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bookingId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  CONSTRAINT "BookingService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingService_bookingId_serviceId_key" ON "BookingService"("bookingId", "serviceId");
CREATE INDEX "BookingService_bookingId_idx" ON "BookingService"("bookingId");
CREATE INDEX "BookingService_serviceId_idx" ON "BookingService"("serviceId");

ALTER TABLE "BookingService" ADD CONSTRAINT "BookingService_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingService" ADD CONSTRAINT "BookingService_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) Buffer efectivo del turno (snapshot) en Booking.
ALTER TABLE "Booking" ADD COLUMN "bufferMinutes" INTEGER NOT NULL DEFAULT 0;

-- 3) Backfill: cada reserva existente queda con UNA fila (su servicio actual).
--    gen_random_uuid() es nativo en Postgres 13+ (no requiere extensión).
INSERT INTO "BookingService" ("id", "bookingId", "serviceId", "createdAt")
SELECT gen_random_uuid()::text, "id", "serviceId", CURRENT_TIMESTAMP
FROM "Booking";

-- 4) Backfill del buffer efectivo desde el servicio principal de cada reserva.
UPDATE "Booking" b
SET "bufferMinutes" = s."bufferMinutes"
FROM "Service" s
WHERE b."serviceId" = s."id";
