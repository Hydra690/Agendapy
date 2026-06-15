import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ServiceUpdateSchema, formatZodErrors } from "@/lib/validations";
import { requireUserId } from "@/lib/api-auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const u = await requireUserId();
  if ("response" in u) return u.response;
  const { userId } = u;

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
    where: { id, business: { ownerId: userId } },
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
  const u = await requireUserId();
  if ("response" in u) return u.response;
  const { userId } = u;

  const { id } = await params;

  const service = await prisma.service.findFirst({
    where: { id, business: { ownerId: userId } },
  });
  if (!service) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.service.update({ where: { id }, data: { isActive: false } });

  return NextResponse.json({ ok: true });
}
