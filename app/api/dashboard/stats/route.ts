import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { requireBusiness } from "@/lib/api-auth";
import { canUseFeature } from "@/lib/plan";

function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(d);
  start.setDate(d.getDate() - dow);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()));
    const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    const thisWeek = getWeekBounds(now);
    const prevWeekStart = new Date(thisWeek.start);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Gating por feature: los conteos básicos van en todos los tiers; ingresos/
    // hora pico/top servicio son BASIC+ ("stats"); clientes perdidos es PRO
    // ("retentionAnalytics"). Las queries premium ni se corren si no aplican.
    const canStats = canUseFeature(business, "stats");
    const canRetention = canUseFeature(business, "retentionAnalytics");

    const [monthBookings, twoWeekBookings, lostClients] = await Promise.all([
      prisma.booking.findMany({
        where: {
          businessId: business.id,
          date: { gte: startDate, lt: endDate },
        },
        select: {
          status: true,
          startTime: true,
          service: { select: { price: true, name: true } },
        },
      }),
      canStats
        ? prisma.booking.findMany({
            where: {
              businessId: business.id,
              date: { gte: prevWeekStart, lt: thisWeek.end },
              status: { in: ["CONFIRMED", "COMPLETED"] },
            },
            select: {
              date: true,
              service: { select: { price: true } },
            },
          })
        : Promise.resolve([]),
      canRetention
        ? prisma.client.count({
            where: {
              businessId: business.id,
              bookings: {
                every: { date: { lt: thirtyDaysAgo } },
                some: { status: "COMPLETED" },
              },
            },
          })
        : Promise.resolve(null),
    ]);

    // Month stats
    const total = monthBookings.length;
    const pending = monthBookings.filter(b => b.status === "PENDING").length;
    const confirmed = monthBookings.filter(b => b.status === "CONFIRMED").length;
    const completed = monthBookings.filter(b => b.status === "COMPLETED").length;
    const cancelled = monthBookings.filter(b => b.status === "CANCELLED").length;

    const estimatedRevenue = monthBookings
      .filter(b => b.status === "CONFIRMED" || b.status === "COMPLETED")
      .reduce((sum, b) => sum + (b.service.price ?? 0), 0);

    // Top service (non-cancelled)
    const serviceCounts: Record<string, number> = {};
    for (const b of monthBookings) {
      if (b.status !== "CANCELLED") {
        serviceCounts[b.service.name] = (serviceCounts[b.service.name] ?? 0) + 1;
      }
    }
    const topService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Busiest hour (non-cancelled)
    const hourCounts: Record<string, number> = {};
    for (const b of monthBookings) {
      if (b.status !== "CANCELLED") {
        const hour = b.startTime.slice(0, 2);
        hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
      }
    }
    const busiestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Week revenue
    const weekRevenue = twoWeekBookings
      .filter(b => new Date(b.date) >= thisWeek.start && new Date(b.date) < thisWeek.end)
      .reduce((sum, b) => sum + (b.service.price ?? 0), 0);

    const prevWeekRevenue = twoWeekBookings
      .filter(b => new Date(b.date) >= prevWeekStart && new Date(b.date) < thisWeek.start)
      .reduce((sum, b) => sum + (b.service.price ?? 0), 0);

    return NextResponse.json({
      // Conteos básicos: todos los tiers.
      total, pending, confirmed, completed, cancelled, month, year,
      // Métricas premium (BASIC+): null si el tier no las incluye → la UI muestra upsell.
      estimatedRevenue: canStats ? estimatedRevenue : null,
      topService: canStats ? topService : null,
      busiestHour: canStats && busiestHour ? `${busiestHour}:00` : null,
      weekRevenue: canStats ? weekRevenue : null,
      prevWeekRevenue: canStats ? prevWeekRevenue : null,
      // Retención (PRO): lostClients ya viene null si no aplica.
      lostClients,
      features: { stats: canStats, retentionAnalytics: canRetention },
    });
  } catch (error) {
    logError("[stats]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
