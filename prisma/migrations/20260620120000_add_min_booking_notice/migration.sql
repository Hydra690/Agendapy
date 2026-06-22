-- Antelación mínima de reserva (en minutos) por negocio.
-- 0 = comportamiento "no reservar horas ya pasadas del día" (el filtro nuevo de
-- /slots oculta cualquier slot cuyo inicio sea < ahora). >0 agrega un colchón.
-- No destructiva: default 0 preserva el comportamiento existente.

ALTER TABLE "Business" ADD COLUMN "minBookingNoticeMinutes" INTEGER NOT NULL DEFAULT 0;
