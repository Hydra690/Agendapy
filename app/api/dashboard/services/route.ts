import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ServiceCreateSchema, formatZodErrors } from "@/lib/validations";
import { requireBusiness, apiError } from "@/lib/api-auth";
import { serviceLimit } from "@/lib/plan";

export async function GET() {
  const ctx = await requireBusiness();
  if ("response" in ctx) return ctx.response;
  const { business } = ctx;

  const services = await prisma.service.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ services });
}

export async function POST(req: Request) {
  const ctx = await requireBusiness();
  if ("response" in ctx) return ctx.response;
  const { business } = ctx;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = ServiceCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", fields: formatZodErrors(parsed.error.issues) },
      { status: 400 }
    );
  }
  const { name, duration, bufferMinutes, price, description } = parsed.data;

  // Cuota de servicios del tier (FREE = 2; pagos = ilimitado). Cuenta activos.
  const limit = serviceLimit(business);
  if (limit !== null) {
    const active = await prisma.service.count({
      where: { businessId: business.id, isActive: true },
    });
    if (active >= limit) {
      return apiError.planRequired(
        "services",
        `El plan gratuito permite hasta ${limit} servicios. Activá un plan para agregar más.`
      );
    }
  }

  const service = await prisma.service.create({
    data: {
      businessId: business.id,
      name,
      duration,
      bufferMinutes: bufferMinutes ?? 0,
      price: price ?? null,
      description: description ?? null,
    },
  });

  return NextResponse.json({ service }, { status: 201 });
}
