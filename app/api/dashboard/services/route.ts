import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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

  const body = await req.json() as { name?: string; duration?: string | number; price?: string | number | null; description?: string };
  const { name, duration, price, description } = body;

  if (!name?.trim() || !duration) {
    return NextResponse.json({ error: "Nombre y duración son requeridos" }, { status: 400 });
  }

  const business = await prisma.business.findFirst({ where: { ownerId: session.user.id } });
  if (!business) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });

  const service = await prisma.service.create({
    data: {
      businessId: business.id,
      name: name.trim(),
      duration: Number(duration),
      price: price !== undefined && price !== "" && price !== null ? Number(price) : null,
      description: description?.trim() || null,
    },
  });

  return NextResponse.json({ service }, { status: 201 });
}
