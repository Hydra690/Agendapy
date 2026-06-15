"use client";

import { useState } from "react";
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
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setSent(true); // respuesta genérica de todos modos
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={jakarta.className} style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>agenda<span style={S.accent}>py</span></div>
        <h1 style={S.title}>Restablecer contraseña</h1>
        <p style={S.subtitle}>Te enviamos un enlace a tu email.</p>

        {sent ? (
          <>
            <div style={S.ok}>
              Si el email está registrado, te llegará un enlace para crear una nueva contraseña. Revisá tu bandeja.
            </div>
            <div style={S.footer}><a href="/login" style={S.link}>← Volver a iniciar sesión</a></div>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <label style={S.label} htmlFor="email">Email</label>
            <input id="email" style={S.input} type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            <button type="submit" style={{ ...S.btn, ...((loading || !email.includes("@")) ? S.btnDisabled : {}) }} disabled={loading || !email.includes("@")}>
              {loading ? "Enviando..." : "Enviar enlace"}
            </button>
            <div style={S.footer}><a href="/login" style={S.link}>← Volver</a></div>
          </form>
        )}
      </div>
    </div>
  );
}
