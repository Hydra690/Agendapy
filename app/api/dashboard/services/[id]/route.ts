import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ServiceUpdateSchema, formatZodErrors } from "@/lib/validations";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = ServiceUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", fields: formatZodErrors(parsed.error.issues) },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const service = await prisma.service.findFirst({
    where: { id, business: { ownerId: session.user.id } },
  });
  if (!service) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const updated = await prisma.service.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.duration !== undefined && { duration: body.duration }),
      ...(body.price !== undefined && { price: body.price ?? null }),
      ...(body.description !== undefined && { description: body.description ?? null }),
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
