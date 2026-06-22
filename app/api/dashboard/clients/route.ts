import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { requireBusiness } from "@/lib/api-auth";
import { serviceNames } from "@/lib/booking-summary";

// Paginación acotada para no escanear sin límite cuando el negocio crece.
function parsePaging(url: string, defLimit: number, maxLimit: number) {
  const sp = new URL(url).searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? String(defLimit), 10) || defLimit, 1), maxLimit);
  const offset = Math.max(parseInt(sp.get("offset") ?? "0", 10) || 0, 0);
  return { limit, offset };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    const { limit, offset } = parsePaging(request.url, 100, 300);

    // Antes traíamos TODAS las reservas (con sus servicios) de cada cliente solo para
    // contar y tomar la última → costo de transferencia que crece con el historial.
    // Ahora: total por _count, ÚLTIMA reserva por take:1, y visitas (COMPLETED) por
    // una agregación groupBy. No se transfieren todas las filas.
    const [total, clients] = await Promise.all([
      prisma.client.count({ where: { businessId: business.id } }),
      prisma.client.findMany({
        where: { businessId: business.id },
        select: {
          id: true,
          name: true,
          whatsapp: true,
          notes: true,
          createdAt: true,
          _count: { select: { bookings: true } },
          bookings: {
            take: 1,
            orderBy: { date: "desc" },
            select: {
              date: true,
              services: { select: { service: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);

    // Visitas completadas por cliente (de la página), en una sola agregación.
    const pageIds = clients.map(c => c.id);
    const completedByClient = new Map<string, number>();
    if (pageIds.length > 0) {
      const grouped = await prisma.booking.groupBy({
        by: ["clientId"],
        where: { businessId: business.id, clientId: { in: pageIds }, status: "COMPLETED" },
        _count: { _all: true },
      });
      for (const g of grouped) completedByClient.set(g.clientId, g._count._all);
    }

    const enriched = clients.map(c => {
      const lastBooking = c.bookings[0];
      return {
        id: c.id,
        name: c.name,
        whatsapp: c.whatsapp,
        notes: c.notes,
        createdAt: c.createdAt,
        totalVisits: completedByClient.get(c.id) ?? 0,
        totalBookings: c._count.bookings,
        lastVisit: lastBooking?.date ?? null,
        lastService: lastBooking ? serviceNames(lastBooking.services.map((bs) => bs.service)) : null,
      };
    });

    return NextResponse.json({ clients: enriched, total, limit, offset });
  } catch (error) {
    logError("[dashboard/clients] GET", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
