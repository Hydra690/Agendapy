// Constantes de dominio compartidas. Fuente ÚNICA para sets/labels que antes
// estaban duplicados en route handlers y componentes.

import type { BookingStatus, BusinessCategory } from "@prisma/client";

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

/**
 * Categorías de negocio: fuente ÚNICA de valor (enum), etiqueta y emoji. Antes estaban
 * duplicadas y con labels divergentes en el wizard, settings y onboarding (página + ruta).
 */
export const BUSINESS_CATEGORIES = [
  { value: "BARBERSHOP", label: "Barbería", emoji: "✂️" },
  { value: "BEAUTY_SALON", label: "Salón de belleza", emoji: "💅" },
  { value: "VETERINARY", label: "Veterinaria", emoji: "🐾" },
  { value: "PSYCHOLOGY", label: "Psicología", emoji: "🧠" },
  { value: "DENTISTRY", label: "Odontología", emoji: "🦷" },
  { value: "MEDICINE", label: "Medicina general", emoji: "🩺" },
  { value: "FITNESS", label: "Fitness", emoji: "🏋️" },
  { value: "PHOTOGRAPHY", label: "Fotografía", emoji: "📸" },
  { value: "TUTORING", label: "Clases particulares", emoji: "📚" },
  { value: "MASSAGE", label: "Masajes / Spa", emoji: "💆" },
  { value: "OTHER", label: "Otros", emoji: "📋" },
] as const satisfies readonly { value: BusinessCategory; label: string; emoji: string }[];

/** Valores del enum BusinessCategory (para validar el input del onboarding). */
export const BUSINESS_CATEGORY_VALUES: BusinessCategory[] = BUSINESS_CATEGORIES.map((c) => c.value);

/** Lookup por valor → { label, emoji }. Indexable por string (con fallback a OTHER). */
export const CATEGORY_BY_VALUE: Record<string, { label: string; emoji: string }> =
  Object.fromEntries(BUSINESS_CATEGORIES.map((c) => [c.value, { label: c.label, emoji: c.emoji }]));
