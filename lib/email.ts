// Email transaccional sin SDK (fetch a la API de Resend).
//
// Si RESEND_API_KEY no está seteada, NO se envía nada: se loguea el contenido a
// consola (modo desarrollo). Así el flujo de reset/verificación funciona end-to-end
// en local sin credenciales, y en producción solo hay que poner la API key.
//
// PRODUCCIÓN: Resend solo entrega desde un dominio VERIFICADO. Pasos:
//   1. Comprar el dominio y agregarlo en Resend (Domains → Add Domain).
//   2. Cargar los registros DNS que da Resend (SPF + DKIM, opcional DMARC).
//   3. Setear EMAIL_FROM con una casilla de ESE dominio (ej. "Agendapy <turnos@tudominio.com>").
// El default de abajo (agendapy.com.py) todavía NO está verificado en Resend: con
// una API key real Resend rechazará el envío hasta cargar los DNS (SPF + DKIM) del
// dominio (lo verás como fallo, ya no como éxito silencioso).

import { logError, logInfo, logWarn } from "@/lib/logger";
import { appBaseUrl as baseUrl } from "@/lib/url";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEFAULT_EMAIL_FROM = "Agendapy <no-reply@agendapy.com.py>";
const EMAIL_FROM = process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM;
const usingUnverifiedDefault = !process.env.EMAIL_FROM;
let warnedDefaultFrom = false;

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Distingue un envío real ("sent") de la simulación a consola en dev ("dev").
 * Sin RESEND_API_KEY no es un fallo (el flujo de reset/verificación debe seguir
 * funcionando en local), pero el caller puede saber que NO se envió de verdad.
 */
export interface EmailResult {
  delivered: boolean;
  mode: "sent" | "dev";
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  if (!RESEND_API_KEY) {
    // Dev: sin credenciales, mostramos el email en consola en vez de enviarlo.
    logWarn("[email] (dev, no enviado: falta RESEND_API_KEY)", { to: msg.to, subject: msg.subject });
    console.log(`\n──── EMAIL (dev) ────\nTo: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text ?? msg.html}\n─────────────────────\n`);
    return { delivered: false, mode: "dev" };
  }

  // Hay API key pero EMAIL_FROM quedó en el dominio default sin verificar →
  // Resend rechazará el envío. Lo avisamos (una vez) para que no se diagnostique
  // como un bug fantasma. No bloqueamos: el fallo real de Resend ya es visible.
  if (usingUnverifiedDefault && !warnedDefaultFrom) {
    warnedDefaultFrom = true;
    logWarn("[email] EMAIL_FROM no configurado: usando dominio default sin verificar en Resend", {
      from: DEFAULT_EMAIL_FROM,
    });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      ...(msg.text ? { text: msg.text } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }

  logInfo("[email] enviado", { to: msg.to, subject: msg.subject });
  return { delivered: true, mode: "sent" };
}

const wrap = (title: string, bodyHtml: string) =>
  `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#1A1A2E">
     <h2 style="color:#00C48C">${title}</h2>${bodyHtml}
     <p style="font-size:12px;color:#8888aa;margin-top:32px">Agendapy · turnos online</p>
   </div>`;

export async function sendPasswordResetEmail(to: string, token: string): Promise<EmailResult> {
  const url = `${baseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    return await sendEmail({
      to,
      subject: "Restablecé tu contraseña — Agendapy",
      text: `Restablecé tu contraseña entrando a: ${url}\n\nSi no lo pediste, ignorá este mensaje. El enlace vence en 1 hora.`,
      html: wrap(
        "Restablecé tu contraseña",
        `<p>Hacé clic para elegir una nueva contraseña. El enlace vence en 1 hora.</p>
         <p><a href="${url}" style="background:#00C48C;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Restablecer contraseña</a></p>
         <p style="font-size:12px;color:#8888aa">Si no lo pediste, ignorá este mensaje.</p>`
      ),
    });
  } catch (e) {
    logError("[email] reset", e, { to });
    throw e;
  }
}

export async function sendVerificationEmail(to: string, token: string): Promise<EmailResult> {
  const url = `${baseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  try {
    return await sendEmail({
      to,
      subject: "Verificá tu email — Agendapy",
      text: `Verificá tu cuenta entrando a: ${url}`,
      html: wrap(
        "Verificá tu email",
        `<p>Confirmá tu dirección para activar tu cuenta.</p>
         <p><a href="${url}" style="background:#00C48C;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Verificar email</a></p>`
      ),
    });
  } catch (e) {
    logError("[email] verify", e, { to });
    throw e;
  }
}

export interface BookingConfirmationData {
  clientName: string;
  businessName: string;
  serviceName: string;
  fechaLegible: string;
  startTime: string;
  manageUrl?: string | null;
}

/**
 * Confirmación de reserva al cliente. Devuelve EmailResult: sin RESEND_API_KEY no
 * envía de verdad (mode:"dev", delivered:false) — el caller registra el intento como
 * no-enviado, nunca como éxito. Lanza si Resend rechaza (dominio sin verificar, etc.).
 */
export async function sendBookingConfirmationEmail(
  to: string,
  data: BookingConfirmationData
): Promise<EmailResult> {
  const manageLine = data.manageUrl
    ? `\n\nGestioná o cancelá tu reserva: ${data.manageUrl}`
    : "";
  const manageHtml = data.manageUrl
    ? `<p><a href="${data.manageUrl}" style="color:#00C48C">Gestionar mi reserva</a></p>`
    : "";
  try {
    return await sendEmail({
      to,
      subject: `Tu reserva en ${data.businessName} — Agendapy`,
      text:
        `Hola ${data.clientName}! Tu reserva quedó registrada.\n\n` +
        `${data.serviceName}\n${data.fechaLegible} a las ${data.startTime} hs\n` +
        `Estado: pendiente de confirmación del negocio.${manageLine}`,
      html: wrap(
        "¡Reserva registrada!",
        `<p>Hola ${data.clientName}, tu reserva quedó registrada:</p>
         <p><strong>${data.serviceName}</strong><br>${data.fechaLegible} a las ${data.startTime} hs</p>
         <p style="color:#8888aa">Estado: pendiente de confirmación del negocio.</p>${manageHtml}`
      ),
    });
  } catch (e) {
    logError("[email] booking confirmation", e, { to });
    throw e;
  }
}
