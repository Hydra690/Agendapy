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

export function formatZodErrors(issues: z.ZodIssue[]): Record<string, string> {
  return Object.fromEntries(issues.map((i) => [i.path.join("."), i.message]));
}
