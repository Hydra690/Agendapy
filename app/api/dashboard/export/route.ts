import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { canUseFeature } from "@/lib/plan";
import { requireBusiness, apiError } from "@/lib/api-auth";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  COMPLETED: "Completado",
  NO_SHOW: "No asistió",
};

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()));
    const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));

    if (!canUseFeature(business, "export")) {
      return apiError.planRequired("export", "El export de CSV es una función del plan. Activá tu plan para acceder.");
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    const bookings = await prisma.booking.findMany({
      where: {
        businessId: business.id,
        date: { gte: startDate, lt: endDate },
      },
      select: {
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        notes: true,
        client: { select: { name: true, whatsapp: true } },
        service: { select: { name: true, duration: true, price: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;

    const rows = [
      ["Fecha", "Hora inicio", "Hora fin", "Estado", "Cliente", "WhatsApp", "Servicio", "Duración (min)", "Precio (Gs)", "Notas"].map(escape).join(","),
      ...bookings.map(b => [
        (b.date as Date).toISOString().split("T")[0],
        b.startTime,
        b.endTime,
        STATUS_LABEL[b.status] ?? b.status,
        b.client.name,
        b.client.whatsapp ?? "",
        b.service.name,
        String(b.service.duration),
        b.service.price != null ? String(b.service.price) : "",
        b.notes ?? "",
      ].map(escape).join(",")),
    ];

    const csv = "﻿" + rows.join("\n"); // BOM para Excel
    const monthPadded = String(month).padStart(2, "0");
    const filename = `reservas-${year}-${monthPadded}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logError("[export]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
