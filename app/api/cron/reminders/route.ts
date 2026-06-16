import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyWhatsApp } from "@/lib/notify";
import { logInfo, logError } from "@/lib/logger";
import { dateToISODate } from "@/lib/date";
import { addDaysYmd, tomorrowRange, ymdToUtcDate } from "@/lib/timezone";
import { canUseFeature } from "@/lib/plan";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Ventana amplia en UTC (hoy..+3 días) y luego filtramos por la tz de CADA
    // negocio para quedarnos solo con los turnos de "mañana" en su zona horaria.
    // "mañana" en distintas zonas cae siempre dentro de esta ventana.
    const utcTodayYmd = now.toISOString().split("T")[0];
    const windowStart = ymdToUtcDate(utcTodayYmd);
    const windowEnd = ymdToUtcDate(addDaysYmd(utcTodayYmd, 3));

    const candidates = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        reminderSent: false,
        date: { gte: windowStart, lt: windowEnd },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        client: { select: { name: true, whatsapp: true } },
        service: { select: { name: true } },
        business: {
          select: { name: true, timezone: true, plan: true, planExpiry: true, trialEndsAt: true },
        },
      },
    });

    // Quedarnos solo con los que son "mañana" en la tz de su negocio Y cuyo negocio
    // tenga la feature de recordatorios (BASIC+). Los planes FREE no reciben
    // recordatorios automáticos: alinea el costo de Twilio con el ingreso y es el
    // gancho de upgrade. (No marca reminderSent: simplemente no son candidatos.)
    const bookings = candidates.filter(
      (b) =>
        dateToISODate(b.date as Date) === tomorrowRange(b.business.timezone, now).ymd &&
        canUseFeature(b.business, "reminders")
    );

    if (bookings.length === 0) {
      logInfo("[cron/reminders]", { processed: 0, total: 0, candidates: candidates.length });
      return NextResponse.json({ processed: 0, total: 0 });
    }

    const templateSid = process.env.TWILIO_TEMPLATE_REMINDER_SID;

    const results = await Promise.all(
      bookings.map(async (booking) => {
        if (!booking.client.whatsapp) return false;

        const [y, m, d] = dateToISODate(booking.date as Date).split("-").map(Number);
        const fechaLegible = new Date(y, m - 1, d).toLocaleDateString("es-PY", {
          weekday: "long", day: "numeric", month: "long",
        });

        const message =
          `👋 Hola ${booking.client.name}! Te recordamos tu turno de mañana:\n\n` +
          `📍 *${booking.business.name}*\n` +
          `🛠️ ${booking.service.name}\n` +
          `📅 ${fechaLegible} a las ${booking.startTime} hs\n\n` +
          `¿Necesitás cancelar? Avisanos con tiempo. ¡Hasta mañana! 😊`;

        return notifyWhatsApp({
          bookingId: booking.id,
          to: booking.client.whatsapp,
          body: message,
          type: "REMINDER_24H",
          options: templateSid
            ? {
                contentSid: templateSid,
                contentVariables: {
                  "1": booking.client.name,
                  "2": booking.business.name,
                  "3": booking.service.name,
                  "4": `${fechaLegible} ${booking.startTime}`,
                },
              }
            : undefined,
        });
      })
    );

    // Solo marcamos como enviados los que efectivamente salieron; los fallidos
    // quedan con reminderSent=false para reintentarse en la próxima corrida.
    const sentIds = bookings.filter((_, i) => results[i]).map((b) => b.id);
    const sent = sentIds.length;
    const failed = bookings.length - sent;

    if (sentIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: sentIds } },
        data: { reminderSent: true, reminderSentAt: new Date() },
      });
    }

    logInfo("[cron/reminders] done", { sent, failed, total: bookings.length });
    return NextResponse.json({ sent, failed, total: bookings.length });
  } catch (error) {
    logError("[cron/reminders]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
