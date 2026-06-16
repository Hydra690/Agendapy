"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelButton({ token }: { token: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/manage/${encodeURIComponent(token)}/cancel`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.message ?? data.error ?? "No se pudo cancelar. Intentá de nuevo.");
        setConfirming(false);
        return;
      }
      // Recargar la página (Server Component) para reflejar el estado CANCELLED.
      router.refresh();
    } catch {
      setError("No se pudo conectar. Intentá de nuevo.");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <>
        {error && <ErrorMsg text={error} />}
        <button onClick={() => { setConfirming(true); setError(null); }} style={btnOutline}>
          Cancelar mi reserva
        </button>
      </>
    );
  }

  return (
    <>
      {error && <ErrorMsg text={error} />}
      <p style={{ fontSize: "0.88rem", color: "#1A1A2E", fontWeight: 600, textAlign: "center", marginBottom: 12 }}>
        ¿Seguro que querés cancelar?
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setConfirming(false)} disabled={loading} style={btnGhost}>
          No, volver
        </button>
        <button onClick={cancel} disabled={loading} style={btnDanger}>
          {loading ? "Cancelando..." : "Sí, cancelar"}
        </button>
      </div>
    </>
  );
}

function ErrorMsg({ text }: { text: string }) {
  return (
    <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: "0.85rem", marginBottom: 12, lineHeight: 1.5 }}>
      {text}
    </div>
  );
}

const btnBase: React.CSSProperties = {
  flex: 1,
  padding: "13px 16px",
  borderRadius: 12,
  fontWeight: 700,
  fontSize: "0.92rem",
  cursor: "pointer",
  border: "none",
  fontFamily: "inherit",
};

const btnOutline: React.CSSProperties = {
  ...btnBase,
  width: "100%",
  background: "#fff",
  border: "1.5px solid #FCA5A5",
  color: "#DC2626",
};

const btnGhost: React.CSSProperties = {
  ...btnBase,
  background: "#F3F4F6",
  color: "#4A4A6A",
};

const btnDanger: React.CSSProperties = {
  ...btnBase,
  background: "#DC2626",
  color: "#fff",
};
