"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

const S = {
  page: { minHeight: "100dvh", background: "#F5F7FA", display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", padding: "24px 16px" },
  card: { background: "#fff", borderRadius: 16, boxShadow: "0 8px 30px rgba(0,0,0,0.08)", padding: "40px 36px", width: "100%", maxWidth: 420, textAlign: "center" as const },
  logo: { marginBottom: 24, fontSize: "1.6rem", fontWeight: 800, color: "#1A1A2E", letterSpacing: "-0.5px" },
  accent: { color: "#00C48C" },
  msg: { fontSize: "1rem", color: "#1A1A2E", margin: "12px 0 20px" },
  link: { color: "#00C48C", fontWeight: 600, textDecoration: "none" },
};

function Verifier() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    // setState síncrono intencional: marca error inmediato si falta el token.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!token) { setState("error"); return; }
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        setState(res.ok ? "ok" : "error");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  if (state === "loading") return <p style={S.msg}>Verificando tu email…</p>;
  if (state === "ok")
    return (
      <>
        <p style={S.msg}>✅ ¡Tu email fue verificado!</p>
        <Link href="/login" style={S.link}>Iniciar sesión →</Link>
      </>
    );
  return (
    <>
      <p style={S.msg}>❌ El enlace es inválido o expiró.</p>
      <Link href="/login" style={S.link}>Ir a iniciar sesión</Link>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className={jakarta.className} style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>agenda<span style={S.accent}>py</span></div>
        <Suspense fallback={<p style={S.msg}>Verificando…</p>}>
          <Verifier />
        </Suspense>
      </div>
    </div>
  );
}
