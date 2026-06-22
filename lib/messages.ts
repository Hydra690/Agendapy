// Plantillas de texto de las notificaciones (WhatsApp). Funciones PURAS.
// Antes el armado de estos mensajes estaba duplicado inline en 3 route handlers
// (POST de reserva, cancelación self-service y cron de recordatorios). Centralizarlo
// acá da una sola fuente del tono/copy y deja la puerta abierta a sumar canales
// (email, SMS, push) sin tocar los handlers.
//
// La fecha legible ("lunes, 5 de enero") la calcula el caller con
// lib/format.formatDayMonth y se pasa ya formateada, para no acoplar el copy al
// formateo ni formatear dos veces (el caller también la usa en las variables de
// plantilla de Twilio).

interface OwnerBookingMessage {
  businessName: string;
  clientName: string;
  clientWhatsapp?: string | null;
  serviceName: string;
  fechaLegible: string;
  startTime: string;
}

/** Aviso al dueño: llegó una nueva reserva. */
export function ownerNewBookingMessage(b: OwnerBookingMessage): string {
  return (
    `🔔 *Nueva reserva en ${b.businessName}*\n\n` +
    `👤 ${b.clientName}${b.clientWhatsapp ? ` · ${b.clientWhatsapp}` : ""}\n` +
    `🛠️ ${b.serviceName}\n` +
    `📅 ${b.fechaLegible} a las ${b.startTime} hs`
  );
}

/** Aviso al dueño: el cliente canceló desde su link de gestión. */
export function ownerCancellationMessage(b: OwnerBookingMessage): string {
  return (
    `❌ *Reserva cancelada en ${b.businessName}*\n\n` +
    `👤 ${b.clientName}${b.clientWhatsapp ? ` · ${b.clientWhatsapp}` : ""}\n` +
    `🛠️ ${b.serviceName}\n` +
    `📅 ${b.fechaLegible} a las ${b.startTime} hs\n\n` +
    `El cliente canceló desde su link de gestión.`
  );
}

/** Recordatorio al cliente 24h antes del turno. */
export function clientReminderMessage(b: {
  clientName: string;
  businessName: string;
  serviceName: string;
  fechaLegible: string;
  startTime: string;
}): string {
  return (
    `👋 Hola ${b.clientName}! Te recordamos tu turno de mañana:\n\n` +
    `📍 *${b.businessName}*\n` +
    `🛠️ ${b.serviceName}\n` +
    `📅 ${b.fechaLegible} a las ${b.startTime} hs\n\n` +
    `¿Necesitás cancelar? Avisanos con tiempo. ¡Hasta mañana! 😊`
  );
}
