"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

const S = {
  page: { minHeight: "100dvh", background: "#F5F7FA", display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", padding: "24px 16px" },
  card: { background: "#fff", borderRadius: 16, boxShadow: "0 8px 30px rgba(0,0,0,0.08)", padding: "40px 36px", width: "100%", maxWidth: 420 },
  logo: { textAlign: "center" as const, marginBottom: 28, fontSize: "1.6rem", fontWeight: 800, color: "#1A1A2E", letterSpacing: "-0.5px" },
  accent: { color: "#00C48C" },
  title: { fontSize: "1.4rem", fontWeight: 800, color: "#1A1A2E", margin: "0 0 4px", letterSpacing: "-0.3px" },
  subtitle: { fontSize: "0.9rem", color: "#4A4A6A", margin: "0 0 24px" },
  label: { display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#1A1A2E", marginBottom: 6 },
  input: { width: "100%", padding: "12px 14px", border: "1.5px solid #E8EAF0", borderRadius: 10, fontSize: "0.95rem", color: "#1A1A2E", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const, marginBottom: 16 },
  btn: { display: "block", width: "100%", padding: 14, background: "#00C48C", color: "#fff", border: "none", borderRadius: 10, fontSize: "1rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 4 },
  btnDisabled: { opacity: 0.6, cursor: "not-allowed" as const },
  footer: { textAlign: "center" as const, marginTop: 22, fontSize: "0.88rem", color: "#4A4A6A" },
  link: { color: "#00C48C", fontWeight: 600, textDecoration: "none" },
  ok: { background: "#EAFBF4", border: "1px solid #BDEFD9", color: "#0A7A52", borderRadius: 8, padding: "12px 14px", fontSize: "0.9rem", marginBottom: 16 },
  error: { background: "#FFF0F0", border: "1px solid #FFCCCC", color: "#CC0000", borderRadius: 8, padding: "10px 14px", fontSize: "0.88rem", marginBottom: 16 },
};

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "No se pudo restablecer."); return; }
      setDone(true);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <>
        <div style={S.error}>Enlace inválido. Pedí uno nuevo desde &quot;Olvidé mi contraseña&quot;.</div>
        <div style={S.footer}><Link href="/forgot-password" style={S.link}>Pedir enlace nuevo</Link></div>
      </>
    );
  }

  if (done) {
    return (
      <>
        <div style={S.ok}>¡Listo! Tu contraseña fue actualizada.</div>
        <div style={S.footer}><Link href="/login" style={S.link}>Iniciar sesión →</Link></div>
      </>
    );
  }

  const disabled = loading || password.length < 8 || confirm.length < 8;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <div style={S.error}>{error}</div>}
      <label style={S.label} htmlFor="password">Nueva contraseña</label>
      <input id="password" style={S.input} type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
      <label style={S.label} htmlFor="confirm">Repetir contraseña</label>
      <input id="confirm" style={S.input} type="password" placeholder="Repetí la contraseña" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
      <button type="submit" style={{ ...S.btn, ...(disabled ? S.btnDisabled : {}) }} disabled={disabled}>
        {loading ? "Guardando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className={jakarta.className} style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>agenda<span style={S.accent}>py</span></div>
        <h1 style={S.title}>Nueva contraseña</h1>
        <p style={S.subtitle}>Elegí una contraseña segura.</p>
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
