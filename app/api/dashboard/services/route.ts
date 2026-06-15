import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ServiceCreateSchema, formatZodErrors } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const business = await prisma.business.findFirst({ where: { ownerId: session.user.id } });
  if (!business) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });

  const services = await prisma.service.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ services });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

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

  const business = await prisma.business.findFirst({ where: { ownerId: session.user.id } });
  if (!business) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });

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
