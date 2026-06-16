import { z } from "zod";

export const BookingSchema = z.object({
  serviceId: z.string().min(1, "serviceId es requerido"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date debe tener formato YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime debe tener formato HH:mm"),
  clientName: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100).trim(),
  clientWhatsapp: z
    .string()
    .regex(/^\d{7,15}$/, "clientWhatsapp debe contener solo dígitos (7-15 caracteres)"),
  notes: z.string().max(500).optional(),
});

export const SlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date debe tener formato YYYY-MM-DD"),
  serviceId: z.string().min(1, "serviceId es requerido"),
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
});

// Servicios del dashboard
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const ServiceCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(120),
  duration: z.coerce.number().int("La duración debe ser un número entero").min(5, "Mínimo 5 minutos").max(1440),
  price: z.coerce.number().int().min(0).max(1_000_000_000).nullish(),
  description: z.string().trim().max(500).optional().transform((v) => (v ? v : undefined)),
});

export const ServiceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  duration: z.coerce.number().int().min(5).max(1440).optional(),
  price: z.coerce.number().int().min(0).max(1_000_000_000).nullish(),
  description: z.string().trim().max(500).nullish(),
  isActive: z.boolean().optional(),
});

// Disponibilidad semanal (PUT)
const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

export const AvailabilityPutSchema = z.object({
  schedule: z
    .array(
      z
        .object({
          dayOfWeek: z.enum(DAYS),
          startTime: z.string().regex(HHMM, "Hora inválida (HH:mm)"),
          endTime: z.string().regex(HHMM, "Hora inválida (HH:mm)"),
          isActive: z.boolean(),
        })
        .refine((d) => !d.isActive || d.startTime < d.endTime, {
          message: "La hora de inicio debe ser anterior al cierre",
          path: ["startTime"],
        })
    )
    .min(1)
    .max(7),
});

export function formatZodErrors(issues: z.ZodIssue[]): Record<string, string> {
  return Object.fromEntries(issues.map((i) => [i.path.join("."), i.message]));
}
