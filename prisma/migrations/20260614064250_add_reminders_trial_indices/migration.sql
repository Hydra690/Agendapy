-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "reminderSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Booking_businessId_date_idx" ON "Booking"("businessId", "date");

-- CreateIndex
CREATE INDEX "Booking_date_status_reminderSent_idx" ON "Booking"("date", "status", "reminderSent");

-- CreateIndex
CREATE INDEX "Booking_clientId_idx" ON "Booking"("clientId");
