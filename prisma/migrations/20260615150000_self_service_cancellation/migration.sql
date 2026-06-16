-- Self-service del cliente: token de gestión por reserva + ventana de cancelación por negocio.

-- Token de gestión: aleatorio e irrepetible. Backfill de las reservas existentes
-- con un UUID hex (gen_random_uuid es nativo en Postgres 13+).
ALTER TABLE "Booking" ADD COLUMN "manageToken" TEXT;
UPDATE "Booking" SET "manageToken" = replace(gen_random_uuid()::text, '-', '') WHERE "manageToken" IS NULL;
CREATE UNIQUE INDEX "Booking_manageToken_key" ON "Booking"("manageToken");

-- Horas mínimas de antelación con que el cliente puede cancelar (0 = sin límite).
ALTER TABLE "Business" ADD COLUMN "cancellationWindowHours" INTEGER NOT NULL DEFAULT 2;
