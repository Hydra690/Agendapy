// Envío de WhatsApp + persistencia del intento en BookingNotification.
//
// Antes los envíos eran fire-and-forget a ciegas: no quedaba registro de si
// llegaron. Ahora cada intento (éxito o fallo) se guarda, lo que da auditoría y
// habilita reintentos futuros. Sigue siendo no-bloqueante para el request.

import { prisma } from "@/lib/prisma";
import { sendWhatsApp, type WhatsAppOptions } from "@/lib/twilio";
import type { EmailResult } from "@/lib/email";
import { logError } from "@/lib/logger";

export type NotificationType = "CONFIRMATION" | "REMINDER_24H" | "CANCELLATION" | "NEW_BOOKING_OWNER";

interface NotifyArgs {
  bookingId: string;
  to: string;
  body: string;
  type: NotificationType;
  options?: WhatsAppOptions;
}

/**
 * Envía un WhatsApp ligado a una reserva y registra el resultado.
 * Devuelve true si se envió, false si falló (no lanza: pensado para fire-and-forget).
 */
export async function notifyWhatsApp({ bookingId, to, body, type, options }: NotifyArgs): Promise<boolean> {
  let success = false;
  let error: string | null = null;

  try {
    await sendWhatsApp(to, body, options);
    success = true;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    logError("[notify] whatsapp", e, { bookingId, type });
  }

  try {
    await prisma.bookingNotification.create({
      data: { bookingId, type, channel: "WHATSAPP", success, error },
    });
  } catch (e) {
    // El registro no debe romper el flujo principal.
    logError("[notify] persist", e, { bookingId, type });
  }

  return success;
}

interface NotifyEmailArgs {
  bookingId: string;
  type: NotificationType;
  // Thunk que hace el envío (ej. sendBookingConfirmationEmail). Se inyecta para no
  // acoplar notify a cada plantilla concreta de email.
  send: () => Promise<EmailResult>;
}

/**
 * Envía un email ligado a una reserva y registra el resultado en BookingNotification
 * (channel EMAIL). Igual que notifyWhatsApp: no lanza (fire-and-forget) y NUNCA reporta
 * éxito si no se envió de verdad — el modo "dev" sin RESEND_API_KEY se registra como
 * no-enviado (success=false), no como éxito silencioso.
 */
export async function notifyEmail({ bookingId, type, send }: NotifyEmailArgs): Promise<boolean> {
  let success = false;
  let error: string | null = null;

  try {
    const result = await send();
    success = result.delivered;
    if (!result.delivered) error = `no enviado (modo ${result.mode})`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    logError("[notify] email", e, { bookingId, type });
  }

  try {
    await prisma.bookingNotification.create({
      data: { bookingId, type, channel: "EMAIL", success, error },
    });
  } catch (e) {
    logError("[notify] persist", e, { bookingId, type });
  }

  return success;
}
