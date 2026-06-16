"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";

interface Interval { startTime: string; endTime: string; }
interface DaySchedule { dayOfWeek: string; label: string; isActive: boolean; intervals: Interval[]; }

const DAY_LABELS: { dayOfWeek: string; label: string }[] = [
  { dayOfWeek: "MONDAY", label: "Lunes" },
  { dayOfWeek: "TUESDAY", label: "Martes" },
  { dayOfWeek: "WEDNESDAY", label: "Miércoles" },
  { dayOfWeek: "THURSDAY", label: "Jueves" },
  { dayOfWeek: "FRIDAY", label: "Viernes" },
  { dayOfWeek: "SATURDAY", label: "Sábado" },
  { dayOfWeek: "SUNDAY", label: "Domingo" },
];

const DEFAULT_INTERVAL: Interval = { startTime: "08:00", endTime: "18:00" };

function emptySchedule(): DaySchedule[] {
  return DAY_LABELS.map(d => ({ ...d, isActive: false, intervals: [{ ...DEFAULT_INTERVAL }] }));
}

const timeInput = {
  padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e8eaf0",
  fontSize: "0.9rem", fontFamily: "inherit", outline: "none",
};

export default function StaffSchedulePage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [staffName, setStaffName] = useState<string>("");
  const [schedule, setSchedule] = useState<DaySchedule[]>(emptySchedule());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const load = useCallback(async () => {
    try {
      const [staffRes, availRes] = await Promise.all([
        fetch("/api/dashboard/staff"),
        fetch(`/api/dashboard/availability?staffId=${encodeURIComponent(id)}`),
      ]);
      const staffData = await staffRes.json() as { staff: { id: string; name: string }[] };
      const found = (staffData.staff ?? []).find(s => s.id === id);
      if (!found) { router.push("/dashboard/staff"); return; }
      setStaffName(found.name);

      const availData = await availRes.json() as {
        availability: { dayOfWeek: string; isActive: boolean; intervals: Interval[] }[];
      };
      setSchedule(DAY_LABELS.map(def => {
        const row = availData.availability.find(r => r.dayOfWeek === def.dayOfWeek);
        if (!row) return { ...def, isActive: false, intervals: [{ ...DEFAULT_INTERVAL }] };
        return {
          ...def,
          isActive: row.isActive,
          intervals: row.intervals.length > 0 ? row.intervals : [{ ...DEFAULT_INTERVAL }],
        };
      }));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    if (status === "authenticated") load();
  }, [status, load]);

  function toggleDay(i: number, active: boolean) {
    setSchedule(prev => prev.map((d, j) => {
      if (j !== i) return d;
      if (active && d.intervals.length === 0) return { ...d, isActive: true, intervals: [{ ...DEFAULT_INTERVAL }] };
      return { ...d, isActive: active };
    }));
  }
  function updateInterval(i: number, k: number, patch: Partial<Interval>) {
    setSchedule(prev => prev.map((d, j) =>
      j === i ? { ...d, intervals: d.intervals.map((iv, m) => (m === k ? { ...iv, ...patch } : iv)) } : d
    ));
  }
  function addInterval(i: number) {
    setSchedule(prev => prev.map((d, j) =>
      j === i ? { ...d, intervals: [...d.intervals, { startTime: "14:00", endTime: "18:00" }] } : d
    ));
  }
  function removeInterval(i: number, k: number) {
    setSchedule(prev => prev.map((d, j) =>
      j === i ? { ...d, intervals: d.intervals.filter((_, m) => m !== k) } : d
    ));
  }

  async function save() {
    setError(null);
    setSaved(false);
    for (const day of schedule) {
      if (!day.isActive) continue;
      for (const iv of day.intervals) {
        if (iv.startTime >= iv.endTime) { setError(`${day.label}: la hora de inicio debe ser anterior al cierre.`); return; }
      }
      const sorted = [...day.intervals].sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let m = 1; m < sorted.length; m++) {
        if (sorted[m].startTime < sorted[m - 1].endTime) { setError(`${day.label}: los intervalos no pueden solaparse.`); return; }
      }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: id,
          schedule: schedule.map(d => ({ dayOfWeek: d.dayOfWeek, isActive: d.isActive, intervals: d.intervals })),
        }),
      });
      if (!res.ok) { setError("Error al guardar el horario."); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ color: "#4A4A6A", fontSize: "0.9rem" }}>Cargando...</div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => router.push("/dashboard/staff")}
          style={{ color: "#8888aa", fontSize: "0.85rem", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
        >
          ← Volver a profesionales
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1A1A2E", marginBottom: 4 }}>
          Horario de {staffName}
        </h1>
        <p style={{ color: "#4A4A6A", fontSize: "0.88rem" }}>
          Definí los días y horarios en que atiende. Podés agregar más de un intervalo por día (turno partido).
        </p>
      </div>

      <div style={{ background: "#fff", border: "1.5px solid #e8eaf0", borderRadius: 16, padding: "16px 20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {schedule.map((day, i) => (
            <div key={day.dayOfWeek} style={{ display: "flex", alignItems: "flex-start", gap: 14, opacity: day.isActive ? 1 : 0.6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 130, paddingTop: 8 }}>
                <input type="checkbox" checked={day.isActive} onChange={e => toggleDay(i, e.target.checked)} />
                <span style={{ fontWeight: 600, color: "#1A1A2E", fontSize: "0.9rem" }}>{day.label}</span>
              </label>

              {day.isActive ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {day.intervals.map((iv, k) => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="time" value={iv.startTime} onChange={e => updateInterval(i, k, { startTime: e.target.value })} style={timeInput} />
                      <span style={{ color: "#8888aa" }}>–</span>
                      <input type="time" value={iv.endTime} onChange={e => updateInterval(i, k, { endTime: e.target.value })} style={timeInput} />
                      {day.intervals.length > 1 && (
                        <button type="button" onClick={() => removeInterval(i, k)} title="Quitar intervalo"
                          style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1rem", padding: "0 4px" }}>✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => addInterval(i)}
                    style={{ background: "none", border: "none", color: "#00c48c", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", padding: 0, textAlign: "left" }}>
                    + Agregar intervalo (turno partido)
                  </button>
                </div>
              ) : (
                <span style={{ color: "#8888aa", fontSize: "0.86rem", paddingTop: 8 }}>No atiende</span>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: "#FFF0F0", border: "1px solid #FFCCCC", color: "#CC0000", borderRadius: 8, padding: "9px 14px", fontSize: "0.84rem", marginTop: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <button onClick={save} disabled={saving}
            style={{ background: "#00c48c", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: "0.86rem", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Guardando..." : "Guardar horario"}
          </button>
          {saved && <span style={{ color: "#00c48c", fontSize: "0.84rem", fontWeight: 600 }}>✓ Guardado</span>}
        </div>
      </div>
    </div>
  );
}
