import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { requireBusiness } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    const sp = new URL(request.url).searchParams;
    const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "200", 10) || 200, 1), 500);
    const offset = Math.max(parseInt(sp.get("offset") ?? "0", 10) || 0, 0);

    const [total, reviews] = await Promise.all([
      prisma.review.count({ where: { businessId: business.id } }),
      prisma.review.findMany({
        where: { businessId: business.id },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
    ]);

    return NextResponse.json({ reviews, total, limit, offset });
  } catch (error) {
    logError("[dashboard/reviews] GET", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireBusiness();
    if ("response" in ctx) return ctx.response;
    const { business } = ctx;

    const body = await request.json() as { id: string; action: "APPROVE" | "REJECT" };

    if (!body.id || !["APPROVE", "REJECT"].includes(body.action)) {
      return NextResponse.json(
        { error: "Se requiere id y action (APPROVE|REJECT)" },
        { status: 400 }
      );
    }

    const existing = await prisma.review.findFirst({
      where: { id: body.id, businessId: business.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Reseña no encontrada" }, { status: 404 });
    }

    const updated = await prisma.review.update({
      where: { id: body.id },
      data: { status: body.action === "APPROVE" ? "APPROVED" : "REJECTED" },
    });

    return NextResponse.json({ review: updated });
  } catch (error) {
    logError("[dashboard/reviews] PATCH", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
