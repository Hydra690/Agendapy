import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Sin negocio" }, { status: 404 });
    }

    const clients = await prisma.client.findMany({
      where: { businessId: business.id },
      select: {
        id: true,
        name: true,
        whatsapp: true,
        notes: true,
        createdAt: true,
        bookings: {
          select: {
            date: true,
            status: true,
            service: { select: { name: true } },
          },
          orderBy: { date: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const enriched = clients.map(c => {
      const completed = c.bookings.filter(b => b.status === "COMPLETED").length;
      const lastBooking = c.bookings[0];
      return {
        id: c.id,
        name: c.name,
        whatsapp: c.whatsapp,
        notes: c.notes,
        createdAt: c.createdAt,
        totalVisits: completed,
        totalBookings: c.bookings.length,
        lastVisit: lastBooking?.date ?? null,
        lastService: lastBooking?.service.name ?? null,
      };
    });

    return NextResponse.json({ clients: enriched });
  } catch (error) {
    logError("[dashboard/clients] GET", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
