import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";
import { logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = (await request.json().catch(() => ({}))) as {
      token?: unknown;
      password?: unknown;
    };

    if (typeof token !== "string" || !token) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    const email = await consumeToken("reset", token);
    if (!email) {
      return NextResponse.json(
        { error: "El enlace es inválido o expiró. Pedí uno nuevo." },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email },
      data: { password: hashed },
    });

    return NextResponse.json({ message: "Contraseña actualizada. Ya podés iniciar sesión." });
  } catch (error) {
    logError("[reset-password]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
