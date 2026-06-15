import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      // NextAuth v5 infiere AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET por defecto; mapeamos
      // explícito a los nombres GOOGLE_CLIENT_* que usa el proyecto (.env / Vercel).
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Un usuario que se registró con email+contraseña y luego entra con Google
      // (mismo email) queda vinculado a la misma cuenta en vez de chocar.
      allowDangerousEmailAccountLinking: true,
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
