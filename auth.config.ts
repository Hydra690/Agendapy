import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      // NextAuth v5 infiere AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET por defecto; mapeamos
      // explícito a los nombres GOOGLE_CLIENT_* que usa el proyecto (.env / Vercel).
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // NO auto-vinculamos por email (allowDangerousEmailAccountLinking queda en su
      // default `false`). Si alguien con cuenta de credenciales entra con Google del
      // mismo email, NextAuth devuelve OAuthAccountNotLinked en vez de fusionar. Esto
      // cierra un vector de toma de cuenta: un atacante podría haber creado una cuenta
      // de credenciales (sin verificar) con el email de la víctima y heredar acceso
      // cuando la víctima entra con Google.
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/onboarding");

      if (isProtected && !isLoggedIn) {
        return false;
      }
      return true;
    },
  },
};
