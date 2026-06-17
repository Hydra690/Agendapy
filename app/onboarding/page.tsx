"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

const CATEGORIES = [
  { value: "BARBERSHOP", label: "✂️ Barbería" },
  { value: "BEAUTY_SALON", label: "💅 Salón de belleza" },
  { value: "VETERINARY", label: "🐾 Veterinaria" },
  { value: "PSYCHOLOGY", label: "🧠 Psicología" },
  { value: "DENTISTRY", label: "🦷 Odontología" },
  { value: "MEDICINE", label: "🩺 Medicina" },
  { value: "FITNESS", label: "🏋️ Fitness" },
  { value: "PHOTOGRAPHY", label: "📸 Fotografía" },
  { value: "TUTORING", label: "📚 Clases particulares" },
  { value: "MASSAGE", label: "💆 Masajes" },
  { value: "OTHER", label: "📋 Otro" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const S = {
  page: { minHeight: "100dvh", background: "#F5F7FA", display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", padding: "24px 16px" },
  card: { background: "#fff", borderRadius: 16, boxShadow: "0 8px 30px rgba(0,0,0,0.08)", padding: "40px 36px", width: "100%", maxWidth: 480 },
  logo: { textAlign: "center" as const, marginBottom: 28, fontSize: "1.6rem", fontWeight: 800, color: "#1A1A2E", letterSpacing: "-0.5px" },
  accent: { color: "#00C48C" },
  title: { fontSize: "1.4rem", fontWeight: 800, color: "#1A1A2E", margin: "0 0 4px", letterSpacing: "-0.3px" },
  subtitle: { fontSize: "0.9rem", color: "#4A4A6A", margin: "0 0 24px" },
  label: { display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#1A1A2E", marginBottom: 6 },
  input: { width: "100%", padding: "12px 14px", border: "1.5px solid #E8EAF0", borderRadius: 10, fontSize: "0.95rem", color: "#1A1A2E", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const, marginBottom: 16 },
  select: { width: "100%", padding: "12px 14px", border: "1.5px solid #E8EAF0", borderRadius: 10, fontSize: "0.95rem", color: "#1A1A2E", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const, marginBottom: 16, background: "#fff", cursor: "pointer" },
  slugPreview: { fontSize: "0.8rem", color: "#4A4A6A", background: "#F5F7FA", borderRadius: 6, padding: "6px 10px", marginTop: -10, marginBottom: 16, fontFamily: "monospace" },
  btn: { display: "block", width: "100%", padding: 14, background: "#00C48C", color: "#fff", border: "none", borderRadius: 10, fontSize: "1rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 8 },
  btnDisabled: { opacity: 0.6, cursor: "not-allowed" as const },
  error: { background: "#FFF0F0", border: "1px solid #FFCCCC", color: "#CC0000", borderRadius: 8, padding: "10px 14px", fontSize: "0.88rem", marginBottom: 16 },
};

export default function OnboardingPage() {
  const { status } = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [category, setCategory] = useState("BARBERSHOP");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/dashboard/business")
      .then(r => { if (r.ok) router.push("/dashboard"); })
      .catch(() => {});
  }, [status, router]);

  function handleNameChange(val: string) {
    setName(val);
    if (!slugEdited) setSlug(slugify(val));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, category, whatsapp }),
      });
      const data = await res.json() as { error?: string };
      if (res.status === 409) { setSlugError(data.error ?? "Ese slug ya está en uso."); return; }
      if (!res.ok) { setError(data.error ?? "Error al crear el negocio."); return; }
      router.push("/dashboard");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") return null;

  const disabled = loading || !name || !slug || !category;

  return (
    <div className={jakarta.className} style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>agenda<span style={S.accent}>py</span></div>
        <h1 style={S.title}>Configurá tu negocio</h1>
        <p style={S.subtitle}>Solo toma 1 minuto — podés editarlo después</p>

        {error && <div style={S.error}>{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <label style={S.label} htmlFor="biz-name">Nombre del negocio</label>
          <input id="biz-name" style={S.input} type="text" placeholder="Ej: Barbería Roque" value={name} onChange={e => handleNameChange(e.target.value)} required />

          <label style={S.label} htmlFor="slug">URL de tu página</label>
          <input
            id="slug"
            style={S.input}
            type="text"
            placeholder="barberia-roque"
            value={slug}
            onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true); setSlugError(null); }}
            required
          />
          {slug && (
            <div style={S.slugPreview}>
              agendapy.com.py/<strong>{slug}</strong>
            </div>
          )}
          {slugError && <div style={{ ...S.error, marginTop: -8, marginBottom: 16 }}>{slugError}</div>}

          <label style={S.label} htmlFor="category">Categoría</label>
          <select id="category" style={S.select} value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <label style={S.label} htmlFor="whatsapp">WhatsApp (opcional)</label>
          <input id="whatsapp" style={S.input} type="tel" placeholder="Ej: 0981 123 456" value={whatsapp} onChange={e => setWhatsapp(e.target.value.replace(/\D/g, ""))} />

          <button type="submit" style={{ ...S.btn, ...(disabled ? S.btnDisabled : {}) }} disabled={disabled}>
            {loading ? "Creando negocio..." : "Crear mi negocio →"}
          </button>
        </form>
      </div>
    </div>
  );
}
