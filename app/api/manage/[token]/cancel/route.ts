import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { notifyWhatsApp } from "@/lib/notify";
import { canCancelNow } from "@/lib/booking";
import { zonedToUtc } from "@/lib/timezone";
import { dateToISODate } from "@/lib/date";
import { formatDayMonth } from "@/lib/format";
import { ownerCancellationMessage } from "@/lib/messages";

// Cancelación self-service: el cliente, con el token de gestión de su reserva,
// puede cancelarla siempre que falte al menos `cancellationWindowHours` para el
// turno. No requiere sesión; el token (aleatorio, único) es la credencial.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { manageToken: token },
      include: {
        business: { select: { id: true, name: true, whatsapp: true, timezone: true, cancellationWindowHours: true } },
        service: { select: { name: true } },
        client: { select: { name: true, whatsapp: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    // Solo se cancelan reservas activas. Si ya está cancelada, lo tratamos como
    // idempotente (éxito) para no confundir al cliente que reintenta.
    if (booking.status === "CANCELLED") {
      return NextResponse.json({ ok: true, status: "CANCELLED", alreadyCancelled: true });
    }
    if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "NOT_CANCELLABLE", message: "Esta reserva ya no se puede cancelar." },
        { status: 409 }
      );
    }

    const appointment = zonedToUtc(
      dateToISODate(booking.date as Date),
      booking.startTime,
      booking.business.timezone
    );
    if (!canCancelNow(appointment, booking.business.cancellationWindowHours)) {
      return NextResponse.json(
        {
          error: "WINDOW_CLOSED",
          message:
            booking.business.cancellationWindowHours > 0
              ? `Solo se puede cancelar hasta ${booking.business.cancellationWindowHours} h antes del turno. Contactá al negocio.`
              : "El turno ya pasó o está en curso.",
        },
        { status: 409 }
      );
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: "Cancelada por el cliente",
      },
    });

    // Avisar al dueño por WhatsApp (no bloqueante, con registro persistido).
    if (booking.business.whatsapp) {
      const fechaLegible = formatDayMonth(dateToISODate(booking.date as Date));
      const ownerMsg = ownerCancellationMessage({
        businessName: booking.business.name,
        clientName: booking.client.name,
        clientWhatsapp: booking.client.whatsapp,
        serviceName: booking.service.name,
        fechaLegible,
        startTime: booking.startTime,
      });
      void notifyWhatsApp({
        bookingId: booking.id,
        to: booking.business.whatsapp,
        body: ownerMsg,
        type: "CANCELLATION",
      });
    }

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (error) {
    logError("[manage/cancel]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
