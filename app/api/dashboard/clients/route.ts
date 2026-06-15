import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { requireBusiness } from "@/lib/api-auth";

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
        take: limit,
        skip: offset,
      }),
    ]);

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

    return NextResponse.json({ clients: enriched, total, limit, offset });
  } catch (error) {
    logError("[dashboard/clients] GET", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
