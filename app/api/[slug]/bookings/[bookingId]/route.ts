import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

const VALID_STATUSES = ["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"] as const;
type PatchableStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; bookingId: string }> }
) {
  try {
    // Cambiar el estado de una reserva es una acción del dueño: requiere sesión
    // y que el negocio (slug) le pertenezca. Sin esto, cualquiera con el slug
    // público y el bookingId podría cancelar/confirmar reservas ajenas.
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { slug, bookingId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Cuerpo de la solicitud inválido" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Cuerpo de la solicitud inválido" },
        { status: 400 }
      );
    }

    const { status, cancellationReason } = body as Record<string, unknown>;

    if (typeof status !== "string" || !VALID_STATUSES.includes(status as PatchableStatus)) {
      return NextResponse.json(
        { error: `status inválido. Valores permitidos: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const business = await prisma.business.findUnique({
      where: { slug },
      select: { id: true, ownerId: true },
    });
    if (!business || business.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "Negocio no encontrado" },
        { status: 404 }
      );
    }

    const existing = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!existing || existing.businessId !== business.id) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 }
      );
    }

    const now = new Date();

    const timestampFields: {
      confirmedAt?: Date;
      cancelledAt?: Date;
      completedAt?: Date;
      cancellationReason?: string | null;
    } = {};

    if (status === "CONFIRMED") {
      timestampFields.confirmedAt = now;
    } else if (status === "CANCELLED") {
      timestampFields.cancelledAt = now;
      timestampFields.cancellationReason =
        typeof cancellationReason === "string" && cancellationReason.trim()
          ? cancellationReason.trim()
          : null;
    } else if (status === "COMPLETED") {
      timestampFields.completedAt = now;
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: status as PatchableStatus,
        ...timestampFields,
      },
      include: {
        service: { select: { id: true, name: true, duration: true, price: true } },
        client: { select: { id: true, name: true, whatsapp: true } },
      },
    });

    return NextResponse.json({ booking: updated });
  } catch (error) {
    logError("[bookings:PATCH]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
