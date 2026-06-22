"use client";

import { useRef, useState } from "react";
import styles from "./settings.module.css";

// Campo de imagen (logo / portada): preview + subida a Vercel Blob (/api/dashboard/upload)
// con fallback a pegar una URL manual. El valor sigue siendo una URL (lo que guarda el
// negocio); este componente solo cambia CÓMO se obtiene.
export default function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  variant,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  variant: "logo" | "cover";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/dashboard/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "No se pudo subir la imagen.");
        return;
      }
      onChange(data.url);
    } catch {
      setError("No se pudo conectar. Intentá de nuevo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={styles.formGroup}>
      <label className={styles.formLabel}>{label}</label>

      {value &&
        (variant === "logo" ? (
          <div className={styles.logoPreview}>
            {/* URL remota arbitraria (del dueño o de Blob): <img> es lo correcto, sin next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="preview"
              className={styles.logoPreviewImg}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        ) : (
          <div className={styles.logoPreview} style={{ borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL remota arbitraria (ver nota en logo) */}
            <img
              src={value}
              alt="preview"
              style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        ))}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} style={btnUpload}>
          {uploading ? "Subiendo..." : value ? "Cambiar imagen" : "Subir imagen"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange("")} disabled={uploading} style={btnClear}>
            Quitar
          </button>
        )}
        <button type="button" onClick={() => setShowUrl((s) => !s)} style={linkBtn}>
          {showUrl ? "Ocultar URL" : "o pegar una URL"}
        </button>
      </div>

      {error && <div style={{ color: "#DC2626", fontSize: "0.8rem", marginTop: 6 }}>{error}</div>}

      {showUrl && (
        <input
          className={styles.formInput}
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://ejemplo.com/imagen.jpg"
          style={{ marginTop: 8 }}
        />
      )}

      {hint && <span style={{ fontSize: "0.78rem", color: "#8888aa", marginTop: 6, display: "block" }}>{hint}</span>}
      <span style={{ fontSize: "0.74rem", color: "#aaaabb", marginTop: 4, display: "block" }}>JPG, PNG o WEBP · máx 2 MB</span>
    </div>
  );
}

const btnUpload: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  fontWeight: 700,
  fontSize: "0.85rem",
  cursor: "pointer",
  border: "none",
  fontFamily: "inherit",
  background: "#00C48C",
  color: "#fff",
};

const btnClear: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: "0.85rem",
  cursor: "pointer",
  border: "1.5px solid #E8EAF0",
  fontFamily: "inherit",
  background: "#fff",
  color: "#4A4A6A",
};

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#8888aa",
  fontSize: "0.82rem",
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "underline",
};
