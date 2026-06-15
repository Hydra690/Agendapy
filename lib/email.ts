// Email transaccional sin SDK (fetch a la API de Resend).
//
// Si RESEND_API_KEY no está seteada, NO se envía nada: se loguea el contenido a
// consola (modo desarrollo). Así el flujo de reset/verificación funciona end-to-end
// en local sin credenciales, y en producción solo hay que poner la API key.

import { logError, logInfo } from "@/lib/logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "Agendapy <no-reply@agendapy.com>";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  if (!RESEND_API_KEY) {
    // Dev: sin credenciales, mostramos el email en consola en vez de enviarlo.
    logInfo("[email] (dev, no enviado)", { to: msg.to, subject: msg.subject, text: msg.text });
    console.log(`\n──── EMAIL (dev) ────\nTo: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text ?? msg.html}\n─────────────────────\n`);
    return;
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
}

function baseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}

const wrap = (title: string, bodyHtml: string) =>
  `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#1A1A2E">
     <h2 style="color:#00C48C">${title}</h2>${bodyHtml}
     <p style="font-size:12px;color:#8888aa;margin-top:32px">Agendapy · turnos online</p>
   </div>`;

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const url = `${baseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await sendEmail({
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

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const url = `${baseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  try {
    await sendEmail({
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
