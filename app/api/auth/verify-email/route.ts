import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";
import { logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { token } = (await request.json().catch(() => ({}))) as { token?: unknown };

    if (typeof token !== "string" || !token) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }

    const email = await consumeToken("verify", token);
    if (!email) {
      return NextResponse.json(
        { error: "El enlace es inválido o expiró." },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    });

    return NextResponse.json({ message: "Email verificado correctamente." });
  } catch (error) {
    logError("[verify-email]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
