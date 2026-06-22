import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { RescheduleSchema, formatZodErrors } from "@/lib/validations";
import { parseDateUTC, dateToISODate } from "@/lib/date";
import { canCancelNow } from "@/lib/booking";
import { zonedToUtc } from "@/lib/timezone";
import { performReschedule, rescheduleErrorResponse } from "@/lib/reschedule";

// Reprogramación self-service: el cliente, con su token de gestión, mueve el turno
// a otro horario. Espeja la cancelación: no requiere sesión y respeta la ventana
// (solo se puede reprogramar mientras todavía se podría cancelar).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
    }

    const parsed = RescheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", fields: formatZodErrors(parsed.error.issues) },
        { status: 400 }
      );
    }
    const { date, startTime, staffId } = parsed.data;

    const newDate = parseDateUTC(date);
    if (!newDate) {
      return NextResponse.json({ error: "Formato de fecha inválido. Usá YYYY-MM-DD" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { manageToken: token },
      include: {
        business: {
          select: { id: true, name: true, whatsapp: true, timezone: true, minBookingNoticeMinutes: true, cancellationWindowHours: true },
        },
        service: { select: { id: true, name: true } },
        services: { select: { serviceId: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    // Solo reservas activas se pueden reprogramar.
    if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "NOT_RESCHEDULABLE", message: "Esta reserva ya no se puede reprogramar." },
        { status: 409 }
      );
    }

    // Misma ventana que la cancelación: si ya no se puede cancelar, tampoco mover.
    const appointment = zonedToUtc(dateToISODate(booking.date as Date), booking.startTime, booking.business.timezone);
    if (!canCancelNow(appointment, booking.business.cancellationWindowHours)) {
      return NextResponse.json(
        {
          error: "WINDOW_CLOSED",
          message:
            booking.business.cancellationWindowHours > 0
              ? `Solo se puede reprogramar hasta ${booking.business.cancellationWindowHours} h antes del turno. Contactá al negocio.`
              : "El turno ya pasó o está en curso.",
        },
        { status: 409 }
      );
    }

    const updated = await performReschedule({
      booking: {
        id: booking.id,
        date: booking.date as Date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        bufferMinutes: booking.bufferMinutes,
        manageToken: booking.manageToken,
        serviceIds: booking.services.map((s) => s.serviceId),
        serviceName: booking.service.name,
      },
      business: booking.business,
      newDate,
      newDateParam: date,
      newStartTime: startTime,
      requestedStaffId: staffId,
    });

    return NextResponse.json({
      ok: true,
      booking: { date, startTime: updated.startTime, endTime: updated.endTime, status: updated.status },
    });
  } catch (error) {
    const mapped = rescheduleErrorResponse(error);
    if (mapped) return mapped;
    logError("[manage/reschedule]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
