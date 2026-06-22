"use client";

import { useState } from "react";
import { todayISO } from "@/lib/format";

// Modal de reprogramación del dashboard. Elegí fecha → horarios libres del mismo
// servicio (/api/[slug]/slots) → confirmar → POST al endpoint del dueño
// (/api/[slug]/bookings/[id]/reschedule). La disponibilidad/concurrencia las
// garantiza el backend (mismo motor que reservar). onDone recarga la agenda.
export default function RescheduleModal({
  slug,
  bookingId,
  serviceId,
  clientName,
  currentLabel,
  onClose,
  onDone,
}: {
  slug: string;
  bookingId: string;
  serviceId: string;
  clientName: string;
  currentLabel: string;
  onClose: () => void;
  onDone: () => void;
}) {
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
      const res = await fetch(`/api/${slug}/slots?date=${d}&serviceId=${serviceId}`);
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
      const res = await fetch(`/api/${slug}/bookings/${bookingId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startTime: selected }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.message ?? data.error ?? "No se pudo reprogramar. Intentá de nuevo.");
        if (res.status === 409) loadSlots(date); // el slot pudo tomarse mientras elegías
        return;
      }
      onDone();
    } catch {
      setError("No se pudo conectar. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={overlay} onClick={() => !submitting && onClose()}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1A1A2E", margin: "0 0 4px" }}>
          Reprogramar turno
        </h3>
        <p style={{ fontSize: "0.85rem", color: "#8888aa", margin: "0 0 16px" }}>
          {clientName} · actual: {currentLabel}
        </p>

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

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={onClose} disabled={submitting} style={btnGhost}>
            Volver
          </button>
          <button onClick={submit} disabled={submitting || !selected} style={{ ...btnPrimary, opacity: selected ? 1 : 0.5 }}>
            {submitting ? "Reprogramando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(26,26,46,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 50,
};

const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 22,
  maxWidth: 420,
  width: "100%",
  maxHeight: "85vh",
  overflowY: "auto",
  boxShadow: "0 12px 40px rgba(26,26,46,0.2)",
};

const btnBase: React.CSSProperties = {
  flex: 1,
  padding: "12px 16px",
  borderRadius: 12,
  fontWeight: 700,
  fontSize: "0.9rem",
  cursor: "pointer",
  border: "none",
  fontFamily: "inherit",
};

const btnGhost: React.CSSProperties = { ...btnBase, background: "#F3F4F6", color: "#4A4A6A" };
const btnPrimary: React.CSSProperties = { ...btnBase, background: "#00C48C", color: "#fff" };
