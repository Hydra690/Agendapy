// Constantes de dominio compartidas. Fuente ÚNICA para sets/labels que antes
// estaban duplicados en route handlers y componentes.

import type { BookingStatus } from "@prisma/client";

/**
 * Estados que OCUPAN un slot ("reserva activa"). Esta es la fuente única que debe
 * coincidir con el WHERE del índice único parcial `Booking_active_slot_unique`
 * (migración 20260616130000): UNIQUE (...) WHERE status IN ('PENDING','CONFIRMED').
 *
 * Lo consumen /slots, el POST de reserva (chequeo de solape + límite de reservas
 * activas) y los listados de turnos vigentes. Si algún día agregás un estado que
 * deba reservar el slot (ej. AWAITING_PAYMENT cuando entren los pagos), sumalo acá
 * Y al WHERE de una nueva migración del índice, en el mismo cambio.
 */
export const ACTIVE_BOOKING_STATUSES = ["PENDING", "CONFIRMED"] as const satisfies readonly BookingStatus[];

/** Días de la semana en orden (lunes→domingo), como valores del enum DayOfWeek. */
export const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;
