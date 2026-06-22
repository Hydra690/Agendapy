import { z } from "zod";
import { DAYS_OF_WEEK } from "@/lib/constants";

export const BookingSchema = z.object({
  // Servicios del turno (1..N). El primero es el principal. El route normaliza el
  // legacy `serviceId` (single) a este array antes de validar.
  serviceIds: z.array(z.string().min(1)).min(1, "Elegí al menos un servicio").max(10),
  // Profesional elegido (opcional). Si falta, el sistema asigna uno libre ("cualquiera").
  staffId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date debe tener formato YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime debe tener formato HH:mm"),
  clientName: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100).trim(),
  clientWhatsapp: z
    .string()
    .regex(/^\d{7,15}$/, "clientWhatsapp debe contener solo dígitos (7-15 caracteres)"),
  // Email opcional del cliente: habilita la confirmación por email (canal aparte del
  // WhatsApp). "" → undefined para no guardar strings vacíos en el cliente.
  clientEmail: z
    .string()
    .trim()
    .email("Email inválido")
    .max(120)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: z.string().max(500).optional(),
});

// Reprogramación de un turno (self-service por token o desde el dashboard).
export const RescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date debe tener formato YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime debe tener formato HH:mm"),
  // Profesional elegido (opcional). Si falta, se reasigna uno libre ("cualquiera").
  staffId: z.string().min(1).optional(),
});

export const SlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date debe tener formato YYYY-MM-DD"),
  // El route arma este array desde el query (?serviceIds=a,b o ?serviceId=a).
  serviceIds: z.array(z.string().min(1)).min(1, "Elegí al menos un servicio").max(10),
});

export const MyBookingsQuerySchema = z.object({
  whatsapp: z
    .string()
    .regex(/^\d{7,15}$/, "whatsapp debe contener solo dígitos (7-15 caracteres)"),
});

// PATCH /api/dashboard/business — edición de datos del negocio.
// Los campos opcionales se normalizan: "" → undefined para no guardar strings vacíos.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalHttpUrl = z
  .string()
  .trim()
  .url("Debe ser una URL válida (https://...)")
  .max(2048)
  .refine((u) => /^https?:\/\//i.test(u), "La URL debe empezar con http:// o https://")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const BusinessUpdateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido.").max(120),
  description: optionalText(500),
  address: optionalText(200),
  phone: optionalText(30),
  whatsapp: optionalText(30),
  logoUrl: optionalHttpUrl,
  coverUrl: optionalHttpUrl,
  instagram: optionalText(60),
  facebook: optionalText(200),
  // Horas mínimas de antelación con que el cliente puede cancelar online (0-168).
  cancellationWindowHours: z.coerce.number().int().min(0).max(168).optional(),
  // Antelación mínima para reservar, en minutos (0 = solo bloquea horas pasadas).
  // Máx 10080 min = 7 días.
  minBookingNoticeMinutes: z.coerce.number().int().min(0).max(10080).optional(),
});

// Servicios del dashboard
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Buffer (colchón tras el turno) en minutos. 0–120, opcional.
const bufferMinutes = z.coerce.number().int().min(0, "El buffer no puede ser negativo").max(120, "Máximo 120 minutos").optional();

export const ServiceCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(120),
  duration: z.coerce.number().int("La duración debe ser un número entero").min(5, "Mínimo 5 minutos").max(1440),
  bufferMinutes,
  price: z.coerce.number().int().min(0).max(1_000_000_000).nullish(),
  description: z.string().trim().max(500).optional().transform((v) => (v ? v : undefined)),
});

export const ServiceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  duration: z.coerce.number().int().min(5).max(1440).optional(),
  bufferMinutes,
  price: z.coerce.number().int().min(0).max(1_000_000_000).nullish(),
  description: z.string().trim().max(500).nullish(),
  isActive: z.boolean().optional(),
});

// Staff (profesionales del negocio)
export const StaffCreateSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(120),
  role: z.string().trim().max(80).optional().transform((v) => (v ? v : undefined)),
  phone: z.string().trim().max(30).optional().transform((v) => (v ? v : undefined)),
  // IDs de servicios que puede hacer (relación StaffServices). Vacío = todos.
  serviceIds: z.array(z.string().min(1)).max(100).optional(),
});

export const StaffUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.string().trim().max(80).nullish(),
  phone: z.string().trim().max(30).nullish(),
  isActive: z.boolean().optional(),
  serviceIds: z.array(z.string().min(1)).max(100).optional(),
});

// Disponibilidad semanal (PUT). Cada día puede tener MÚLTIPLES intervalos
// (turno partido / pausa de almuerzo). Los días salen de lib/constants (fuente única).

const IntervalSchema = z
  .object({
    startTime: z.string().regex(HHMM, "Hora inválida (HH:mm)"),
    endTime: z.string().regex(HHMM, "Hora inválida (HH:mm)"),
  })
  .refine((i) => i.startTime < i.endTime, {
    message: "La hora de inicio debe ser anterior al cierre",
    path: ["startTime"],
  });

/** ¿Algún par de intervalos se solapa? (comparación lexicográfica de "HH:mm"). */
function intervalsOverlap(intervals: { startTime: string; endTime: string }[]): boolean {
  const sorted = [...intervals].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startTime < sorted[i - 1].endTime) return true;
  }
  return false;
}

export const AvailabilityPutSchema = z.object({
  // Si viene, el horario es de ESE profesional; si no, es el horario del negocio.
  staffId: z.string().min(1).optional(),
  schedule: z
    .array(
      z
        .object({
          dayOfWeek: z.enum(DAYS_OF_WEEK),
          isActive: z.boolean(),
          intervals: z.array(IntervalSchema).max(6),
        })
        .refine((d) => !d.isActive || d.intervals.length >= 1, {
          message: "Un día activo necesita al menos un intervalo",
          path: ["intervals"],
        })
        .refine((d) => !intervalsOverlap(d.intervals), {
          message: "Los intervalos del día no pueden solaparse",
          path: ["intervals"],
        })
    )
    .min(1)
    .max(7),
});

export function formatZodErrors(issues: z.ZodIssue[]): Record<string, string> {
  return Object.fromEntries(issues.map((i) => [i.path.join("."), i.message]));
}
