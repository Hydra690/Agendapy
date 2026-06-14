import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/twilio";
import { logInfo, logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const nowUtc = new Date();
    const tomorrowStart = new Date(
      Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate() + 1)
    );
    const tomorrowEnd = new Date(
      Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate() + 2)
    );

    const bookings = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        reminderSent: false,
        date: { gte: tomorrowStart, lt: tomorrowEnd },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        client: { select: { name: true, whatsapp: true } },
        service: { select: { name: true } },
        business: { select: { name: true, slug: true } },
      },
    });

    if (bookings.length === 0) {
      logInfo("[cron/reminders]", { processed: 0, total: 0 });
      return NextResponse.json({ processed: 0, total: 0 });
    }

    const results = await Promise.allSettled(
      bookings.map(async (booking: (typeof bookings)[number]) => {
        const dateStr = (booking.date as Date).toISOString().split("T")[0];
        const [y, m, d] = dateStr.split("-").map(Number);
        const fechaLegible = new Date(y, m - 1, d).toLocaleDateString("es-PY", {
          weekday: "long", day: "numeric", month: "long",
        });

        const message =
          `👋 Hola ${booking.client.name}! Te recordamos tu turno de mañana:\n\n` +
          `📍 *${booking.business.name}*\n` +
          `🛠️ ${booking.service.name}\n` +
          `📅 ${fechaLegible} a las ${booking.startTime} hs\n\n` +
          `¿Necesitás cancelar? Avisanos con tiempo. ¡Hasta mañana! 😊`;

        if (booking.client.whatsapp) {
          await sendWhatsApp(booking.client.whatsapp, message);
        }
      })
    );

    const sent = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    if (failed > 0) {
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          logError(`[cron/reminders] booking ${bookings[i].id}`, r.reason);
        }
      });
    }

    const ids = bookings.map((b) => b.id);
    await prisma.booking.updateMany({
      where: { id: { in: ids } },
      data: { reminderSent: true, reminderSentAt: new Date() },
    });

    logInfo("[cron/reminders] done", { sent, failed, total: bookings.length });
    return NextResponse.json({ sent, failed, total: bookings.length });
  } catch (error) {
    logError("[cron/reminders]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
