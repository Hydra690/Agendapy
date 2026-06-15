import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ServiceCreateSchema, formatZodErrors } from "@/lib/validations";
import { requireBusiness } from "@/lib/api-auth";

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
  const { name, duration, price, description } = parsed.data;

  const service = await prisma.service.create({
    data: {
      businessId: business.id,
      name,
      duration,
      price: price ?? null,
      description: description ?? null,
    },
  });

  return NextResponse.json({ service }, { status: 201 });
}
