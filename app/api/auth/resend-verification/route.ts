import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { email } = (await request.json().catch(() => ({}))) as { email?: unknown };

    // Respuesta genérica SIEMPRE: no revelamos si el email existe ni su estado
    // de verificación (anti-enumeración), igual que forgot-password.
    const generic = NextResponse.json({
      message: "Si el email está registrado y sin verificar, te reenviamos el enlace.",
    });

    if (typeof email !== "string" || !email.includes("@")) return generic;

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { password: true, emailVerified: true },
    });

    // Solo cuentas de credenciales aún sin verificar.
    if (user?.password && !user.emailVerified) {
      const token = await createToken("verify", normalizedEmail);
      await sendVerificationEmail(normalizedEmail, token);
    }

    return generic;
  } catch (error) {
    logError("[resend-verification]", error);
    return NextResponse.json({
      message: "Si el email está registrado y sin verificar, te reenviamos el enlace.",
    });
  }
}
