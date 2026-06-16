"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  divider: { display: "flex", alignItems: "center", gap: 10, margin: "20px 0", color: "#B0B3C1", fontSize: "0.82rem" },
  line: { flex: 1, height: 1, background: "#E8EAF0" },
  btnGoogle: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: 13, background: "#fff", color: "#1A1A2E", border: "1.5px solid #E8EAF0", borderRadius: 10, fontSize: "0.95rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  footer: { textAlign: "center" as const, marginTop: 22, fontSize: "0.88rem", color: "#4A4A6A" },
  link: { color: "#00C48C", fontWeight: 600, textDecoration: "none" },
  error: { background: "#FFF0F0", border: "1px solid #FFCCCC", color: "#CC0000", borderRadius: 8, padding: "10px 14px", fontSize: "0.88rem", marginBottom: 16 },
};

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Error al crear la cuenta."); return; }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) { router.push("/login"); return; }
      router.push("/onboarding");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || !name || !email || password.length < 8 || !confirm;

  return (
    <div className={jakarta.className} style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>agenda<span style={S.accent}>py</span></div>
        <h1 style={S.title}>Creá tu cuenta</h1>
        <p style={S.subtitle}>Empezá a gestionar tus turnos gratis</p>

        {error && <div style={S.error}>{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <label style={S.label} htmlFor="name">Nombre completo</label>
          <input id="name" style={S.input} type="text" placeholder="Juan Pérez" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />

          <label style={S.label} htmlFor="email">Email</label>
          <input id="email" style={S.input} type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />

          <label style={S.label} htmlFor="password">Contraseña</label>
          <input id="password" style={S.input} type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />

          <label style={S.label} htmlFor="confirm">Confirmar contraseña</label>
          <input id="confirm" style={{ ...S.input, marginBottom: 8 }} type="password" placeholder="Repetí la contraseña" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />

          <button type="submit" style={{ ...S.btn, ...(disabled ? S.btnDisabled : {}) }} disabled={disabled}>
            {loading ? "Creando cuenta..." : "Crear cuenta →"}
          </button>
        </form>

        <div style={S.divider}><span style={S.line} /> o continuá con <span style={S.line} /></div>

        <button style={S.btnGoogle} onClick={() => signIn("google", { callbackUrl: "/onboarding" })}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
          Continuar con Google
        </button>

        <div style={S.footer}>
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" style={S.link}>Iniciá sesión</Link>
        </div>
      </div>
    </div>
  );
}
