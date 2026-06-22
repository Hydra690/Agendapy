import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { RescheduleSchema, formatZodErrors } from "@/lib/validations";
import { parseDateUTC } from "@/lib/date";
import { performReschedule, rescheduleErrorResponse } from "@/lib/reschedule";

// Reprogramación desde el dashboard: acción del dueño. Requiere sesión y que el
// negocio (slug) le pertenezca. A diferencia del self-service, no aplica la ventana
// de cancelación (el dueño puede mover un turno aunque esté próximo).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; bookingId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { slug, bookingId } = await params;

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

    const business = await prisma.business.findUnique({
      where: { slug },
      select: { id: true, ownerId: true, name: true, whatsapp: true, timezone: true, minBookingNoticeMinutes: true },
    });
    if (!business || business.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { service: { select: { id: true, name: true, duration: true, bufferMinutes: true } } },
    });
    if (!booking || booking.businessId !== business.id) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "NOT_RESCHEDULABLE", message: "Esta reserva ya no se puede reprogramar." },
        { status: 409 }
      );
    }

    const updated = await performReschedule({
      booking: { id: booking.id, date: booking.date as Date, startTime: booking.startTime, manageToken: booking.manageToken },
      business,
      service: booking.service,
      newDate,
      newDateParam: date,
      newStartTime: startTime,
      requestedStaffId: staffId,
    });

    return NextResponse.json({ booking: updated });
  } catch (error) {
    const mapped = rescheduleErrorResponse(error);
    if (mapped) return mapped;
    logError("[bookings:reschedule]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
