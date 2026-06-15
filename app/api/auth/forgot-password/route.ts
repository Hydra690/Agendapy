import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { email } = (await request.json().catch(() => ({}))) as { email?: unknown };

    // Respuesta genérica SIEMPRE: no revelamos si el email existe (anti-enumeración).
    const generic = NextResponse.json({
      message: "Si el email está registrado, te enviamos un enlace para restablecer la contraseña.",
    });

    if (typeof email !== "string" || !email.includes("@")) return generic;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, password: true },
    });

    // Solo usuarios con contraseña (credenciales). Los de solo-Google no aplican.
    if (user?.password) {
      const token = await createToken("reset", email);
      await sendPasswordResetEmail(email.toLowerCase().trim(), token);
    }

    return generic;
  } catch (error) {
    logError("[forgot-password]", error);
    // Igual respondemos genérico para no filtrar nada.
    return NextResponse.json({
      message: "Si el email está registrado, te enviamos un enlace para restablecer la contraseña.",
    });
  }
}
