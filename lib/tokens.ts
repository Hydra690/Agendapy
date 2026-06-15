// Tokens de un solo uso para reset de contraseña y verificación de email.
// Reutiliza la tabla VerificationToken de NextAuth (identifier, token, expires).
// Para distinguir el propósito, prefijamos el identifier: "reset:<email>" / "verify:<email>".

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export type TokenPurpose = "reset" | "verify";

const TTL: Record<TokenPurpose, number> = {
  reset: 60 * 60 * 1000, // 1 hora
  verify: 24 * 60 * 60 * 1000, // 24 horas
};

function identifierFor(purpose: TokenPurpose, email: string): string {
  return `${purpose}:${email.toLowerCase().trim()}`;
}

/** Crea (o reemplaza) un token para el email+propósito y devuelve su valor. */
export async function createToken(purpose: TokenPurpose, email: string): Promise<string> {
  const identifier = identifierFor(purpose, email);
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TTL[purpose]);

  // Invalidamos tokens previos del mismo propósito para este email.
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({ data: { identifier, token, expires } });

  return token;
}

/**
 * Valida y CONSUME un token (un solo uso). Devuelve el email si es válido y no
 * expiró, o null en caso contrario.
 */
export async function consumeToken(purpose: TokenPurpose, token: string): Promise<string | null> {
  const row = await prisma.verificationToken.findUnique({ where: { token } });
  if (!row) return null;

  const prefix = `${purpose}:`;
  if (!row.identifier.startsWith(prefix)) return null;

  // Borrar siempre (un solo uso), incluso si está vencido.
  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});

  if (row.expires < new Date()) return null;

  return row.identifier.slice(prefix.length);
}
