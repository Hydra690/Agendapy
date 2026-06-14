import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    name?: string;
    duration?: string | number;
    price?: string | number | null;
    description?: string;
    isActive?: boolean;
  };

  const service = await prisma.service.findFirst({
    where: { id, business: { ownerId: session.user.id } },
  });
  if (!service) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const updated = await prisma.service.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.duration !== undefined && { duration: Number(body.duration) }),
      ...(body.price !== undefined && {
        price: body.price === "" || body.price === null ? null : Number(body.price),
      }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json({ service: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const service = await prisma.service.findFirst({
    where: { id, business: { ownerId: session.user.id } },
  });
  if (!service) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.service.update({ where: { id }, data: { isActive: false } });

  return NextResponse.json({ ok: true });
}
