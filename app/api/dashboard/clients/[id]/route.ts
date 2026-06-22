import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { requireBusiness, apiError } from "@/lib/api-auth";
import { canUseFeature } from "@/lib/plan";
import { serviceNames, servicesTotalPrice } from "@/lib/booking-summary";

const CRM_UPSELL = "El detalle e historial de clientes es una función del plan. Activá un plan para acceder.";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    if (!canUseFeature(business, "clientsCrm")) {
      return apiError.planRequired("clientsCrm", CRM_UPSELL);
    }

    const { id } = await params;

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
            services: { select: { service: { select: { name: true, price: true } } } },
          },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    // `service` por reserva = resumen del turno (nombres unidos + precio total).
    const bookings = client.bookings.map(({ services, ...rest }) => {
      const svcs = services.map((bs) => bs.service);
      return { ...rest, service: { name: serviceNames(svcs), price: servicesTotalPrice(svcs) } };
    });

    return NextResponse.json({ client: { ...client, bookings } });
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
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    if (!canUseFeature(business, "clientsCrm")) {
      return apiError.planRequired("clientsCrm", CRM_UPSELL);
    }

    const { id } = await params;
    const body = await request.json() as { notes?: string };

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
