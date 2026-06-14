import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    const business = await prisma.business.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Sin negocio" }, { status: 404 });
    }

    const client = await prisma.client.findFirst({
      where: { id, businessId: business.id },
      select: {
        id: true,
        name: true,
        whatsapp: true,
        email: true,
        notes: true,
        createdAt: true,
        bookings: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            status: true,
            notes: true,
            service: { select: { name: true, price: true, duration: true } },
          },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ client });
  } catch (error) {
    logError("[dashboard/clients/:id] GET", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json() as { notes?: string };

    const business = await prisma.business.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Sin negocio" }, { status: 404 });
    }

    const existing = await prisma.client.findFirst({
      where: { id, businessId: business.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const updated = await prisma.client.update({
      where: { id },
      data: { notes: body.notes?.trim() || null },
      select: { id: true, notes: true },
    });

    return NextResponse.json({ client: updated });
  } catch (error) {
    logError("[dashboard/clients/:id] PATCH", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
