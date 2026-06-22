"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayISO } from "@/lib/format";

// Reprogramación self-service: elegí una fecha, traemos los horarios libres del mismo
// servicio (/api/[slug]/slots) y al confirmar hacemos POST a /api/manage/[token]/reschedule.
// La disponibilidad y la concurrencia las garantiza el backend (mismo motor que reservar).
export default function RescheduleForm({
  token,
  slug,
  serviceIds,
}: {
  token: string;
  slug: string;
  serviceIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsMsg, setSlotsMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSlots(d: string) {
    setSlotsLoading(true);
    setSlots([]);
    setSelected(null);
    setSlotsMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/${slug}/slots?date=${d}&serviceIds=${serviceIds.join(",")}`);
      const data = (await res.json()) as { available: boolean; reason?: string; slots?: string[] };
      if (!data.available) setSlotsMsg(data.reason ?? "Ese día no está disponible.");
      else if (!data.slots?.length) setSlotsMsg("No hay horarios libres ese día. Probá otra fecha.");
      else setSlots(data.slots);
    } catch {
      setSlotsMsg("No se pudieron cargar los horarios. Intentá de nuevo.");
    } finally {
      setSlotsLoading(false);
    }
  }

  async function submit() {
    if (!date || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/manage/${encodeURIComponent(token)}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startTime: selected }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.message ?? data.error ?? "No se pudo reprogramar. Intentá de nuevo.");
        // El slot pudo tomarse mientras elegías: recargamos los horarios.
        if (res.status === 409) loadSlots(date);
        return;
      }
      // Recargar la página (Server Component) para reflejar el nuevo horario.
      router.refresh();
    } catch {
      setError("No se pudo conectar. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={btnOutline}>
        Reprogramar mi reserva
      </button>
    );
  }

  return (
    <div style={{ border: "1.5px solid #E8EAF0", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "#1A1A2E" }}>Elegí un nuevo horario</span>
        <button onClick={() => setOpen(false)} style={linkBtn}>Cerrar</button>
      </div>

      {error && (
        <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: "0.85rem", marginBottom: 12, lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      <input
        type="date"
        min={todayISO()}
        value={date}
        onChange={(e) => {
          const v = e.target.value;
          setDate(v);
          if (v) loadSlots(v);
        }}
        style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1.5px solid #E8EAF0", fontSize: "0.92rem", fontFamily: "inherit", marginBottom: 14 }}
      />

      {slotsLoading && <p style={{ fontSize: "0.85rem", color: "#8888aa", margin: 0 }}>Cargando horarios...</p>}
      {!slotsLoading && slotsMsg && <p style={{ fontSize: "0.85rem", color: "#8888aa", margin: 0 }}>{slotsMsg}</p>}

      {!slotsLoading && slots.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8, marginBottom: 14 }}>
          {slots.map((s) => (
            <button
              key={s}
              onClick={() => setSelected(s)}
              style={{
                padding: "10px 6px",
                borderRadius: 10,
                fontSize: "0.88rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                border: `1.5px solid ${selected === s ? "#00C48C" : "#E8EAF0"}`,
                background: selected === s ? "#E8FFF6" : "#fff",
                color: selected === s ? "#0f7a55" : "#4A4A6A",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <button onClick={submit} disabled={submitting} style={btnPrimary}>
          {submitting ? "Reprogramando..." : `Confirmar nuevo horario (${selected} hs)`}
        </button>
      )}
    </div>
  );
}

const btnOutline: React.CSSProperties = {
  width: "100%",
  padding: "13px 16px",
  borderRadius: 12,
  fontWeight: 700,
  fontSize: "0.92rem",
  cursor: "pointer",
  fontFamily: "inherit",
  background: "#fff",
  border: "1.5px solid #00C48C",
  color: "#0f7a55",
};

const btnPrimary: React.CSSProperties = {
  width: "100%",
  padding: "13px 16px",
  borderRadius: 12,
  fontWeight: 700,
  fontSize: "0.92rem",
  cursor: "pointer",
  border: "none",
  fontFamily: "inherit",
  background: "#00C48C",
  color: "#fff",
};

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#8888aa",
  fontSize: "0.82rem",
  cursor: "pointer",
  fontFamily: "inherit",
};
